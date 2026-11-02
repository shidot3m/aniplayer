use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Anime4kPreset {
    ModeA,
    ModeAA,
    ModeB,
    ModeBB,
    ModeC,
    ModeCA,
    ModeFast,
    Off,
}

impl Anime4kPreset {
    pub fn from_label(label: &str) -> Self {
        match label.to_ascii_lowercase().as_str() {
            "mode a (hq)" | "a" | "mode_a" => Self::ModeA,
            "mode b (hq)" | "b" | "mode_b" => Self::ModeB,
            "mode b+b (hq)" | "b+b" | "mode_bb" => Self::ModeBB,
            "mode c (hq)" | "c" | "mode_c" => Self::ModeC,
            "mode c+a (hq)" | "c+a" | "mode_ca" => Self::ModeCA,
            "mode fast (apu)" | "fast" | "apu" => Self::ModeFast,
            "off" => Self::Off,
            _ => Self::ModeAA,
        }
    }

    pub fn shader_file_names(self) -> &'static [&'static str] {
        const CLAMP: &str = "Anime4K_Clamp_Highlights.glsl";
        const DOWNSCALE_X2: &str = "Anime4K_AutoDownscalePre_x2.glsl";
        const DOWNSCALE_X4: &str = "Anime4K_AutoDownscalePre_x4.glsl";
        const RESTORE_VL: &str = "Anime4K_Restore_CNN_VL.glsl";
        const RESTORE_M: &str = "Anime4K_Restore_CNN_M.glsl";
        const RESTORE_SOFT_VL: &str = "Anime4K_Restore_CNN_Soft_VL.glsl";
        const RESTORE_SOFT_M: &str = "Anime4K_Restore_CNN_Soft_M.glsl";
        const UPSCALE_VL: &str = "Anime4K_Upscale_CNN_x2_VL.glsl";
        const UPSCALE_M: &str = "Anime4K_Upscale_CNN_x2_M.glsl";
        const UPSCALE_S: &str = "Anime4K_Upscale_CNN_x2_S.glsl";
        const DENOISE_VL: &str = "Anime4K_Upscale_Denoise_CNN_x2_VL.glsl";

        match self {
            Self::ModeA => &[
                CLAMP,
                RESTORE_VL,
                UPSCALE_VL,
                DOWNSCALE_X2,
                DOWNSCALE_X4,
                UPSCALE_M,
            ],
            Self::ModeAA => &[
                CLAMP,
                RESTORE_VL,
                UPSCALE_VL,
                RESTORE_M,
                DOWNSCALE_X2,
                DOWNSCALE_X4,
                UPSCALE_M,
            ],
            Self::ModeB => &[
                CLAMP,
                RESTORE_SOFT_VL,
                UPSCALE_VL,
                DOWNSCALE_X2,
                DOWNSCALE_X4,
                UPSCALE_M,
            ],
            Self::ModeBB => &[
                CLAMP,
                RESTORE_SOFT_VL,
                UPSCALE_VL,
                DOWNSCALE_X2,
                DOWNSCALE_X4,
                RESTORE_SOFT_M,
                UPSCALE_M,
            ],
            Self::ModeC => &[CLAMP, DENOISE_VL, DOWNSCALE_X2, DOWNSCALE_X4, UPSCALE_M],
            Self::ModeCA => &[
                CLAMP,
                DENOISE_VL,
                DOWNSCALE_X2,
                DOWNSCALE_X4,
                RESTORE_M,
                UPSCALE_M,
            ],
            Self::ModeFast => &[
                CLAMP,
                RESTORE_M,
                UPSCALE_M,
                DOWNSCALE_X2,
                DOWNSCALE_X4,
                UPSCALE_S,
            ],
            Self::Off => &[],
        }
    }

    pub fn shader_chain(self, shaders_dir: &Path) -> Result<String, String> {
        self.shader_file_names()
            .iter()
            .map(|name| {
                let path = shaders_dir.join(name);
                if !path.is_file() {
                    return Err(format!("Anime4K shader is missing: {}", path.display()));
                }
                Ok(path.to_string_lossy().replace('\\', "/"))
            })
            .collect::<Result<Vec<_>, _>>()
            .map(|paths| paths.join(";"))
    }
}
