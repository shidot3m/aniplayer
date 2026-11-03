//! The player must stay controllable when mpv stops servicing its IPC pipe.
//!
//! Issue #43: a command was written to the pipe while the session mutex was held, so the
//! first blocked write took the whole player down with it — pause, seek, volume and close
//! all queued behind it and nothing was reported. These tests cover the replacement: the
//! liveness a command is judged by, and the queue that hands commands to a writer thread
//! that can wedge without taking anyone else with it.

use std::io::{self, Write};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use aniplayer_lib::player::{command_channel, reply_id, spawn_watchdog, spawn_writer, Liveness};
use serde_json::{json, Value};

/// A slow answer is not a dead player. While mpv keeps putting lines on the pipe — property
/// updates, events, answers to other commands — the clock that decides a stall runs from the
/// last thing it said, so a struggling-but-talking player is not killed for taking its time.
#[test]
fn a_player_that_keeps_talking_is_never_a_stall() {
    let written = Instant::now();
    let mut liveness = Liveness::default();
    liveness.note_written(1, written);

    let deadline = Duration::from_millis(500);
    for step in 1..10 {
        let spoke = written + Duration::from_millis(200 * step);
        liveness.note_line(spoke);
        assert!(
            !liveness.is_stalled(spoke, deadline),
            "mpv spoke {step} times in a row; the wait is not a stall yet"
        );
    }

    assert!(
        liveness.is_stalled(written + Duration::from_millis(2_600), deadline),
        "silence after the last line is the wedge the watchdog has to report"
    );
}

/// A command mpv never answers is the wedge: the process is alive, the pipe is open, and
/// no control reaches the player.
#[test]
fn an_unanswered_mpv_command_reads_as_a_stall_once_the_deadline_passes() {
    let written = Instant::now();
    let mut liveness = Liveness::default();
    liveness.note_written(1, written);

    let deadline = Duration::from_millis(1_000);
    assert!(
        !liveness.is_stalled(written + Duration::from_millis(900), deadline),
        "a command still inside its deadline is only in flight"
    );
    assert!(
        liveness.is_stalled(written + Duration::from_millis(1_100), deadline),
        "a command past its deadline means mpv stopped answering"
    );
}

/// mpv answers every command it accepts, so an answered command leaves nothing to wait on:
/// a player that answers is healthy even if the next deadline is far away.
#[test]
fn a_command_mpv_has_answered_leaves_nothing_pending() {
    let written = Instant::now();
    let mut liveness = Liveness::default();
    liveness.note_written(7, written);
    liveness.note_reply(7);

    assert!(
        !liveness.is_stalled(
            written + Duration::from_secs(600),
            Duration::from_millis(1_000)
        ),
        "an answered command must not keep the player looking wedged"
    );

    liveness.note_written(8, written + Duration::from_secs(600));
    assert!(
        liveness.is_stalled(
            written + Duration::from_secs(602),
            Duration::from_millis(1_000)
        ),
        "the next unanswered command must be judged on its own"
    );
}

/// mpv's answer to a command is the only line that retires the wait. Events say something
/// about playback, not about the command, and a malformed line says nothing at all.
#[test]
fn only_a_command_answer_carries_a_request_id() {
    assert_eq!(reply_id(r#"{"error":"success","request_id":7}"#), Some(7));
    assert_eq!(
        reply_id(r#"{"error":"some error","request_id":7}"#),
        Some(7)
    );
    assert_eq!(
        reply_id(r#"{"event":"property-change","name":"time-pos","data":12.5}"#),
        None
    );
    assert_eq!(reply_id(r#"{"event":"start-file","pause":false}"#), None);
    assert_eq!(reply_id(r#"{"error":"success"}"#), None);
    assert_eq!(reply_id("not json at all"), None);
}

/// `observe_property` registers an observer and is never answered: waiting for an answer to it
/// would report a wedge in a player that is working perfectly.
#[test]
fn registering_an_observer_leaves_nothing_waiting_for_an_answer() {
    let (queue, commands) = command_channel();
    let liveness = Arc::new(Mutex::new(Liveness::default()));
    let closing = Arc::new(AtomicBool::new(false));
    spawn_writer(
        Box::new(Vec::<u8>::new()),
        commands,
        liveness.clone(),
        closing.clone(),
    );

    queue
        .push(vec![json!("observe_property"), json!(1), json!("time-pos")])
        .expect("the queue accepts an observer");
    std::thread::sleep(Duration::from_millis(100));
    assert!(
        !liveness
            .lock()
            .unwrap()
            .is_stalled(Instant::now(), Duration::from_millis(50)),
        "mpv never answers observe_property, so nothing may wait for it"
    );

    queue
        .push(vec![json!("set_property"), json!("pause"), json!(true)])
        .expect("the queue accepts a command");
    std::thread::sleep(Duration::from_millis(100));
    assert!(
        liveness
            .lock()
            .unwrap()
            .is_stalled(Instant::now(), Duration::from_millis(50)),
        "a command mpv does answer stays pending until it answers"
    );
    closing.store(true, Ordering::Relaxed);
}

/// A pipe that never drains, which is what mpv's becomes when it stops servicing JSON IPC:
/// the first write parks and does not come back until the child is killed.
struct Wedged(mpsc::Receiver<()>);

impl Write for Wedged {
    fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
        let _ = self.0.recv();
        Ok(buffer.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

/// The interface used to write to the pipe itself while holding the session mutex, so the
/// first wedged write stopped every later command, close included. Now it only reaches a
/// queue, and the thread that can wedge is one nobody waits on.
#[test]
fn a_wedged_pipe_write_does_not_hold_up_the_caller() {
    let (queue, commands) = command_channel();
    let liveness = Arc::new(Mutex::new(Liveness::default()));
    let closing = Arc::new(AtomicBool::new(false));
    let (_release, parked) = mpsc::channel();
    spawn_writer(
        Box::new(Wedged(parked)),
        commands,
        liveness.clone(),
        closing.clone(),
    );

    let command: Vec<Value> = vec![json!("set_property"), json!("pause"), json!(true)];
    let started = Instant::now();
    for _ in 0..64 {
        queue
            .push(command.clone())
            .expect("the queue accepts commands while mpv is wedged");
    }
    assert!(
        started.elapsed() < Duration::from_millis(250),
        "handing a command over must not wait for the pipe: {:?}",
        started.elapsed()
    );

    std::thread::sleep(Duration::from_millis(150));
    assert!(
        liveness
            .lock()
            .unwrap()
            .is_stalled(Instant::now(), Duration::from_millis(100)),
        "the wedged command has to be visible as pending, or nothing can report the stall"
    );
    closing.store(true, Ordering::Relaxed);
}

/// The watchdog is what turns a wedged mpv into something the user can act on: one report,
/// then it stops waiting on a player that is already being taken down.
#[test]
fn the_watchdog_reports_a_stall_once() {
    let liveness = Arc::new(Mutex::new(Liveness::default()));
    liveness.lock().unwrap().note_written(1, Instant::now());
    let closing = Arc::new(AtomicBool::new(false));
    let reports = Arc::new(AtomicUsize::new(0));
    let counted = reports.clone();
    let watchdog = spawn_watchdog(
        liveness,
        closing.clone(),
        Duration::from_millis(50),
        Duration::from_millis(10),
        move || {
            counted.fetch_add(1, Ordering::Relaxed);
        },
    );

    std::thread::sleep(Duration::from_millis(400));
    assert_eq!(
        reports.load(Ordering::Relaxed),
        1,
        "a stall is reported once, not on every tick"
    );
    watchdog
        .join()
        .expect("the watchdog stops after reporting the stall");
}

/// Killing a player the user is closing themselves would be a second bug: a session that is
/// already on its way out is never a wedge.
#[test]
fn a_session_that_is_closing_is_never_reported_as_wedged() {
    let liveness = Arc::new(Mutex::new(Liveness::default()));
    liveness.lock().unwrap().note_written(1, Instant::now());
    let closing = Arc::new(AtomicBool::new(true));
    let reports = Arc::new(AtomicUsize::new(0));
    let counted = reports.clone();
    let watchdog = spawn_watchdog(
        liveness,
        closing,
        Duration::from_millis(50),
        Duration::from_millis(10),
        move || {
            counted.fetch_add(1, Ordering::Relaxed);
        },
    );

    std::thread::sleep(Duration::from_millis(300));
    assert_eq!(reports.load(Ordering::Relaxed), 0);
    watchdog
        .join()
        .expect("the watchdog stops when the session closes");
}
