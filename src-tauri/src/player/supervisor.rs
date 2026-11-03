use std::fmt;
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, Position, WebviewWindow, Window, WindowBuilder,
    WindowEvent,
};

use super::{
    command_channel, position_line, reply_id, spawn_watchdog, spawn_writer, Anime4kPreset,
    CommandQueue, Liveness, PlaybackEvents, PlayerEvent, StallBudget,
};

static NEXT_PIPE_ID: AtomicU64 = AtomicU64::new(0);

/// How long mpv may keep a command unanswered during playback before the player counts as
/// wedged. mpv stays inside this budget whenever it puts anything at all on the pipe, so a
/// player that is merely slow is not taken down for taking its time.
const STALL_DEADLINE: Duration = Duration::from_secs(5);

/// mpv's per-request network budget. The AniLiberty CDN rotates the segment host on every
/// redirect, so a keepalive failure costs one fresh connection; a hanging host must cost
/// ten seconds, not the default sixty (#45).
const NETWORK_TIMEOUT: Duration = Duration::from_secs(10);

/// How long mpv may take to open a file. While a load is in flight mpv holds its core
/// inside the network open — the pipe answers nothing and shows nothing — so the interactive
/// budget would execute a player that is merely struggling with a slow CDN (issue #45).
/// Three of mpv's network waits cover a load: the playlist, the segment its probe needs,
/// and one retry onto a fresh host after the ladder's keepalive failure.
const LOAD_BUDGET: Duration = Duration::from_secs(NETWORK_TIMEOUT.as_secs() * 3);

/// How often the watchdog looks at the clock.
const STALL_PROBE: Duration = Duration::from_millis(250);

/// What the interface shows when mpv stops answering.
const STALL_FAULT: &str = "mpv stopped responding to the player controls";

/// How long mpv may take to bring its JSON IPC pipe up. mpv cold-starts in well under a
/// second on the machines this runs on, so a budget this long only ever expires because
/// mpv is not coming up at all.
const PIPE_CONNECT_BUDGET: Duration = Duration::from_secs(5);

/// How often the pipe wait retries. It is also how quickly a mpv that stopped is reported.
const PIPE_CONNECT_PROBE: Duration = Duration::from_millis(50);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MpvOpenRequest {
    pub source: String,
    pub start: f64,
    pub volume: f64,
    pub muted: bool,
    pub speed: f64,
    pub anime4k_enabled: bool,
    pub preset: String,
}

struct MpvSession {
    child: Arc<Mutex<Child>>,
    commands: CommandQueue,
    video_window: Window,
    closing: Arc<AtomicBool>,
}

impl MpvSession {
    /// Hand one command to the writer thread. This does not touch the pipe: a write that mpv
    /// never drains (issue #43) parks the writer alone, and the watchdog reports the wedge.
    fn send(&self, command: Vec<Value>) -> Result<(), String> {
        self.commands.push(command)
    }

    fn set_property(&self, name: &str, value: Value) -> Result<(), String> {
        self.send(vec![json!("set_property"), json!(name), value])
    }

    fn observe(&self, id: u64, name: &str) -> Result<(), String> {
        self.send(vec![json!("observe_property"), json!(id), json!(name)])
    }

    fn load(&self, request: &MpvOpenRequest, shaders_dir: &Path) -> Result<(), String> {
        self.send(vec![
            json!("loadfile"),
            json!(request.source),
            json!("replace"),
            json!(-1),
            json!(format!("start={}", request.start.max(0.0))),
        ])?;
        // `pause` is global, not per-file: without this the next episode loads
        // onto a frozen frame while the UI claims it is playing.
        self.set_property("pause", json!(false))?;
        self.set_property("volume", json!(request.volume.clamp(0.0, 100.0)))?;
        self.set_property("mute", json!(request.muted || request.volume == 0.0))?;
        self.set_property("speed", json!(request.speed.clamp(0.25, 4.0)))?;
        self.set_anime4k(request.anime4k_enabled, &request.preset, shaders_dir)
    }

    fn set_anime4k(&self, enabled: bool, preset: &str, shaders_dir: &Path) -> Result<(), String> {
        let operation = if enabled {
            let chain = Anime4kPreset::from_label(preset)?.shader_chain(shaders_dir)?;
            vec![
                json!("change-list"),
                json!("glsl-shaders"),
                json!("set"),
                json!(chain),
            ]
        } else {
            vec![
                json!("change-list"),
                json!("glsl-shaders"),
                json!("clr"),
                json!(""),
            ]
        };
        self.send(operation)
    }
}

impl Drop for MpvSession {
    fn drop(&mut self) {
        self.closing.store(true, Ordering::Relaxed);
        kill(&self.child);
        let _ = self.video_window.close();
    }
}

/// Take mpv down. The child dying is also what releases a pipe write the writer thread is
/// still blocked in, so no thread of the player outlives the session.
fn kill(child: &Arc<Mutex<Child>>) {
    let mut child = child
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let _ = child.kill();
    let _ = child.wait();
}

pub struct MpvSupervisor {
    app_dir: PathBuf,
    shaders_dir: PathBuf,
    session: Arc<Mutex<Option<MpvSession>>>,
    /// The live mpv child handle, parked outside the session mutex so the window-event
    /// path can stop mpv without waiting for `open()` (issue #44).
    mpv: Mutex<Option<Arc<Mutex<Child>>>>,
}

impl MpvSupervisor {
    pub fn new(app_dir: PathBuf) -> Self {
        Self {
            shaders_dir: app_dir.join("shaders").join("anime4k"),
            app_dir,
            session: Arc::new(Mutex::new(None)),
            mpv: Mutex::new(None),
        }
    }

    pub fn open(
        &self,
        app: &AppHandle,
        main: &WebviewWindow,
        request: MpvOpenRequest,
    ) -> Result<(), String> {
        let source = self.validated_source(&request.source)?;
        if !request.start.is_finite() {
            return Err("Start position must be finite".to_string());
        }
        let request = MpvOpenRequest { source, ..request };
        let mut guard = self.lock();
        if let Some(session) = guard.as_ref() {
            session.load(&request, &self.shaders_dir)?;
            self.sync_window(main, &session.video_window)?;
            return Ok(());
        }

        if let Some(old_window) = app.get_window("native-player") {
            let _ = old_window.close();
        }
        let video_window = WindowBuilder::new(app, "native-player")
            .title("Aniplayer video")
            .decorations(false)
            .resizable(false)
            .closable(false)
            .minimizable(false)
            .maximizable(false)
            .skip_taskbar(true)
            .focused(false)
            .visible(false)
            .build()
            .map_err(|e| format!("Could not create the native video window: {e}"))?;
        self.sync_window(main, &video_window)?;

        let session = self.spawn(app, video_window)?;
        session.observe(1, "time-pos")?;
        session.observe(2, "duration")?;
        session.observe(3, "hwdec-current")?;
        session.observe(4, "eof-reached")?;
        session.load(&request, &self.shaders_dir)?;
        session.video_window.show().map_err(|e| e.to_string())?;
        main.set_always_on_top(true).map_err(|e| e.to_string())?;
        main.set_focus().map_err(|e| e.to_string())?;
        *guard = Some(session);
        Ok(())
    }

    pub fn set_pause(&self, paused: bool) -> Result<(), String> {
        self.with_session(|session| session.set_property("pause", json!(paused)))
    }

    pub fn seek(&self, seconds: f64) -> Result<(), String> {
        if !seconds.is_finite() {
            return Err("Seek position must be finite".to_string());
        }
        self.with_session(|session| {
            session.send(vec![
                json!("seek"),
                json!(seconds.max(0.0)),
                json!("absolute+exact"),
            ])
        })
    }

    pub fn set_volume(&self, volume: f64, muted: bool) -> Result<(), String> {
        self.with_session(|session| {
            session.set_property("volume", json!(volume.clamp(0.0, 100.0)))?;
            session.set_property("mute", json!(muted || volume == 0.0))
        })
    }

    pub fn set_speed(&self, speed: f64) -> Result<(), String> {
        self.with_session(|session| session.set_property("speed", json!(speed.clamp(0.25, 4.0))))
    }

    pub fn set_anime4k(&self, enabled: bool, preset: &str) -> Result<(), String> {
        self.with_session(|session| session.set_anime4k(enabled, preset, &self.shaders_dir))
    }

    pub fn close(&self, main: Option<&WebviewWindow>) {
        // Stop mpv first: the handle lives beside the session mutex, so the process dies
        // even while open() still holds that lock.
        self.kill_mpv();
        // The session is dropped (mpv killed again harmlessly, window closed) after the
        // lock is released.
        let session = self.lock().take();
        drop(session);
        if let Some(main) = main {
            let _ = main.set_always_on_top(false);
        }
    }

    /// Close driven from the application event loop. Like `sync_geometry`, this must never
    /// wait on the session mutex: `open()` holds it across window calls only this thread
    /// services (issue #44). mpv is stopped through the handle parked beside the mutex, so
    /// the process dies even if the app exits before the session is reclaimed; the session
    /// itself is taken down inline when the lock is free, or on a worker as soon as the
    /// starter releases it.
    fn close_from_event_loop(&self) {
        self.kill_mpv();
        let mut guard = match self.session.try_lock() {
            Ok(guard) => guard,
            Err(std::sync::TryLockError::WouldBlock) => {
                let session = self.session.clone();
                std::thread::spawn(move || {
                    let mut guard = session
                        .lock()
                        .unwrap_or_else(|poisoned| poisoned.into_inner());
                    let session = guard.take();
                    drop(guard);
                    drop(session);
                });
                return;
            }
            Err(std::sync::TryLockError::Poisoned(e)) => e.into_inner(),
        };
        let session = guard.take();
        drop(guard);
        drop(session);
    }

    /// Take down mpv through the handle kept outside the session mutex, so this never
    /// waits on the lock `open()` holds.
    fn kill_mpv(&self) {
        let child = {
            let mut slot = self
                .mpv
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            slot.take()
        };
        if let Some(child) = child {
            kill(&child);
        }
    }

    /// Re-aligns the video window with the main window. Called from the application event
    /// loop, so it must never wait on the session mutex: `open()` holds that mutex across
    /// window calls this thread is supposed to service, and it aligns the geometry itself
    /// when it finishes. A busy mutex therefore means "skip, the next event will catch up".
    pub fn sync_geometry(&self, main: &WebviewWindow) {
        let guard = match self.session.try_lock() {
            Ok(guard) => guard,
            Err(std::sync::TryLockError::WouldBlock) => return,
            Err(std::sync::TryLockError::Poisoned(e)) => e.into_inner(),
        };
        if let Some(session) = guard.as_ref() {
            let _ = self.sync_window(main, &session.video_window);
        }
    }

    pub fn handle_window_event(&self, window: &Window, event: &WindowEvent) {
        if window.label() != "main" {
            return;
        }
        match event {
            WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                if let Some(main) = window.app_handle().get_webview_window("main") {
                    self.sync_geometry(&main);
                }
            }
            WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed => {
                self.close_from_event_loop()
            }
            _ => {}
        }
    }

    fn spawn(&self, app: &AppHandle, video_window: Window) -> Result<MpvSession, String> {
        let executable = self.app_dir.join("mpv").join("mpv.exe");
        if !executable.is_file() {
            let _ = video_window.close();
            return Err(format!(
                "The bundled mpv runtime is missing: {}. Reinstall the complete portable bundle.",
                executable.display()
            ));
        }
        let wid = video_window.hwnd().map_err(|e| e.to_string())?.0 as usize;
        let pipe_id = NEXT_PIPE_ID.fetch_add(1, Ordering::Relaxed);
        let pipe_name = format!(r"\\.\pipe\aniplayer-mpv-{}-{pipe_id}", std::process::id());
        let child = Arc::new(Mutex::new(
            Command::new(&executable)
                .args(mpv_launch_args(wid, &pipe_name))
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .map_err(|e| format!("Could not start mpv: {e}"))?,
        ));
        // Register the kill handle before anything can block: a close arriving while the
        // pipe connects must find the process (#44).
        {
            let mut slot = self
                .mpv
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            *slot = Some(child.clone());
        }

        let pipe = match connect_pipe(
            &pipe_name,
            &mut process_state(&child, &self.mpv),
            PIPE_CONNECT_BUDGET,
            PIPE_CONNECT_PROBE,
        ) {
            Ok(pipe) => pipe,
            Err(fault) => {
                self.kill_mpv();
                let _ = video_window.close();
                return Err(fault.to_string());
            }
        };
        let reader = match pipe.try_clone() {
            Ok(reader) => reader,
            Err(error) => {
                self.kill_mpv();
                let _ = video_window.close();
                return Err(format!("Could not duplicate the mpv pipe: {error}"));
            }
        };
        let closing = Arc::new(AtomicBool::new(false));
        let liveness = Arc::new(Mutex::new(Liveness::default()));
        let (commands, queued) = command_channel();
        spawn_writer(Box::new(pipe), queued, liveness.clone(), closing.clone());
        spawn_reader(reader, app.clone(), closing.clone(), liveness.clone());
        watch_for_stall(app, liveness, closing.clone(), child.clone());
        Ok(MpvSession {
            child,
            commands,
            video_window,
            closing,
        })
    }

    fn validated_source(&self, source: &str) -> Result<String, String> {
        validate_playback_source(&self.app_dir, source)
    }

    /// Lays the video window's client area exactly over the main window's client area.
    ///
    /// `inner_position` reports the client area, but `set_position` moves the window frame,
    /// and the borderless video window still carries a thin sizing border (8 px at left and
    /// right, 8 px at the bottom on this machine). Without correcting for that inset the
    /// mpv frame sits a few pixels right of the transparent hole it is meant to fill.
    fn sync_window(&self, main: &WebviewWindow, video: &Window) -> Result<(), String> {
        let target = main.inner_position().map_err(|e| e.to_string())?;
        let size = main.inner_size().map_err(|e| e.to_string())?;
        video.set_size(size).map_err(|e| e.to_string())?;
        let inner = video.inner_position().map_err(|e| e.to_string())?;
        let outer = video.outer_position().map_err(|e| e.to_string())?;
        video
            .set_position(Position::Physical(PhysicalPosition::new(
                target.x - (inner.x - outer.x),
                target.y - (inner.y - outer.y),
            )))
            .map_err(|e| e.to_string())
    }

    fn with_session(
        &self,
        action: impl FnOnce(&MpvSession) -> Result<(), String>,
    ) -> Result<(), String> {
        let guard = self.lock();
        let session = guard
            .as_ref()
            .ok_or_else(|| "The native player is not open".to_string())?;
        action(session)
    }

    fn lock(&self) -> MutexGuard<'_, Option<MpvSession>> {
        self.session.lock().unwrap_or_else(|e| e.into_inner())
    }
}

/// The mpv launch vector, built in code so no path is interpolated into a shell string.
/// The network budget is the part issue #45 cannot afford to lose: AniLiberty rotates the
/// segment host on every redirect, and a host that stops answering must cost mpv its own
/// timeout — not the sixty-second default — before the HLS ladder opens a fresh connection.
pub fn mpv_launch_args(wid: usize, pipe_name: &str) -> Vec<String> {
    let mut args: Vec<String> = [
        "--no-config",
        "--idle=yes",
        "--force-window=yes",
        "--keep-open=yes",
        "--vo=gpu-next",
        "--gpu-api=auto",
        "--hwdec=auto-safe",
        "--border=no",
        "--osc=no",
        "--osd-level=0",
        "--input-default-bindings=no",
        "--input-vo-keyboard=no",
        "--input-cursor=no",
        "--window-dragging=no",
        "--terminal=no",
        "--msg-level=all=warn",
        // AniLiberty serves its streams to browsers only; a plain client is
        // refused. Subtitle tracks are mpv's job, chosen by language.
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) Aniplayer/1.0",
        "--slang=en,ru",
    ]
    .iter()
    .map(|arg| (*arg).to_string())
    .collect();
    args.push(format!("--network-timeout={}", NETWORK_TIMEOUT.as_secs()));
    args.push(format!("--wid={wid}"));
    args.push(format!("--input-ipc-server={pipe_name}"));
    args
}

/// The playback gate of `player_open`: a stream must be an HTTP(S) URL, and a
/// local file must canonicalize inside the app's downloads folder. A Windows
/// path with a drive letter parses as a URL whose scheme is the letter itself
/// ("E:"), so only strings carrying a `://` authority take the URL branch.
pub fn validate_playback_source(app_dir: &Path, source: &str) -> Result<String, String> {
    if source.is_empty() {
        return Err("This episode has no playable source".to_string());
    }
    if source.contains("://") {
        let url = reqwest::Url::parse(source).map_err(|e| format!("Invalid stream URL: {e}"))?;
        if matches!(url.scheme(), "http" | "https") {
            return Ok(url.to_string());
        }
        return Err("Only HTTP(S) streams and downloaded episodes can be played".to_string());
    }
    let canonical = Path::new(source)
        .canonicalize()
        .map_err(|e| format!("Downloaded episode cannot be opened: {e}"))?;
    let downloads = app_dir
        .join("downloads")
        .canonicalize()
        .map_err(|e| format!("Downloads folder cannot be opened: {e}"))?;
    if !canonical.starts_with(downloads) || !canonical.is_file() {
        return Err("The local playback source is outside the downloads folder".to_string());
    }
    Ok(canonical.to_string_lossy().to_string())
}

/// What the supervisor saw when it looked at the mpv process while waiting for its pipe.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProcessState {
    Running,
    /// mpv stopped, with the code it stopped on; `None` when a signal took it.
    Exited(Option<i32>),
    /// The supervisor reclaimed the kill handle, so it is mpv's executioner: whatever code
    /// the process left behind is ours, not a fact about mpv.
    Stopped,
}

/// Why the wait for mpv's JSON IPC pipe produced no pipe.
#[derive(Debug)]
pub enum PipeFault {
    /// mpv stopped before it ever created the pipe. The code comes from the wait watching
    /// the process, never from a kill the supervisor performed: Windows hands exit code 1
    /// to every process `Child::kill` terminates, and reading that back as mpv's own death
    /// is what sent issue #48 after a crash that had never happened.
    Exited(Option<i32>),
    /// A close reached mpv while its pipe was still coming up.
    Stopped,
    /// mpv was still running when the budget ran out.
    TimedOut(String),
}

impl fmt::Display for PipeFault {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PipeFault::Exited(Some(code)) => write!(
                formatter,
                "mpv stopped before the player connected (mpv exit code {code})"
            ),
            PipeFault::Exited(None) => write!(
                formatter,
                "mpv stopped before the player connected (killed by a signal)"
            ),
            PipeFault::Stopped => write!(formatter, "The player was closed while mpv was starting"),
            PipeFault::TimedOut(last_error) => write!(
                formatter,
                "Could not connect to mpv over JSON IPC: {last_error} (mpv was still running)"
            ),
        }
    }
}

/// Open mpv's JSON IPC pipe, giving up as soon as mpv stops or the budget runs out.
/// `process` is asked before every attempt, so a process that is already gone is reported
/// in one probe instead of after the whole budget.
pub fn connect_pipe(
    pipe_name: &str,
    process: &mut impl FnMut() -> ProcessState,
    budget: Duration,
    probe: Duration,
) -> Result<File, PipeFault> {
    let started = Instant::now();
    let mut last_error = String::new();
    loop {
        match process() {
            ProcessState::Exited(code) => return Err(PipeFault::Exited(code)),
            ProcessState::Stopped => return Err(PipeFault::Stopped),
            ProcessState::Running => {}
        }
        if started.elapsed() >= budget {
            return Err(PipeFault::TimedOut(last_error));
        }
        match OpenOptions::new().read(true).write(true).open(pipe_name) {
            Ok(pipe) => return Ok(pipe),
            Err(error) => last_error = error.to_string(),
        }
        std::thread::sleep(probe);
    }
}

/// Watch the mpv child for the pipe wait. Once the kill handle has left the slot, whoever
/// took it owns mpv's death: reporting the status it leaves behind as mpv's own is the
/// mistake this whole wait exists not to repeat. A lock that will not free is not a stopped
/// process either — the kill that holds it reports `Stopped` through the slot.
fn process_state<'a>(
    child: &'a Arc<Mutex<Child>>,
    slot: &'a Mutex<Option<Arc<Mutex<Child>>>>,
) -> impl FnMut() -> ProcessState + 'a {
    move || {
        let reclaimed = {
            let guard = slot
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            !matches!(&*guard, Some(live) if Arc::ptr_eq(live, child))
        };
        if reclaimed {
            return ProcessState::Stopped;
        }
        let Ok(mut child) = child.try_lock() else {
            return ProcessState::Running;
        };
        match child.try_wait() {
            Ok(Some(status)) => ProcessState::Exited(status.code()),
            _ => ProcessState::Running,
        }
    }
}

/// Report and take down a player that stopped answering, so the user gets an error and a
/// working close button instead of a frozen one (issue #43).
fn watch_for_stall(
    app: &AppHandle,
    liveness: Arc<Mutex<Liveness>>,
    closing: Arc<AtomicBool>,
    child: Arc<Mutex<Child>>,
) {
    let app = app.clone();
    spawn_watchdog(
        liveness,
        closing.clone(),
        StallBudget {
            interactive: STALL_DEADLINE,
            load: LOAD_BUDGET,
        },
        STALL_PROBE,
        move || {
            // The fault goes out before the child is taken down: killing mpv is what releases
            // the pipe write the writer thread is parked in, and the reason must not wait on it.
            closing.store(true, Ordering::Relaxed);
            let _ = app.emit(
                "player-event",
                PlayerEvent::Fault {
                    message: STALL_FAULT.to_string(),
                },
            );
            kill(&child);
        },
    );
}

fn spawn_reader(
    pipe: File,
    app: AppHandle,
    closing: Arc<AtomicBool>,
    liveness: Arc<Mutex<Liveness>>,
) {
    std::thread::spawn(move || {
        let mut events = PlaybackEvents::default();
        let reader = BufReader::new(pipe);
        for line in reader.lines() {
            match line {
                Ok(line) => {
                    let event = events.handle_line(&line);
                    {
                        let mut liveness = liveness
                            .lock()
                            .unwrap_or_else(|poisoned| poisoned.into_inner());
                        let now = Instant::now();
                        liveness.note_line(now);
                        if let Some(id) = reply_id(&line) {
                            liveness.note_reply(id);
                        }
                        // The first position of the newly opened file says mpv came back
                        // out of the open: from here the interactive budget applies again.
                        // Only `time-pos` counts; `duration` arrives from the playlist
                        // before playback and would end the load phase too early (#45).
                        if position_line(&line) {
                            liveness.note_tick();
                        }
                    }
                    if let Some(event) = event {
                        let _ = app.emit("player-event", event);
                    }
                }
                Err(error) => {
                    if !closing.load(Ordering::Relaxed) {
                        let _ = app.emit(
                            "player-event",
                            PlayerEvent::Fault {
                                message: format!("mpv stopped responding: {error}"),
                            },
                        );
                    }
                    return;
                }
            }
        }
        if !closing.load(Ordering::Relaxed) {
            let _ = app.emit(
                "player-event",
                PlayerEvent::Fault {
                    message: "mpv closed unexpectedly".to_string(),
                },
            );
        }
    });
}
