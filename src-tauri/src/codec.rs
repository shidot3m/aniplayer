use serde::{Deserialize, Serialize};
use std::sync::RwLock;

/// The codec families the app asks the WebView about, named after their ISO BMFF
/// sample entries so one name covers both the Matroska and the MP4 spelling.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CodecFamily {
    H264,
    Hevc,
    Av1,
    Vp9,
    Aac,
    Opus,
    Vorbis,
}

impl CodecFamily {
    /// Every family the startup probe is asked about.
    pub const ALL: &'static [CodecFamily] = &[
        CodecFamily::H264,
        CodecFamily::Hevc,
        CodecFamily::Av1,
        CodecFamily::Vp9,
        CodecFamily::Aac,
        CodecFamily::Opus,
        CodecFamily::Vorbis,
    ];

    pub fn label(self) -> &'static str {
        match self {
            CodecFamily::H264 => "H.264",
            CodecFamily::Hevc => "HEVC",
            CodecFamily::Av1 => "AV1",
            CodecFamily::Vp9 => "VP9",
            CodecFamily::Aac => "AAC",
            CodecFamily::Opus => "Opus",
            CodecFamily::Vorbis => "Vorbis",
        }
    }

    pub fn is_video(self) -> bool {
        matches!(self, Self::H264 | Self::Hevc | Self::Av1 | Self::Vp9)
    }
}

/// What the WebView said about a codec. `Unknown` is a real answer: the probe
/// found nothing that decides it, and an unprobed codec never opens playback.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CodecVerdict {
    Decodable,
    Undecodable,
    Unknown,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodecCapabilityReport {
    pub codecs: std::collections::BTreeMap<CodecFamily, CodecVerdict>,
    pub probed_at: String,
}

impl CodecCapabilityReport {
    pub fn verdict(&self, family: CodecFamily) -> CodecVerdict {
        self.codecs
            .get(&family)
            .copied()
            .unwrap_or(CodecVerdict::Unknown)
    }
}

/// The report the WebView handed over at startup, shared with everything that
/// decides whether a file is worth indexing. Absent until the probe answers.
#[derive(Debug, Default)]
pub struct CodecCapabilities {
    report: RwLock<Option<CodecCapabilityReport>>,
}

impl CodecCapabilities {
    pub fn update(&self, report: CodecCapabilityReport) {
        let mut guard = self.write();
        guard.replace(report);
    }

    pub fn snapshot(&self) -> Option<CodecCapabilityReport> {
        self.read().clone()
    }

    /// `Unknown` while no probe has reported yet.
    pub fn verdict(&self, family: CodecFamily) -> CodecVerdict {
        self.read()
            .as_ref()
            .map(|report| report.verdict(family))
            .unwrap_or(CodecVerdict::Unknown)
    }

    fn read(&self) -> std::sync::RwLockReadGuard<'_, Option<CodecCapabilityReport>> {
        self.report
            .read()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    fn write(&self) -> std::sync::RwLockWriteGuard<'_, Option<CodecCapabilityReport>> {
        self.report
            .write()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }
}

/// Maps a Matroska `CodecID` onto the family the WebView is asked about.
pub fn family_from_matroska(codec_id: &str) -> Option<CodecFamily> {
    match codec_id {
        "V_MPEG4/ISO/AVC" => Some(CodecFamily::H264),
        "V_MPEGH/ISO/HEVC" => Some(CodecFamily::Hevc),
        "V_AV1" => Some(CodecFamily::Av1),
        "V_VP9" => Some(CodecFamily::Vp9),
        "A_AAC" | "A_AAC/MPEG2/LC" | "A_AAC/MPEG4/LC" => Some(CodecFamily::Aac),
        "A_OPUS" => Some(CodecFamily::Opus),
        "A_VORBIS" => Some(CodecFamily::Vorbis),
        _ => None,
    }
}

/// Maps an ISO BMFF sample entry fourcc onto a codec family.
pub fn family_from_mp4_entry(entry: &[u8; 4]) -> Option<CodecFamily> {
    match entry {
        b"avc1" | b"avc3" => Some(CodecFamily::H264),
        b"hvc1" | b"hev1" => Some(CodecFamily::Hevc),
        b"av01" => Some(CodecFamily::Av1),
        b"vp09" => Some(CodecFamily::Vp9),
        b"mp4a" => Some(CodecFamily::Aac),
        b"Opus" => Some(CodecFamily::Opus),
        b"vorb" | b"Vorb" => Some(CodecFamily::Vorbis),
        _ => None,
    }
}
