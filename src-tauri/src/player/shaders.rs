use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Anime4kPreset {
    ModeAA,     // Mode A+A (HQ) - User default
    ModeA,      // Mode A (HQ)
    ModeB,      // Mode B (HQ)
    ModeBB,     // Mode B+B (HQ)
    ModeC,      // Mode C (HQ)
    ModeCA,     // Mode C+A (HQ)
    ModeFast,   // Fast APU (S / M)
    Off,
}

impl Anime4kPreset {
    pub fn from_str(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "A+A" | "AA" | "MODE_AA" => Anime4kPreset::ModeAA,
            "A" | "MODE_A" => Anime4kPreset::ModeA,
            "B" | "MODE_B" => Anime4kPreset::ModeB,
            "B+B" | "BB" | "MODE_BB" => Anime4kPreset::ModeBB,
            "C" | "MODE_C" => Anime4kPreset::ModeC,
            "C+A" | "CA" | "MODE_CA" => Anime4kPreset::ModeCA,
            "FAST" | "APU" => Anime4kPreset::ModeFast,
            _ => Anime4kPreset::Off,
        }
    }

    pub fn get_shader_filenames(&self) -> Vec<&'static str> {
        match self {
            Anime4kPreset::ModeAA => vec![
                "Anime4K_Clamp_Highlights.glsl",
                "Anime4K_Restore_CNN_VL.glsl",
                "Anime4K_Upscale_CNN_x2_VL.glsl",
                "Anime4K_Restore_CNN_M.glsl",
                "Anime4K_AutoDownscalePre_x2.glsl",
                "Anime4K_AutoDownscalePre_x4.glsl",
                "Anime4K_Upscale_CNN_x2_M.glsl",
            ],
            Anime4kPreset::ModeA => vec![
                "Anime4K_Clamp_Highlights.glsl",
                "Anime4K_Restore_CNN_VL.glsl",
                "Anime4K_Upscale_CNN_x2_VL.glsl",
                "Anime4K_AutoDownscalePre_x2.glsl",
                "Anime4K_AutoDownscalePre_x4.glsl",
                "Anime4K_Upscale_CNN_x2_M.glsl",
            ],
            Anime4kPreset::ModeB => vec![
                "Anime4K_Clamp_Highlights.glsl",
                "Anime4K_Restore_CNN_Soft_VL.glsl",
                "Anime4K_Upscale_CNN_x2_VL.glsl",
                "Anime4K_AutoDownscalePre_x2.glsl",
                "Anime4K_AutoDownscalePre_x4.glsl",
                "Anime4K_Upscale_CNN_x2_M.glsl",
            ],
            Anime4kPreset::ModeBB => vec![
                "Anime4K_Clamp_Highlights.glsl",
                "Anime4K_Restore_CNN_Soft_VL.glsl",
                "Anime4K_Upscale_CNN_x2_VL.glsl",
                "Anime4K_AutoDownscalePre_x2.glsl",
                "Anime4K_AutoDownscalePre_x4.glsl",
                "Anime4K_Restore_CNN_Soft_M.glsl",
                "Anime4K_Upscale_CNN_x2_M.glsl",
            ],
            Anime4kPreset::ModeC => vec![
                "Anime4K_Clamp_Highlights.glsl",
                "Anime4K_Upscale_Denoise_CNN_x2_VL.glsl",
                "Anime4K_AutoDownscalePre_x2.glsl",
                "Anime4K_AutoDownscalePre_x4.glsl",
                "Anime4K_Upscale_CNN_x2_M.glsl",
            ],
            Anime4kPreset::ModeCA => vec![
                "Anime4K_Clamp_Highlights.glsl",
                "Anime4K_Upscale_Denoise_CNN_x2_VL.glsl",
                "Anime4K_AutoDownscalePre_x2.glsl",
                "Anime4K_AutoDownscalePre_x4.glsl",
                "Anime4K_Restore_CNN_M.glsl",
                "Anime4K_Upscale_CNN_x2_M.glsl",
            ],
            Anime4kPreset::ModeFast => vec![
                "Anime4K_Clamp_Highlights.glsl",
                "Anime4K_Restore_CNN_M.glsl",
                "Anime4K_Upscale_CNN_x2_M.glsl",
                "Anime4K_AutoDownscalePre_x2.glsl",
                "Anime4K_Upscale_CNN_x2_S.glsl",
            ],
            Anime4kPreset::Off => vec![],
        }
    }

    pub fn build_glsl_shaders_string(&self, shaders_dir: &Path) -> String {
        let files = self.get_shader_filenames();
        if files.is_empty() {
            return String::new();
        }
        let paths: Vec<String> = files
            .into_iter()
            .map(|f| {
                let p: PathBuf = shaders_dir.join(f);
                // MPV on Windows accepts normalized paths with forward slashes
                p.to_string_lossy().replace('\\', "/")
            })
            .collect();
        paths.join(";")
    }
}
