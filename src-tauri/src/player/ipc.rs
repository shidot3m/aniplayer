//! The half of the mpv link that decides whether the player is still answering.
//!
//! mpv stops servicing its JSON IPC pipe while a stream is struggling (issue #43). The
//! commands the interface sends are therefore judged by one question: did mpv answer the
//! newest one it was given?

use std::io::Write;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use serde_json::{json, Value};

static NEXT_REQUEST_ID: AtomicU64 = AtomicU64::new(1);

/// Whether mpv still answers the commands it is handed.
#[derive(Debug, Default)]
pub struct Liveness {
    /// The newest command written to the pipe, and the moment it went.
    written: Option<(u64, Instant)>,
    /// The newest command mpv has acknowledged.
    acked: u64,
    /// The last moment mpv put anything at all on the pipe.
    last_line: Option<Instant>,
}

impl Liveness {
    /// Records that a command went to the pipe at `at`. Called before the write, so a write
    /// that blocks forever is still a command that mpv never answered.
    pub fn note_written(&mut self, id: u64, at: Instant) {
        self.written = Some((id, at));
    }

    /// Records that mpv answered the command with this `request_id`.
    pub fn note_reply(&mut self, id: u64) {
        self.acked = self.acked.max(id);
    }

    /// Records that a line arrived from mpv, whatever it turned out to say.
    pub fn note_line(&mut self, at: Instant) {
        self.last_line = Some(at);
    }

    /// A command is stalled once `deadline` has passed with mpv silent: nothing answered it,
    /// and nothing else came off the pipe either.
    pub fn is_stalled(&self, now: Instant, deadline: Duration) -> bool {
        let Some((id, written_at)) = self.written else {
            return false;
        };
        if id <= self.acked {
            return false;
        }
        let quiet_since = self
            .last_line
            .filter(|line| *line > written_at)
            .unwrap_or(written_at);
        now.saturating_duration_since(quiet_since) >= deadline
    }
}

/// The `request_id` of the command a line answers, if it answers one. mpv's own events carry
/// no id, so an answer is the only line that can retire a wait.
pub fn reply_id(line: &str) -> Option<u64> {
    serde_json::from_str::<Value>(line)
        .ok()?
        .get("request_id")?
        .as_u64()
}

/// A command on its way to mpv, carrying the `request_id` it will be answered under.
#[derive(Debug)]
pub struct Command {
    id: u64,
    expects_reply: bool,
    body: Vec<Value>,
}

/// The caller's half of the command queue. Handing a command over never waits for mpv: the
/// writer thread takes the blocking, and a wedged mpv cannot take the interface with it.
#[derive(Debug, Clone)]
pub struct CommandQueue {
    sender: Sender<Command>,
}

impl CommandQueue {
    /// Queue one JSON IPC command, assigned the next `request_id`.
    pub fn push(&self, body: Vec<Value>) -> Result<(), String> {
        self.sender
            .send(Command {
                id: NEXT_REQUEST_ID.fetch_add(1, Ordering::Relaxed),
                expects_reply: expects_reply(&body),
                body,
            })
            .map_err(|_| "The native player is closed".to_string())
    }
}

/// mpv answers every command it takes, except the observers it registers: `observe_property`
/// is acknowledged with nothing, so no wait may hang on it.
fn expects_reply(body: &[Value]) -> bool {
    !matches!(
        body.first().and_then(Value::as_str),
        Some("observe_property")
    )
}

/// The two halves of the command queue: the queue the interface pushes into, and the stream
/// the writer thread drains. An `mpsc` queue is unbounded, so a push cannot wait on mpv.
pub fn command_channel() -> (CommandQueue, Receiver<Command>) {
    let (sender, receiver) = channel();
    (CommandQueue { sender }, receiver)
}

/// Write queued commands to mpv on a thread of its own. A write that mpv never reads parks
/// this thread and nothing else; the reader thread is the one that reports the broken pipe.
pub fn spawn_writer(
    mut pipe: Box<dyn Write + Send>,
    commands: Receiver<Command>,
    liveness: Arc<Mutex<Liveness>>,
    closing: Arc<AtomicBool>,
) -> JoinHandle<()> {
    std::thread::spawn(move || {
        while let Ok(command) = commands.recv() {
            if closing.load(Ordering::Relaxed) {
                return;
            }
            let request = json!({ "command": command.body, "request_id": command.id });
            let Ok(mut payload) = serde_json::to_vec(&request) else {
                continue;
            };
            payload.push(b'\n');
            // Recorded before the write: a write that never finishes is exactly the command
            // mpv did not answer.
            if command.expects_reply {
                liveness
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner())
                    .note_written(command.id, Instant::now());
            }
            if pipe
                .write_all(&payload)
                .and_then(|()| pipe.flush())
                .is_err()
            {
                return;
            }
        }
    })
}

/// Watch for the wedge #43 describes: once a command has gone unanswered for `deadline`, run
/// `on_stall`. It runs once, and never for a session that is already closing.
pub fn spawn_watchdog(
    liveness: Arc<Mutex<Liveness>>,
    closing: Arc<AtomicBool>,
    deadline: Duration,
    probe: Duration,
    on_stall: impl FnOnce() + Send + 'static,
) -> JoinHandle<()> {
    std::thread::spawn(move || loop {
        std::thread::sleep(probe);
        if closing.load(Ordering::Relaxed) {
            return;
        }
        let stalled = liveness
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .is_stalled(Instant::now(), deadline);
        if stalled {
            // Checked again before acting: a session torn down while this tick was in flight
            // is not the player the user is looking at, and reporting it would close a live
            // one. A session that is closing is never a wedge.
            if closing.load(Ordering::Relaxed) {
                return;
            }
            on_stall();
            return;
        }
    })
}
