//! Stream copy from Matroska to the MP4 layout WebView2 demuxes.
//!
//! The payload is never re-encoded and never rewritten: Matroska stores AVC and
//! HEVC frames with the same length-prefixed framing ISO BMFF uses, so a frame's
//! bytes move unchanged and only the container is rebuilt. The result is served
//! as a virtual file — `ftyp` plus `moov`, then `mdat` whose bytes come out of the
//! source on demand — so no second copy of the episode lands on disk.

pub mod ebml;
pub mod matroska;
pub mod mp4;
pub mod service;

pub use service::RemuxService;

use matroska::{RawBlock, Track, TrackKind};
use mp4::{Sample, TrackMedia, TrackPlan};
use std::fs::File;
use std::io::{self, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

pub use mp4::MOVIE_TIMESCALE;

/// What a file's container says about itself, before anything is decided about
/// whether this machine can play it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Streams {
    pub container: Container,
    /// The container declares a picture track, whether or not this reader can name
    /// its codec.
    pub has_video: bool,
    /// The first picture track whose codec this reader can name.
    pub video: Option<crate::codec::CodecFamily>,
    pub audio: Vec<crate::codec::CodecFamily>,
    /// Codec identifiers of playable tracks this reader cannot name. Empty for a
    /// file whose every picture and sound track it understands.
    pub unknown_codecs: Vec<String>,
}

impl Streams {
    pub fn names_every_track(&self) -> bool {
        self.unknown_codecs.is_empty()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Container {
    /// ISO BMFF: the WebView demuxes it directly.
    Mp4,
    /// Matroska or WebM: readable here, and Matroska is remuxable.
    Matroska,
    /// Anything else: no reader here.
    Other,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RemuxError {
    NotMatroska,
    NoVideoTrack,
    /// A codec this reader does not map into an MP4 sample entry: either it has no
    /// entry registered, or this app does not implement the one it has.
    CodecNotMappable(String),
    /// The container gives no codec parameters to build a sample entry from.
    MissingCodecParameters,
    /// Frames arrive out of display order while the container states no frame
    /// duration, so the decode timeline cannot be rebuilt.
    ReorderedWithoutFrameDuration,
    /// Video frames are not Annex-B packed, so their sizes are not knowable.
    UnexpectedBitstream,
    /// A timeline MP4 cannot express.
    Unrepresentable(String),
    Io(String),
}

impl std::error::Error for RemuxError {}

impl std::fmt::Display for RemuxError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RemuxError::NotMatroska => write!(formatter, "not a Matroska or WebM file"),
            RemuxError::NoVideoTrack => write!(formatter, "the file has no video track"),
            RemuxError::CodecNotMappable(codec) => {
                write!(
                    formatter,
                    "{codec} has no MP4 sample entry this app implements"
                )
            }
            RemuxError::MissingCodecParameters => {
                write!(formatter, "the container carries no codec parameters")
            }
            RemuxError::ReorderedWithoutFrameDuration => write!(
                formatter,
                "frames arrive out of display order with no stated frame duration"
            ),
            RemuxError::UnexpectedBitstream => write!(
                formatter,
                "video frames use Annex-B start codes instead of the length-prefixed framing \
                 Matroska specifies"
            ),
            RemuxError::Unrepresentable(detail) => {
                write!(formatter, "MP4 cannot carry this timeline: {detail}")
            }
            RemuxError::Io(reason) => write!(formatter, "{reason}"),
        }
    }
}

impl From<io::Error> for RemuxError {
    fn from(error: io::Error) -> Self {
        RemuxError::Io(error.to_string())
    }
}

impl From<RemuxError> for io::Error {
    fn from(error: RemuxError) -> io::Error {
        io::Error::new(io::ErrorKind::InvalidData, error.to_string())
    }
}

/// The MP4 sample entry a codec family is carried in, when MP4 carries it.
pub fn mp4_entry(family: crate::codec::CodecFamily) -> Option<[u8; 4]> {
    use crate::codec::CodecFamily;
    match family {
        CodecFamily::H264 => Some(*b"avc1"),
        CodecFamily::Hevc => Some(*b"hvc1"),
        CodecFamily::Aac => Some(*b"mp4a"),
        CodecFamily::Av1 | CodecFamily::Vp9 | CodecFamily::Opus | CodecFamily::Vorbis => None,
    }
}

/// Reads just enough of a file to name its container and the codecs inside.
pub fn sniff_streams(path: &Path) -> io::Result<Streams> {
    let mut file = File::open(path)?;
    let file_len = file.metadata()?.len();
    let mut head = [0u8; 12];
    let read = file.read(&mut head)?;
    if read < 8 {
        return Ok(unknown_streams(Container::Other));
    }

    if head[..4] == [0x1A, 0x45, 0xDF, 0xA3] {
        let mut cursor = ebml::Cursor::new(file)?;
        let header = matroska::read_header(&mut cursor, file_len)?;
        matroska::require_matroska_doctype(&header.doctype)?;
        return Ok(streams_from_header(&header));
    }

    if head[4..8] == *b"ftyp" {
        let entries = mp4_sample_entries(&mut file)?;
        let mut streams = unknown_streams(Container::Mp4);
        for entry in entries {
            match crate::codec::family_from_mp4_entry(&entry) {
                Some(family) if family.is_video() && streams.video.is_none() => {
                    streams.video = Some(family);
                    streams.has_video = true;
                }
                Some(family) if family.is_video() => {}
                Some(family) => streams.audio.push(family),
                None => streams
                    .unknown_codecs
                    .push(String::from_utf8_lossy(&entry).into_owned()),
            }
        }
        return Ok(streams);
    }

    Ok(unknown_streams(Container::Other))
}

fn unknown_streams(container: Container) -> Streams {
    Streams {
        container,
        has_video: false,
        video: None,
        audio: Vec::new(),
        unknown_codecs: Vec::new(),
    }
}

fn streams_from_header(header: &matroska::Header) -> Streams {
    let mut streams = unknown_streams(Container::Matroska);
    for track in &header.tracks {
        match track.kind {
            TrackKind::Video => {
                streams.has_video = true;
                if streams.video.is_none() {
                    streams.video = track.family;
                }
                if track.family.is_none() {
                    streams.unknown_codecs.push(track.codec_id.clone());
                }
            }
            TrackKind::Audio => match track.family {
                Some(family) => streams.audio.push(family),
                None => streams.unknown_codecs.push(track.codec_id.clone()),
            },
            TrackKind::Ignored => {}
        }
    }
    streams
}

/// One sample's place in the virtual `mdat`, relative to the payload start.
#[derive(Debug, Clone, Copy)]
struct MdatEntry {
    video: bool,
    source_offset: u64,
    source_len: u64,
    payload_offset: u64,
    virtual_len: u64,
}

/// A remuxed episode: a virtual MP4 whose payload lives in another file.
#[derive(Debug, Clone)]
pub struct Plan {
    pub source: PathBuf,
    header: Vec<u8>,
    entries: Vec<MdatEntry>,
    payload_start: u64,
    total_len: u64,
    pub duration_us: u64,
    pub video_codec: crate::codec::CodecFamily,
    pub audio_codec: Option<crate::codec::CodecFamily>,
}

impl Plan {
    pub fn len(&self) -> u64 {
        self.total_len
    }

    pub fn is_empty(&self) -> bool {
        self.total_len == 0
    }

    /// Builds the plan. This is the expensive half of a remux: it walks every
    /// block in the file to record each frame's position and length, which is what
    /// MP4's sample tables spell out.
    pub fn build(path: &Path) -> Result<Self, RemuxError> {
        let file = File::open(path)?;
        let file_len = file.metadata()?.len();
        let mut cursor = ebml::Cursor::new(file)?;
        let header = matroska::read_header(&mut cursor, file_len)?;
        matroska::require_matroska_doctype(&header.doctype)?;

        let video_track = header
            .tracks
            .iter()
            .find(|track| track.kind == TrackKind::Video)
            .ok_or(RemuxError::NoVideoTrack)?;
        let blocks = matroska::read_blocks(&mut cursor, file_len, &header)?;

        let video_codec = video_track
            .family
            .ok_or_else(|| RemuxError::CodecNotMappable(video_track.codec_id.clone()))?;
        let video_entry = mp4_entry(video_codec)
            .ok_or_else(|| RemuxError::CodecNotMappable(video_track.codec_id.clone()))?;

        let video_blocks: Vec<RawBlock> = blocks
            .iter()
            .filter(|block| block.track_number == video_track.number)
            .copied()
            .collect();
        if video_blocks.is_empty() {
            return Err(RemuxError::NoVideoTrack);
        }

        // Matroska stores AVC and HEVC frames with length-prefixed framing, the
        // same shape ISO BMFF uses, so frames copy byte for byte. A file that
        // carries Annex-B start codes instead is outside the container's own
        // rules, and reframing it would mean rewriting every byte.
        let first_frame = read_at(
            &mut File::open(path)?,
            video_blocks[0].payload_start,
            video_blocks[0].payload_len.min(4) as usize,
        )?;
        if starts_with_start_code(&first_frame) {
            return Err(RemuxError::UnexpectedBitstream);
        }

        let mut video = build_track(
            video_track,
            header.timecode_scale_ns,
            &video_blocks,
            TrackMedia::Video,
            video_entry,
        )?;

        let mut audio: Option<TrackPlan> = None;
        let mut audio_codec = None;
        for track in header
            .tracks
            .iter()
            .filter(|track| track.kind == TrackKind::Audio)
        {
            let family = track
                .family
                .ok_or_else(|| RemuxError::CodecNotMappable(track.codec_id.clone()))?;
            let entry = mp4_entry(family)
                .ok_or_else(|| RemuxError::CodecNotMappable(track.codec_id.clone()))?;
            let audio_blocks: Vec<RawBlock> = blocks
                .iter()
                .filter(|block| block.track_number == track.number)
                .copied()
                .collect();
            if audio_blocks.is_empty() {
                continue;
            }
            audio_codec = Some(family);
            audio = Some(build_track(
                track,
                header.timecode_scale_ns,
                &audio_blocks,
                TrackMedia::Audio,
                entry,
            )?);
            break;
        }

        let mut entries = merge_payload(&video, &audio);
        let payload_bytes: u64 = entries.iter().map(|entry| entry.virtual_len).sum();
        let hevc = video_codec == crate::codec::CodecFamily::Hevc;

        // Where `mdat`'s payload begins depends on how long the header is, and the
        // header's length depends on the chunk offsets it records: an offset above
        // 4 GiB turns `stco` into `co64` and grows the movie box, which moves every
        // offset. Each pass lays out from the previous pass's measured length until
        // the measurement stops changing.
        let mdat_header = mp4::mdat_header(payload_bytes);
        let mut payload_start = mp4::ftyp(hevc).len() as u64 + mdat_header.len() as u64;
        let mut header_bytes = Vec::new();
        let mut settled = false;
        for _ in 0..3 {
            lay_out(&mut entries, &mut video, audio.as_mut(), payload_start);
            let mut out = mp4::ftyp(hevc);
            out.extend(mp4::moov(&video, audio.as_ref()));
            out.extend_from_slice(&mdat_header);
            settled = out.len() as u64 == payload_start;
            payload_start = out.len() as u64;
            header_bytes = out;
            if settled {
                break;
            }
        }

        if !settled {
            return Err(RemuxError::Unrepresentable(
                "the movie box kept changing size".to_string(),
            ));
        }

        Ok(Self {
            source: path.to_path_buf(),
            header: header_bytes,
            entries,
            payload_start,
            total_len: payload_start + payload_bytes,
            duration_us: movie_duration(&video, audio.as_ref()),
            video_codec,
            audio_codec,
        })
    }

    /// Reads `count` bytes of the virtual file from `start`, materializing sample
    /// payloads as it goes.
    pub fn read_range(&self, start: u64, count: u64) -> io::Result<Vec<u8>> {
        if count == 0 || start >= self.total_len {
            return Ok(Vec::new());
        }
        let end = start.saturating_add(count).min(self.total_len);
        let mut out = Vec::with_capacity((end - start) as usize);

        let header_len = self.payload_start;
        if start < header_len {
            let stop = end.min(header_len) as usize;
            out.extend_from_slice(&self.header[start as usize..stop]);
        }

        if end > self.payload_start {
            let from = start.max(self.payload_start) - self.payload_start;
            let to = end - self.payload_start;
            let mut file = File::open(&self.source)?;
            let first = self
                .entries
                .partition_point(|entry| entry.payload_offset + entry.virtual_len <= from);
            for entry in &self.entries[first..] {
                if entry.payload_offset >= to {
                    break;
                }
                let entry_end = entry.payload_offset + entry.virtual_len;
                // Frames copy byte for byte, so the sample is a plain window of
                // the source file.
                let payload = read_at(&mut file, entry.source_offset, entry.source_len as usize)?;
                let slice_from = from.max(entry.payload_offset) - entry.payload_offset;
                let slice_to = to.min(entry_end) - entry.payload_offset;
                out.extend_from_slice(&payload[slice_from as usize..slice_to as usize]);
            }
        }

        Ok(out)
    }
}

/// Writes each sample's offset in the virtual file back into its track table.
fn lay_out(
    entries: &mut [MdatEntry],
    video: &mut TrackPlan,
    mut audio: Option<&mut TrackPlan>,
    payload_start: u64,
) {
    let mut offset = 0u64;
    let mut video_index = 0usize;
    let mut audio_index = 0usize;
    for entry in entries.iter_mut() {
        entry.payload_offset = offset;
        offset += entry.virtual_len;
        let absolute = payload_start + entry.payload_offset;
        if entry.video {
            if let Some(sample) = video.samples.get_mut(video_index) {
                sample.virtual_offset = absolute;
            }
            video_index += 1;
        } else if let Some(plan) = audio.as_mut() {
            if let Some(sample) = plan.samples.get_mut(audio_index) {
                sample.virtual_offset = absolute;
            }
            audio_index += 1;
        }
    }
}

/// How long the remuxed file plays, in microseconds.
fn movie_duration(video: &TrackPlan, audio: Option<&TrackPlan>) -> u64 {
    video
        .movie_duration()
        .max(audio.map(TrackPlan::movie_duration).unwrap_or(0))
}

fn read_at(file: &mut File, offset: u64, len: usize) -> io::Result<Vec<u8>> {
    file.seek(SeekFrom::Start(offset))?;
    let mut buffer = vec![0u8; len];
    file.read_exact(&mut buffer)?;
    Ok(buffer)
}

/// Merges both tracks into payload order, which is the order the source stored
/// their blocks in.
fn merge_payload(video: &TrackPlan, audio: &Option<TrackPlan>) -> Vec<MdatEntry> {
    let mut entries: Vec<MdatEntry> = video
        .samples
        .iter()
        .map(|sample| MdatEntry {
            video: true,
            source_offset: sample.source_offset,
            source_len: sample.source_len,
            payload_offset: 0,
            virtual_len: u64::from(sample.size),
        })
        .collect();
    if let Some(audio) = audio {
        entries.extend(audio.samples.iter().map(|sample| MdatEntry {
            video: false,
            source_offset: sample.source_offset,
            source_len: sample.source_len,
            payload_offset: 0,
            virtual_len: u64::from(sample.size),
        }));
    }
    entries.sort_by_key(|entry| entry.source_offset);
    entries
}

/// Builds one track's sample table from its blocks.
///
/// Video frames arrive in decode order carrying their own presentation timecodes.
/// When those timecodes never step backwards the two orders coincide and no
/// composition offsets are needed; when they do, the decode timeline is rebuilt
/// from the stated frame duration, which is what MP4's decode-plus-offset tables
/// describe.
fn build_track(
    track: &Track,
    timecode_scale_ns: u64,
    blocks: &[RawBlock],
    media: TrackMedia,
    entry_fourcc: [u8; 4],
) -> Result<TrackPlan, RemuxError> {
    // MP4 records a sample size in 32 bits. A frame beyond that is not a file this
    // remux can describe, so it is refused rather than quietly written short.
    if let Some(block) = blocks
        .iter()
        .find(|block| block.payload_len > u64::from(u32::MAX))
    {
        return Err(RemuxError::Unrepresentable(format!(
            "a frame of {} bytes does not fit an MP4 sample size",
            block.payload_len
        )));
    }

    let timescale = match media {
        TrackMedia::Video => MOVIE_TIMESCALE,
        TrackMedia::Audio => track.sampling_frequency.round().max(1.0) as u32,
    };
    // Timecodes stay relative to the container's own zero, because that is what
    // lines the tracks up: an audio track that begins before the first picture
    // (AAC hands over its priming samples as a negative timecode) has to keep that
    // offset or lip-sync drifts by a frame.
    let pts: Vec<i64> = blocks
        .iter()
        .map(|block| {
            let ns = block
                .timecode_ticks
                .saturating_mul(timecode_scale_ns.max(1) as i64);
            to_units(ns, timescale)
        })
        .collect();
    let earliest = pts.iter().min().copied().unwrap_or(0);

    let monotone = pts.windows(2).all(|pair| pair[1] >= pair[0]);
    let mut samples: Vec<Sample> = Vec::with_capacity(blocks.len());
    // AAC frames are a fixed 1024 samples, while the container stamps their
    // timecodes onto its millisecond clock. Reading the length from the codec
    // instead of from those stamps keeps a long episode's audio in step: the stamps
    // are a fraction of a sample off every frame, and the difference adds up sample
    // by sample inside the track.
    let frame_samples = if entry_fourcc == *b"mp4a" {
        aac_frame_samples(&track.codec_private)
    } else {
        None
    };
    // The first frame of such a track, sitting on the container's zero, carries the
    // encoder's priming samples. A native MP4 skips it through the edit list, and
    // without the same skip the audio of a remuxed episode runs a frame behind the
    // picture.
    let priming = if earliest == 0 {
        u64::from(frame_samples.unwrap_or(0))
    } else {
        0
    };
    // A track whose first samples sit before the container's zero has to have them
    // skipped by the edit list; the out-of-order branch replaces this with the
    // delay its decode grid needs instead.
    let mut media_time = (-earliest).max(0) as u64 + priming;

    if monotone {
        for (index, block) in blocks.iter().enumerate() {
            let duration = match frame_samples {
                Some(samples_per_frame) => samples_per_frame,
                // Otherwise durations come from the presentation timestamps
                // themselves, so a variable frame rate survives without ever
                // trusting a stated default.
                None if index + 1 < pts.len() => (pts[index + 1] - pts[index]).max(1) as u32,
                None => samples
                    .last()
                    .map(|previous| previous.duration)
                    .unwrap_or(1),
            };
            samples.push(sample_row(block, duration, 0));
        }
    } else {
        // Frames arrived out of display order, so MP4's decode-plus-offset tables
        // are needed: `stts` walks a decode timeline and `ctts` says how much later
        // each frame is shown. Blocks are already in decode order, so the decode
        // timeline is the frame grid, and taking the offset as the distance from
        // that grid puts every frame back at the presentation time the container
        // gave it. The container's stated frame duration is unreliable across
        // muxers, and a constant-rate stream states its own rate in the timestamps:
        // the mean presentation interval is the frame duration.
        let frame_duration = frame_duration_units(&pts)
            .or_else(|| {
                track
                    .default_duration_ns
                    .map(|ns| to_units(i64::try_from(ns).unwrap_or(i64::MAX), timescale))
            })
            .filter(|units| *units > 0 && *units <= i64::from(timescale.max(1)))
            .ok_or(RemuxError::ReorderedWithoutFrameDuration)?;

        let offsets: Vec<i64> = (0..pts.len())
            .map(|index| pts[index] - index as i64 * frame_duration)
            .collect();
        // Offsets cannot be negative in MP4. Where the first frames are shown
        // before the grid reaches them, the whole track starts that much late
        // instead, which is what the edit list's media time says.
        let correction = offsets.iter().min().map_or(0, |lowest| (-*lowest).max(0));
        media_time = (correction + earliest.max(0)) as u64 + priming;

        for (index, block) in blocks.iter().enumerate() {
            let cts = offsets[index] + correction;
            if cts > i64::from(u32::MAX) {
                return Err(RemuxError::Unrepresentable(
                    "composition offsets leave the range MP4 allows".to_string(),
                ));
            }
            samples.push(sample_row(block, frame_duration as u32, cts as u32));
        }

        // MP4 states a track's length as the sum of its sample durations, and the
        // last picture is still shown for a frame after the decode grid runs out —
        // by the composition offsets, the grid ends that much before the picture
        // does. A player that trims at the stated duration would drop it, so the
        // shortfall goes onto the final sample.
        let grid_end = pts.len() as i64 * frame_duration;
        let picture_end = pts.iter().max().map_or(0, |last| last + correction) + frame_duration;
        if let Some(last) = samples.last_mut() {
            last.duration += picture_end.saturating_sub(grid_end).max(0) as u32;
        }
    }

    let codec_config = codec_config_for(entry_fourcc, &track.codec_private)?;

    Ok(TrackPlan {
        media,
        timescale,
        entry_fourcc,
        width: if media == TrackMedia::Video {
            track.pixel_width.unwrap_or(0) as u16
        } else {
            0
        },
        height: if media == TrackMedia::Video {
            track.pixel_height.unwrap_or(0) as u16
        } else {
            0
        },
        channels: if media == TrackMedia::Audio {
            track.channels.max(1) as u16
        } else {
            0
        },
        codec_config,
        samples,
        media_time,
        start_delay: earliest.max(0) as u64,
    })
}

fn sample_row(block: &RawBlock, duration: u32, cts: u32) -> Sample {
    Sample {
        duration: duration.max(1),
        // `build_track` refuses a frame that would not fit here.
        size: block.payload_len as u32,
        cts,
        sync: block.sync,
        source_offset: block.payload_start,
        source_len: block.payload_len,
        virtual_offset: 0,
    }
}

/// Samples one frame carries, from the object type an AudioSpecificConfig opens
/// with. Only AAC-LC is claimed here: an unrecognised profile gets no fixed length,
/// because guessing one shifts the audio for good.
fn aac_frame_samples(config: &[u8]) -> Option<u32> {
    match config.first().map(|byte| byte >> 3) {
        Some(2) => Some(1024),
        _ => None,
    }
}

fn codec_config_for(entry: [u8; 4], private: &[u8]) -> Result<Vec<u8>, RemuxError> {
    match &entry {
        b"avc1" | b"hvc1" => {
            // Both records start with configurationVersion 1.
            if private.first() != Some(&1) || private.len() < 4 {
                return Err(RemuxError::MissingCodecParameters);
            }
            Ok(private.to_vec())
        }
        b"mp4a" => {
            if private.is_empty() {
                return Err(RemuxError::MissingCodecParameters);
            }
            Ok(private.to_vec())
        }
        _ => Err(RemuxError::CodecNotMappable(
            String::from_utf8_lossy(&entry).into_owned(),
        )),
    }
}

/// Frame duration in track units, from the spread of the presentation timestamps
/// over the frames that carry them.
fn frame_duration_units(pts: &[i64]) -> Option<i64> {
    if pts.len() < 2 {
        return None;
    }
    let first = *pts.iter().min()?;
    let last = *pts.iter().max()?;
    let span = last - first;
    if span <= 0 {
        return None;
    }
    Some(((span as i128 + (pts.len() as i128 - 1) / 2) / (pts.len() as i128 - 1)) as i64)
}

/// Nanoseconds to a track's timescale units, rounded.
fn to_units(ns: i64, timescale: u32) -> i64 {
    let scale = i64::from(timescale.max(1)) as i128;
    let value = i128::from(ns) * scale;
    let rounded = if value >= 0 {
        (value + 500_000_000) / 1_000_000_000
    } else {
        -(((-value) + 500_000_000) / 1_000_000_000)
    };
    rounded as i64
}

/// True when a frame begins with an Annex-B start code rather than the
/// length-prefixed framing both Matroska and MP4 use.
fn starts_with_start_code(payload: &[u8]) -> bool {
    matches!(payload, [0, 0, 1, ..] | [0, 0, 0, 1, ..])
}

/// The big-endian `u32` at `at`. Callers walk boxes only after checking that four
/// more bytes are inside the buffer, so a failed conversion is a broken walk, not
/// malformed input.
fn be_u32(bytes: &[u8], at: usize) -> u32 {
    u32::from_be_bytes(
        bytes[at..at + 4]
            .try_into()
            .expect("a box walk only reads the four bytes it checked for"),
    )
}

/// The four-character box type at `at`, under the same promise as `be_u32`.
fn be_fourcc(bytes: &[u8], at: usize) -> [u8; 4] {
    bytes[at..at + 4]
        .try_into()
        .expect("a box walk only reads the four bytes it checked for")
}

/// Sample entry fourccs an MP4 file declares, read out of its `moov` only.
fn mp4_sample_entries(file: &mut File) -> io::Result<Vec<[u8; 4]>> {
    const MAX_MOOV: u64 = 64 * 1024 * 1024;
    let len = file.metadata()?.len();
    let mut entries = Vec::new();
    let mut position = 0u64;
    let mut head = [0u8; 8];

    while position + 8 <= len {
        file.seek(SeekFrom::Start(position))?;
        file.read_exact(&mut head)?;
        let mut size = u64::from(be_u32(&head, 0));
        let kind = be_fourcc(&head, 4);
        if size == 1 {
            let mut wide = [0u8; 8];
            file.read_exact(&mut wide)?;
            size = u64::from_be_bytes(wide);
        } else if size == 0 {
            size = len - position;
        }
        if size < 8 {
            break;
        }

        if &kind == b"moov" && size <= MAX_MOOV {
            let mut body = vec![0u8; (size - 8) as usize];
            file.read_exact(&mut body)?;
            collect_sample_entries(&body, &mut entries);
            break;
        }
        position += size;
    }

    Ok(entries)
}

/// Walks container boxes until a `stsd` is found, then records its entries.
///
/// The walk keeps its own queue of ranges instead of recursing: a crafted file can
/// nest containers thousands deep, and a recursive reader would run out of stack on
/// it. The number of entries is bounded too, because a file describing more sample
/// entries than a player has tracks is not something this app indexes.
fn collect_sample_entries(body: &[u8], out: &mut Vec<[u8; 4]>) {
    const MAX_ENTRIES: usize = 64;
    const CONTAINERS: [[u8; 4]; 4] = [*b"trak", *b"mdia", *b"minf", *b"stbl"];

    let mut pending = std::collections::VecDeque::new();
    pending.push_back(body);
    while let Some(range) = pending.pop_front() {
        let mut index = 0usize;
        while index + 8 <= range.len() && out.len() < MAX_ENTRIES {
            let size = be_u32(range, index) as usize;
            let kind = be_fourcc(range, index + 4);
            if size < 8 || index + size > range.len() {
                break;
            }
            if &kind == b"stsd" {
                let mut entry = index + 8 + 8; // version/flags and entry count
                while entry + 8 <= index + size && out.len() < MAX_ENTRIES {
                    let entry_size = be_u32(range, entry) as usize;
                    if entry_size < 8 || entry + entry_size > index + size {
                        break;
                    }
                    out.push(be_fourcc(range, entry + 4));
                    entry += entry_size;
                }
            } else if CONTAINERS.contains(&kind) {
                pending.push_back(&range[index + 8..index + size]);
            }
            index += size;
        }
    }
}
