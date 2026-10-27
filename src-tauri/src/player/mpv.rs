use crate::player::ffi::{MpvContext, MpvFfi};
use crate::player::shaders::Anime4kPreset;
use std::path::{Path, PathBuf};
use std::sync::Arc;

pub struct MpvCore {
    ffi: Arc<MpvFfi>,
    ctx: Arc<MpvContext>,
    shaders_dir: PathBuf,
    current_preset: String,
}

impl MpvCore {
    fn build(
        ffi: Arc<MpvFfi>,
        shaders_dir: &Path,
        hwnd: Option<usize>,
        headless: bool,
    ) -> Result<Self, String> {
        let ctx = ffi.create_context()?;

        // Base player options
        if headless {
            ffi.set_option_string(&ctx, "vo", "null")?;
            ffi.set_option_string(&ctx, "ao", "null")?;
        } else {
            ffi.set_option_string(&ctx, "terminal", "no")?;
            ffi.set_option_string(&ctx, "msg-level", "all=warn")?;
            ffi.set_option_string(&ctx, "hwdec", "auto-safe")?;
            ffi.set_option_string(&ctx, "vo", "gpu-next")?;
            ffi.set_option_string(&ctx, "gpu-api", "auto")?;
            ffi.set_option_string(&ctx, "keep-open", "yes")?;
            ffi.set_option_string(
                &ctx,
                "user-agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )?;
            ffi.set_option_string(&ctx, "referrer", "https://aniliberty.top/")?;

            if let Some(w) = hwnd {
                let wid_str = w.to_string();
                ffi.set_option_string(&ctx, "wid", &wid_str)?;
            }
        }

        ffi.initialize(&ctx)?;

        let mut core = Self {
            ffi,
            ctx,
            shaders_dir: shaders_dir.to_path_buf(),
            current_preset: if headless {
                "OFF".to_string()
            } else {
                "A+A".to_string()
            },
        };

        // Apply default A+A preset if shaders directory exists
        if !headless && shaders_dir.exists() {
            let _ = core.set_shader_preset("A+A");
        }

        Ok(core)
    }

    pub fn new(dll_path: &Path, shaders_dir: &Path, hwnd: Option<usize>) -> Result<Self, String> {
        let ffi = Arc::new(MpvFfi::load(dll_path)?);
        Self::build(ffi, shaders_dir, hwnd, false)
    }

    pub fn new_headless(shaders_dir: &Path) -> Result<Self, String> {
        let candidates = [
            PathBuf::from("bin/mpv-dev/libmpv-2.dll"),
            PathBuf::from("libmpv-2.dll"),
            PathBuf::from("../bin/mpv-dev/libmpv-2.dll"),
            PathBuf::from("../dist_portable/libmpv-2.dll"),
        ];
        let dll_path = candidates
            .into_iter()
            .find(|p| p.exists())
            .ok_or_else(|| "libmpv-2.dll not found in candidates".to_string())?;

        let ffi = Arc::new(MpvFfi::load(&dll_path)?);
        Self::build(ffi, shaders_dir, None, true)
    }

    pub fn load_video(&self, url: &str, start_pos: f64) -> Result<(), String> {
        let cmd = if start_pos > 0.0 {
            format!("loadfile \"{}\" replace start={:.2}", url, start_pos)
        } else {
            format!("loadfile \"{}\" replace", url)
        };
        self.ffi.command_string(&self.ctx, &cmd)
    }

    pub fn play(&self) -> Result<(), String> {
        self.ffi.set_property_string(&self.ctx, "pause", "no")
    }

    pub fn pause(&self) -> Result<(), String> {
        self.ffi.set_property_string(&self.ctx, "pause", "yes")
    }

    pub fn is_paused(&self) -> Result<bool, String> {
        match self.ffi.get_property_string(&self.ctx, "pause")? {
            Some(v) => Ok(v == "yes"),
            None => Ok(false),
        }
    }

    pub fn seek(&self, seconds: f64) -> Result<(), String> {
        let cmd = format!("seek {} absolute", seconds);
        self.ffi.command_string(&self.ctx, &cmd)
    }

    pub fn seek_relative(&self, offset: f64) -> Result<(), String> {
        let cmd = format!("seek {} relative", offset);
        self.ffi.command_string(&self.ctx, &cmd)
    }

    pub fn set_volume(&self, volume: f64) -> Result<(), String> {
        let vol_str = format!("{:.1}", volume.clamp(0.0, 100.0));
        self.ffi.set_property_string(&self.ctx, "volume", &vol_str)
    }

    pub fn get_volume(&self) -> Result<f64, String> {
        match self.ffi.get_property_string(&self.ctx, "volume")? {
            Some(v) => v.parse::<f64>().map_err(|e| e.to_string()),
            None => Ok(100.0),
        }
    }

    pub fn set_speed(&self, speed: f64) -> Result<(), String> {
        let spd_str = format!("{:.2}", speed.clamp(0.25, 4.0));
        self.ffi.set_property_string(&self.ctx, "speed", &spd_str)
    }

    pub fn get_time_pos(&self) -> Result<f64, String> {
        match self.ffi.get_property_string(&self.ctx, "time-pos")? {
            Some(v) => v.parse::<f64>().map_err(|e| e.to_string()),
            None => Ok(0.0),
        }
    }

    pub fn get_duration(&self) -> Result<f64, String> {
        match self.ffi.get_property_string(&self.ctx, "duration")? {
            Some(v) => v.parse::<f64>().map_err(|e| e.to_string()),
            None => Ok(0.0),
        }
    }

    pub fn set_shader_preset(&mut self, preset_name: &str) -> Result<(), String> {
        let preset = preset_name
            .parse::<Anime4kPreset>()
            .unwrap_or(Anime4kPreset::Off);
        let glsl_chain = preset.build_glsl_shaders_string(&self.shaders_dir);

        if glsl_chain.is_empty() {
            self.ffi
                .command_string(&self.ctx, "change-list glsl-shaders clr \"\"")?;
        } else {
            let cmd = format!("change-list glsl-shaders set \"{}\"", glsl_chain);
            self.ffi.command_string(&self.ctx, &cmd)?;
        }
        self.current_preset = preset_name.to_string();
        Ok(())
    }

    pub fn get_active_shaders(&self) -> Result<String, String> {
        match self.ffi.get_property_string(&self.ctx, "glsl-shaders")? {
            Some(s) => Ok(s),
            None => Ok(String::new()),
        }
    }

    pub fn get_current_preset(&self) -> String {
        self.current_preset.clone()
    }
}
