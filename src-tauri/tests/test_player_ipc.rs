//! The player must stay controllable when mpv stops servicing its IPC pipe.
//!
//! Issue #43: a command was written to the pipe while the session mutex was held, so the
//! first blocked write took the whole player down with it — pause, seek, volume and close
//! all queued behind it and nothing was reported. These tests cover the replacement: the
//! liveness a command is judged by, and the queue that hands commands to a writer thread
//! that can wedge without taking anyone else with it.
//!
//! Issue #45 added the phases: opening a file holds mpv's core inside the network, silent
//! on the pipe, so a load is judged on a load budget until the new file reports a position.

use std::io::{self, Write};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use aniplayer_lib::player::{
    command_channel, position_line, reply_id, spawn_watchdog, spawn_writer, Liveness, StallBudget,
};
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
    let budget = StallBudget {
        interactive: deadline,
        load: deadline,
    };
    for step in 1..10 {
        let spoke = written + Duration::from_millis(200 * step);
        liveness.note_line(spoke);
        assert!(
            !liveness.is_stalled(spoke, budget),
            "mpv spoke {step} times in a row; the wait is not a stall yet"
        );
    }

    assert!(
        liveness.is_stalled(written + Duration::from_millis(2_600), budget),
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
    let budget = StallBudget {
        interactive: deadline,
        load: deadline,
    };
    assert!(
        !liveness.is_stalled(written + Duration::from_millis(900), budget),
        "a command still inside its deadline is only in flight"
    );
    assert!(
        liveness.is_stalled(written + Duration::from_millis(1_100), budget),
        "a command past its deadline means mpv stopped answering"
    );
}

/// mpv keeps its core inside a blocking network open, and while that holds the pipe says
/// nothing at all: commands go unanswered and no property line arrives. A stream that is
/// slow to open is not a dead player (issue #45), so until playback reports its first
/// position the player is judged on the load budget instead of the interactive deadline.
#[test]
fn a_player_still_opening_the_file_waits_on_the_load_budget() {
    let budget = StallBudget {
        interactive: Duration::from_secs(5),
        load: Duration::from_secs(30),
    };
    let written = Instant::now();
    let mut liveness = Liveness::default();
    liveness.note_written(1, written);
    liveness.note_load(1);

    assert!(
        !liveness.is_stalled(written + Duration::from_secs(6), budget),
        "six silent seconds while the file opens are a struggling stream, not a dead player"
    );

    liveness.note_reply(1);
    liveness.note_tick();
    liveness.note_written(2, written + Duration::from_secs(8));
    assert!(
        liveness.is_stalled(written + Duration::from_secs(14), budget),
        "once playback started, an unanswered command is back on the interactive budget"
    );
}

/// A load that never establishes playback is still a wedge, and the load budget is what
/// ends it: after that deadline the player gets the same fault-and-kill as any other.
#[test]
fn a_load_that_never_establishes_playback_is_reported_when_its_budget_ends() {
    let budget = StallBudget {
        interactive: Duration::from_secs(5),
        load: Duration::from_secs(30),
    };
    let written = Instant::now();
    let mut liveness = Liveness::default();
    liveness.note_written(1, written);
    liveness.note_load(1);

    assert!(
        !liveness.is_stalled(written + Duration::from_secs(29), budget),
        "inside the load budget the player is only opening slowly"
    );
    assert!(
        liveness.is_stalled(written + Duration::from_secs(31), budget),
        "past the load budget the episode is dying on this stream, and the fault has to land"
    );
}

/// The first position after a load is what establishes playback. Quality and episode
/// switches send a new `loadfile`, which puts the player back on the load budget: the
/// core locks the same way it does on a cold open, and #45 measured switches freezing
/// the clock exactly like fresh loads.
#[test]
fn a_second_load_locks_the_player_again_until_playback_returns() {
    let budget = StallBudget {
        interactive: Duration::from_secs(5),
        load: Duration::from_secs(30),
    };
    let written = Instant::now();
    let mut liveness = Liveness::default();
    liveness.note_written(1, written);
    liveness.note_load(1);
    liveness.note_reply(1);
    liveness.note_tick();
    liveness.note_line(written + Duration::from_secs(3));

    liveness.note_written(2, written + Duration::from_secs(10));
    liveness.note_load(2);
    assert!(
        !liveness.is_stalled(written + Duration::from_secs(16), budget),
        "a switch that is still opening waits on the load budget too"
    );
    liveness.note_reply(2);
    liveness.note_tick();
    liveness.note_line(written + Duration::from_secs(17));
    assert!(
        !liveness.is_stalled(written + Duration::from_secs(20), budget),
        "the switch established playback: the tick line is evidence of life and restarts the wait"
    );
}

/// A position line can reach the reader after the switch's `loadfile` went out but before
/// mpv has even taken the command — it describes the _previous_ file and must not end the
/// load phase, or the interactive budget would execute the player mid-switch (#45).
#[test]
fn a_position_carried_over_from_the_previous_file_does_not_end_the_load_phase() {
    let budget = StallBudget {
        interactive: Duration::from_secs(5),
        load: Duration::from_secs(30),
    };
    let written = Instant::now();
    let mut liveness = Liveness::default();
    liveness.note_written(2, written);
    liveness.note_load(2);

    liveness.note_tick();
    liveness.note_written(3, written + Duration::from_secs(2));
    assert!(
        !liveness.is_stalled(written + Duration::from_secs(8), budget),
        "the carried-over position must not count as the new file's first tick"
    );

    liveness.note_reply(2);
    liveness.note_tick();
    assert!(
        liveness.is_stalled(written + Duration::from_secs(8), budget),
        "the position of the acknowledged load establishes playback, and the wait is interactive"
    );
}

/// Only `time-pos` with a real number establishes playback: `duration` is reported from the
/// playlist before playback starts, and a null position is mpv saying "not open yet" (#45).
#[test]
fn only_a_reported_position_establishes_playback() {
    assert!(position_line(
        r#"{"event":"property-change","name":"time-pos","data":12.5}"#
    ));
    assert!(!position_line(
        r#"{"event":"property-change","name":"time-pos","data":null}"#
    ));
    assert!(!position_line(
        r#"{"event":"property-change","name":"duration","data":1440.5}"#
    ));
    assert!(!position_line(r#"{"event":"start-file","pause":false}"#));
    assert!(!position_line(r#"{"error":"success","request_id":7}"#));
    assert!(!position_line("not json at all"));
}

/// mpv answers every command it accepts, so an answered command leaves nothing to wait on:
/// a player that answers is healthy even if the next deadline is far away.
#[test]
fn a_command_mpv_has_answered_leaves_nothing_pending() {
    let written = Instant::now();
    let mut liveness = Liveness::default();
    liveness.note_written(7, written);
    liveness.note_reply(7);

    let budget = StallBudget {
        interactive: Duration::from_millis(1_000),
        load: Duration::from_millis(1_000),
    };
    assert!(
        !liveness.is_stalled(written + Duration::from_secs(600), budget),
        "an answered command must not keep the player looking wedged"
    );

    liveness.note_written(8, written + Duration::from_secs(600));
    assert!(
        liveness.is_stalled(written + Duration::from_secs(602), budget),
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

    let budget = StallBudget {
        interactive: Duration::from_millis(50),
        load: Duration::from_millis(50),
    };
    queue
        .push(vec![json!("observe_property"), json!(1), json!("time-pos")])
        .expect("the queue accepts an observer");
    std::thread::sleep(Duration::from_millis(100));
    assert!(
        !liveness.lock().unwrap().is_stalled(Instant::now(), budget),
        "mpv never answers observe_property, so nothing may wait for it"
    );

    queue
        .push(vec![json!("set_property"), json!("pause"), json!(true)])
        .expect("the queue accepts a command");
    std::thread::sleep(Duration::from_millis(100));
    assert!(
        liveness.lock().unwrap().is_stalled(Instant::now(), budget),
        "a command mpv does answer stays pending until it answers"
    );
    closing.store(true, Ordering::Relaxed);
}

/// `loadfile` is where the load phase begins: the writer moves the judgement onto the load
/// budget when the command goes out, even if the write itself parks in a pipe mpv stopped
/// reading — which is exactly what a core stuck in a network open does (#45).
#[test]
fn a_loadfile_write_moves_the_player_onto_the_load_budget() {
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
        .push(vec![
            json!("loadfile"),
            json!("https://example.test/a.m3u8"),
        ])
        .expect("the queue accepts a load");
    std::thread::sleep(Duration::from_millis(100));
    assert!(
        !liveness.lock().unwrap().is_stalled(
            Instant::now(),
            StallBudget {
                interactive: Duration::from_millis(50),
                load: Duration::from_millis(60_000),
            },
        ),
        "a load in flight must be judged on the load budget, not the interactive one"
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
        liveness.lock().unwrap().is_stalled(
            Instant::now(),
            StallBudget {
                interactive: Duration::from_millis(100),
                load: Duration::from_millis(100),
            }
        ),
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
        StallBudget {
            interactive: Duration::from_millis(50),
            load: Duration::from_millis(50),
        },
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
        StallBudget {
            interactive: Duration::from_millis(50),
            load: Duration::from_millis(50),
        },
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
