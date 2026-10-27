use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Anime4kPreset {
    ModeAA,   // Mode A+A (HQ) - User default
    ModeA,    // Mode A (HQ)
    ModeB,    // Mode B (HQ)
    ModeBB,   // Mode B+B (HQ)
    ModeC,    // Mode C (HQ)
    ModeCA,   // Mode C+A (HQ)
    ModeFast, // Fast APU (S / M)
    Off,
}

impl std::str::FromStr for Anime4kPreset {
    type Err = std::convert::Infallible;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let upper = s.to_uppercase();
        Ok(if upper.contains("A+A") || upper.contains("AA") {
            Anime4kPreset::ModeAA
        } else if upper.contains("B+B") || upper.contains("BB") {
            Anime4kPreset::ModeBB
        } else if upper.contains("C+A") || upper.contains("CA") {
            Anime4kPreset::ModeCA
        } else if upper.contains("FAST") || upper.contains("APU") {
            Anime4kPreset::ModeFast
        } else if upper.contains("MODE A") || upper == "A" {
            Anime4kPreset::ModeA
        } else if upper.contains("MODE B") || upper == "B" {
            Anime4kPreset::ModeB
        } else if upper.contains("MODE C") || upper == "C" {
            Anime4kPreset::ModeC
        } else {
            Anime4kPreset::Off
        })
    }
}

impl Anime4kPreset {
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
