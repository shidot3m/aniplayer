use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow, Window, WindowBuilder, WindowEvent};

use super::{Anime4kPreset, PlaybackEvents, PlayerEvent};

static NEXT_PIPE_ID: AtomicU64 = AtomicU64::new(0);
static NEXT_REQUEST_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone)]
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
    child: Child,
    writer: Mutex<File>,
    video_window: Window,
    closing: Arc<AtomicBool>,
}

impl MpvSession {
    fn send(&self, command: Vec<Value>) -> Result<(), String> {
        let request = json!({
            "command": command,
            "request_id": NEXT_REQUEST_ID.fetch_add(1, Ordering::Relaxed),
        });
        let mut writer = self.writer.lock().unwrap_or_else(|e| e.into_inner());
        serde_json::to_writer(&mut *writer, &request).map_err(|e| e.to_string())?;
        writer.write_all(b"\n").map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())
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
        self.set_property("volume", json!(request.volume.clamp(0.0, 100.0)))?;
        self.set_property("mute", json!(request.muted || request.volume == 0.0))?;
        self.set_property("speed", json!(request.speed.clamp(0.25, 4.0)))?;
        self.set_anime4k(request.anime4k_enabled, &request.preset, shaders_dir)
    }

    fn set_anime4k(&self, enabled: bool, preset: &str, shaders_dir: &Path) -> Result<(), String> {
        let operation = if enabled {
            let chain = Anime4kPreset::from_label(preset).shader_chain(shaders_dir)?;
            vec![json!("change-list"), json!("glsl-shaders"), json!("set"), json!(chain)]
        } else {
            vec![json!("change-list"), json!("glsl-shaders"), json!("clr"), json!("")]
        };
        self.send(operation)
    }
}

impl Drop for MpvSession {
    fn drop(&mut self) {
        self.closing.store(true, Ordering::Relaxed);
        let _ = self.child.kill();
        let _ = self.child.wait();
        let _ = self.video_window.close();
    }
}

pub struct MpvSupervisor {
    app_dir: PathBuf,
    shaders_dir: PathBuf,
    session: Mutex<Option<MpvSession>>,
}

impl MpvSupervisor {
    pub fn new(app_dir: PathBuf) -> Self {
        Self {
            shaders_dir: app_dir.join("shaders").join("anime4k"),
            app_dir,
            session: Mutex::new(None),
        }
    }

    pub fn open(
        &self,
        app: &AppHandle,
        main: &WebviewWindow,
        request: MpvOpenRequest,
    ) -> Result<(), String> {
        let source = self.validated_source(&request.source)?;
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

        let session = match self.spawn(app, video_window) {
            Ok(session) => session,
            Err(error) => return Err(error),
        };
        session.observe(1, "time-pos")?;
        session.observe(2, "duration")?;
        session.observe(3, "hwdec-current")?;
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
        self.with_session(|session| {
            session.set_property("speed", json!(speed.clamp(0.25, 4.0)))
        })
    }

    pub fn set_anime4k(&self, enabled: bool, preset: &str) -> Result<(), String> {
        self.with_session(|session| session.set_anime4k(enabled, preset, &self.shaders_dir))
    }

    pub fn close(&self, main: Option<&WebviewWindow>) {
        self.lock().take();
        if let Some(main) = main {
            let _ = main.set_always_on_top(false);
        }
    }

    pub fn sync_geometry(&self, main: &WebviewWindow) {
        let guard = self.lock();
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
            WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed => self.close(None),
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
        let pipe_name = format!(
            r"\\.\pipe\aniplayer-mpv-{}-{pipe_id}",
            std::process::id()
        );
        let mut child = Command::new(&executable)
            .args([
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
                "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) Aniplayer/1.0",
            ])
            .arg(format!("--wid={wid}"))
            .arg(format!("--input-ipc-server={pipe_name}"))
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Could not start mpv: {e}"))?;

        let pipe = match connect_pipe(&pipe_name) {
            Ok(pipe) => pipe,
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = video_window.close();
                return Err(error);
            }
        };
        let reader = pipe.try_clone().map_err(|e| e.to_string())?;
        let closing = Arc::new(AtomicBool::new(false));
        spawn_reader(reader, app.clone(), closing.clone());
        Ok(MpvSession {
            child,
            writer: Mutex::new(pipe),
            video_window,
            closing,
        })
    }

    fn validated_source(&self, source: &str) -> Result<String, String> {
        if source.is_empty() {
            return Err("This episode has no playable source".to_string());
        }
        if let Ok(url) = reqwest::Url::parse(source) {
            if matches!(url.scheme(), "http" | "https") {
                return Ok(url.to_string());
            }
            return Err("Only HTTP(S) streams and downloaded episodes can be played".to_string());
        }
        let path = Path::new(source);
        let canonical = path
            .canonicalize()
            .map_err(|e| format!("Downloaded episode cannot be opened: {e}"))?;
        let downloads = self
            .app_dir
            .join("downloads")
            .canonicalize()
            .map_err(|e| format!("Downloads folder cannot be opened: {e}"))?;
        if !canonical.starts_with(downloads) || !canonical.is_file() {
            return Err("The local playback source is outside the downloads folder".to_string());
        }
        Ok(canonical.to_string_lossy().to_string())
    }

    fn sync_window(&self, main: &WebviewWindow, video: &Window) -> Result<(), String> {
        let position = main.inner_position().map_err(|e| e.to_string())?;
        let size = main.inner_size().map_err(|e| e.to_string())?;
        video.set_position(position).map_err(|e| e.to_string())?;
        video.set_size(size).map_err(|e| e.to_string())
    }

    fn with_session(&self, action: impl FnOnce(&MpvSession) -> Result<(), String>) -> Result<(), String> {
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

fn connect_pipe(pipe_name: &str) -> Result<File, String> {
    let mut last_error = String::new();
    for _ in 0..100 {
        match OpenOptions::new().read(true).write(true).open(pipe_name) {
            Ok(pipe) => return Ok(pipe),
            Err(error) => {
                last_error = error.to_string();
                std::thread::sleep(Duration::from_millis(50));
            }
        }
    }
    Err(format!("Could not connect to mpv over JSON IPC: {last_error}"))
}

fn spawn_reader(pipe: File, app: AppHandle, closing: Arc<AtomicBool>) {
    std::thread::spawn(move || {
        let mut events = PlaybackEvents::default();
        let reader = BufReader::new(pipe);
        for line in reader.lines() {
            match line {
                Ok(line) => {
                    if let Some(event) = events.handle_line(&line) {
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
