//! The video window must keep its place in the stack when the player loses focus.
//!
//! Issue #49: `MpvSupervisor::open` put only the main window in the topmost band. The video
//! window was a plain top-level, so the moment another application's window was activated —
//! an Alt+Tab, nothing more — that window took the top of the band the video window lived in,
//! sliding between the video and the always-on-top main window above it. The main window is
//! transparent under the controls, so the picture was replaced by whatever the user switched to:
//! "the player turns transparent".
//!
//! The stack itself is only observable on a desktop, so the tested seam is the sequence of
//! topmost transitions `open()` performs. Both windows must end in the topmost band, with the
//! main window moved last, because the window inserted into the band last is the highest one.
//! A runtime pass under `_evidence/` is the other half of the guard: this test pins the
//! sequence, the pass shows the frame surviving the focus change.

use std::cell::RefCell;
use std::rc::Rc;

use aniplayer_lib::player::{stack_player_windows, TopmostWindow};

/// A window that writes down every topmost transition is asked to make.
struct Recorded {
    log: Rc<RefCell<Vec<String>>>,
    label: &'static str,
    refuses: bool,
}

impl Recorded {
    fn new(label: &'static str, log: &Rc<RefCell<Vec<String>>>) -> Self {
        Self {
            log: log.clone(),
            label,
            refuses: false,
        }
    }

    fn stubborn(label: &'static str, log: &Rc<RefCell<Vec<String>>>) -> Self {
        Self {
            log: log.clone(),
            label,
            refuses: true,
        }
    }
}

impl TopmostWindow for Recorded {
    fn set_topmost(&self, topmost: bool) -> Result<(), String> {
        self.log.borrow_mut().push(format!(
            "{} {}",
            self.label,
            if topmost { "topmost" } else { "normal" }
        ));
        if self.refuses {
            return Err(format!("{} refused to move", self.label));
        }
        Ok(())
    }
}

/// The whole contract of the stack, in the order the moves have to happen. `normal` first for
/// the main window is not a reset: the windowing layer remembers the topmost flag, so asking a
/// window that is already in the band to join it again moves nothing, and the video window would
/// keep the place it just took — above the controls, covering the interface.
#[test]
fn both_windows_join_the_topmost_band_and_main_is_raised_last() {
    let log = Rc::new(RefCell::new(Vec::new()));
    let video = Recorded::new("video", &log);
    let main = Recorded::new("main", &log);

    stack_player_windows(&video, &main).expect("the stack must be applied");

    assert_eq!(
        log.borrow().as_slice(),
        ["main normal", "video topmost", "main topmost"],
        "the video window has to be topmost or any activated window buries it under the main \
         window's transparent hole, and the main window has to be the last one moved into the \
         band or it ends up under the picture it is meant to carry the controls over"
    );
}

/// A stack that cannot be completed is not left half-applied: the caller is told, and no
/// further move is attempted behind its back.
#[test]
fn a_window_that_refuses_to_move_stops_the_stack() {
    let log = Rc::new(RefCell::new(Vec::new()));
    let video = Recorded::stubborn("video", &log);
    let main = Recorded::new("main", &log);

    let error =
        stack_player_windows(&video, &main).expect_err("a refused move must reach the caller");

    assert!(
        error.contains("video refused to move"),
        "the window that faulted has to be named: {error}"
    );
    assert_eq!(
        log.borrow().as_slice(),
        ["main normal", "video topmost"],
        "the main window must not be raised over a video window that never joined the band"
    );
}

/// The sequence only helps if starting a session is what applies it. Guarded textually, in the
/// house style of `test_player_command_threading.rs`, because the property lives in the wiring:
/// a revert to raising the main window on its own — the shape that shipped the bug — still
/// compiles and leaves the seam test untouched.
#[test]
fn opening_a_session_stacks_both_windows() {
    let supervisor = include_str!("../src/player/supervisor.rs");
    let startup = supervisor
        .split("pub fn close(")
        .next()
        .expect("the supervisor starts a session before it closes one");

    assert!(
        startup.contains("stack_player_windows(&session.video_window, main)"),
        "starting a session has to stack the video window against the main one"
    );
    assert!(
        !startup.contains("main.set_always_on_top(true)"),
        "raising the main window alone is the half-stack that buried the frame (#49)"
    );
}
