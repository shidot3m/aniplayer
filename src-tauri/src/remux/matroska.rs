//! Matroska reading: the header a remux needs (tracks, codecs, timings) and the
//! block list that becomes the MP4 sample table.
//!
//! Only the elements the remux and the codec probe care about are decoded; every
//! other element is skipped by size, which keeps a full-file index pass
//! sequential instead of random.

use super::ebml::{self, Cursor};
use crate::codec::{self, CodecFamily};
use std::io;

/// Element identifiers, verified against the Matroska element specification and
/// FFmpeg's `libavformat/matroska.h`.
pub mod id {
    pub const EBML_HEADER: u32 = 0x1A45DFA3;
    pub const DOC_TYPE: u32 = 0x4282;
    pub const SEGMENT: u32 = 0x18538067;
    pub const INFO: u32 = 0x1549A966;
    pub const TIMECODE_SCALE: u32 = 0x2AD7B1;
    pub const TRACKS: u32 = 0x1654AE6B;
    pub const TRACK_ENTRY: u32 = 0xAE;
    pub const TRACK_NUMBER: u32 = 0xD7;
    pub const TRACK_TYPE: u32 = 0x83;
    pub const FLAG_LACING: u32 = 0x9C;
    pub const CODEC_ID: u32 = 0x86;
    pub const CODEC_PRIVATE: u32 = 0x63A2;
    pub const DEFAULT_DURATION: u32 = 0x23E383;
    pub const CODEC_DELAY: u32 = 0x56AA;
    pub const VIDEO: u32 = 0xE0;
    pub const AUDIO: u32 = 0xE1;
    pub const PIXEL_WIDTH: u32 = 0xB0;
    pub const PIXEL_HEIGHT: u32 = 0xBA;
    pub const SAMPLING_FREQUENCY: u32 = 0xB5;
    pub const CHANNELS: u32 = 0x9F;
    pub const CONTENT_ENCODINGS: u32 = 0x6D80;
    pub const CONTENT_ENCODING: u32 = 0x6240;
    pub const ENCODING_COMP_ALGO: u32 = 0x4254;
    pub const ENCODING_ENC_ALGO: u32 = 0x47E1;
    pub const CLUSTER: u32 = 0x1F43B675;
    pub const CLUSTER_TIMECODE: u32 = 0xE7;
    pub const SIMPLE_BLOCK: u32 = 0xA3;
    pub const BLOCK_GROUP: u32 = 0xA0;
    pub const BLOCK: u32 = 0xA1;
    pub const BLOCK_DURATION: u32 = 0x9B;
    pub const REFERENCE_BLOCK: u32 = 0xFB;
    pub const BLOCK_ADDITIONS: u32 = 0x75A1;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrackKind {
    Video,
    Audio,
    Ignored,
}

#[derive(Debug, Clone)]
pub struct Track {
    pub number: u64,
    pub kind: TrackKind,
    pub codec_id: String,
    pub family: Option<CodecFamily>,
    pub codec_private: Vec<u8>,
    /// Nanoseconds per frame, as the container states it.
    pub default_duration_ns: Option<u64>,
    pub codec_delay_ns: u64,
    pub sampling_frequency: f64,
    pub channels: u64,
    pub pixel_width: Option<u64>,
    pub pixel_height: Option<u64>,
    pub lacing_allowed: bool,
    pub encoded: bool,
}

impl Track {
    fn new(number: u64) -> Self {
        Self {
            number,
            kind: TrackKind::Ignored,
            codec_id: String::new(),
            family: None,
            codec_private: Vec::new(),
            default_duration_ns: None,
            codec_delay_ns: 0,
            sampling_frequency: 0.0,
            channels: 0,
            pixel_width: None,
            pixel_height: None,
            lacing_allowed: true,
            encoded: false,
        }
    }
}

#[derive(Debug, Clone)]
pub struct Header {
    pub doctype: String,
    /// Nanoseconds per timecode tick. Matroska defaults this to 1e6, a millisecond.
    pub timecode_scale_ns: u64,
    pub tracks: Vec<Track>,
}

impl Header {
    pub fn track(&self, number: u64) -> Option<&Track> {
        self.tracks.iter().find(|track| track.number == number)
    }

    /// Video and audio families the container actually carries.
    pub fn codec_families(&self) -> Vec<CodecFamily> {
        self.tracks
            .iter()
            .filter(|track| track.kind != TrackKind::Ignored)
            .filter_map(|track| track.family)
            .collect()
    }

    /// True when a playable track uses a codec this reader cannot name.
    pub fn has_unmapped_track(&self) -> bool {
        self.tracks
            .iter()
            .any(|track| track.kind != TrackKind::Ignored && track.family.is_none())
    }
}

/// A frame as the container stores it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RawBlock {
    pub track_number: u64,
    /// Absolute timecode in segment ticks: the presentation time of a video frame.
    pub timecode_ticks: i64,
    pub sync: bool,
    pub payload_start: u64,
    pub payload_len: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MatroskaError {
    /// The container is neither Matroska nor WebM.
    WrongDocType(String),
    /// A track declares compression or encryption this reader will not undo.
    EncodedTrack(u64),
    /// A block groups several frames, so frame boundaries are not on disk.
    LacedBlock(u64),
    /// A cluster without a timecode cannot be placed on the timeline.
    ClusterWithoutTimecode,
    /// A block header is too short to name a track and a timecode.
    TruncatedBlock,
}

impl std::error::Error for MatroskaError {}

impl std::fmt::Display for MatroskaError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MatroskaError::WrongDocType(doctype) => {
                write!(formatter, "not a Matroska stream (doctype {doctype:?})")
            }
            MatroskaError::EncodedTrack(number) => {
                write!(formatter, "track {number} is compressed or encrypted")
            }
            MatroskaError::LacedBlock(number) => {
                write!(formatter, "track {number} uses laced blocks")
            }
            MatroskaError::ClusterWithoutTimecode => write!(formatter, "a cluster has no timecode"),
            MatroskaError::TruncatedBlock => write!(formatter, "a block header is truncated"),
        }
    }
}

impl From<MatroskaError> for io::Error {
    fn from(error: MatroskaError) -> io::Error {
        io::Error::new(io::ErrorKind::InvalidData, error)
    }
}

/// Reads the EBML header plus the Segment's Info and Tracks.
pub fn read_header(cursor: &mut Cursor, file_len: u64) -> io::Result<Header> {
    let mut header = Header {
        doctype: String::new(),
        timecode_scale_ns: 1_000_000,
        tracks: Vec::new(),
    };

    cursor.seek(0)?;
    while let Some(element) = cursor.read_element(file_len)? {
        match element.id {
            id::EBML_HEADER => header.doctype = read_doctype(cursor, &element)?,
            id::SEGMENT => {
                cursor.seek(element.payload_start)?;
                read_segment_header(cursor, element.payload_end, &mut header)?;
                return Ok(header);
            }
            _ => cursor.skip(element.payload_len()),
        }
    }

    Ok(header)
}

/// Rejects a file whose EBML doctype is not a Matroska-family container.
pub fn require_matroska_doctype(doctype: &str) -> io::Result<()> {
    if doctype == "matroska" || doctype == "webm" {
        Ok(())
    } else {
        Err(MatroskaError::WrongDocType(doctype.to_string()).into())
    }
}

fn read_doctype(cursor: &mut Cursor, element: &ebml::ElementHeader) -> io::Result<String> {
    cursor.seek(element.payload_start)?;
    let mut doctype = String::new();
    while cursor.position() < element.payload_end {
        let Some(child) = cursor.read_element(element.payload_end)? else {
            break;
        };
        if child.id == id::DOC_TYPE {
            let bytes = cursor.read_payload(&child)?;
            doctype = String::from_utf8_lossy(&bytes)
                .trim_end_matches('\0')
                .to_string();
        } else {
            cursor.skip(child.payload_len());
        }
    }
    Ok(doctype)
}

fn read_segment_header(cursor: &mut Cursor, limit: u64, header: &mut Header) -> io::Result<()> {
    while cursor.position() < limit {
        let Some(element) = cursor.read_element(limit)? else {
            break;
        };
        match element.id {
            id::INFO => read_info(cursor, &element, header)?,
            id::TRACKS => read_tracks(cursor, &element, header)?,
            // Payload starts at the first cluster.
            id::CLUSTER => return Ok(()),
            _ => cursor.skip(element.payload_len()),
        }
    }
    Ok(())
}

fn read_info(
    cursor: &mut Cursor,
    element: &ebml::ElementHeader,
    header: &mut Header,
) -> io::Result<()> {
    cursor.seek(element.payload_start)?;
    while cursor.position() < element.payload_end {
        let Some(child) = cursor.read_element(element.payload_end)? else {
            break;
        };
        if child.id == id::TIMECODE_SCALE {
            let bytes = cursor.read_payload(&child)?;
            header.timecode_scale_ns = ebml::read_uint(&bytes).max(1);
        } else {
            cursor.skip(child.payload_len());
        }
    }
    Ok(())
}

fn read_tracks(
    cursor: &mut Cursor,
    element: &ebml::ElementHeader,
    header: &mut Header,
) -> io::Result<()> {
    cursor.seek(element.payload_start)?;
    while cursor.position() < element.payload_end {
        let Some(entry) = cursor.read_element(element.payload_end)? else {
            break;
        };
        if entry.id != id::TRACK_ENTRY {
            cursor.skip(entry.payload_len());
            continue;
        }
        let track = read_track_entry(cursor, &entry)?;
        header.tracks.push(track);
    }
    Ok(())
}

fn read_track_entry(cursor: &mut Cursor, element: &ebml::ElementHeader) -> io::Result<Track> {
    let mut track = Track::new(0);
    let mut declared_type = 0u64;

    cursor.seek(element.payload_start)?;
    while cursor.position() < element.payload_end {
        let Some(child) = cursor.read_element(element.payload_end)? else {
            break;
        };
        match child.id {
            id::TRACK_NUMBER => {
                let bytes = cursor.read_payload(&child)?;
                track.number = ebml::read_uint(&bytes);
            }
            id::TRACK_TYPE => {
                let bytes = cursor.read_payload(&child)?;
                declared_type = ebml::read_uint(&bytes);
            }
            id::CODEC_ID => {
                let bytes = cursor.read_payload(&child)?;
                track.codec_id = String::from_utf8_lossy(&bytes)
                    .trim_end_matches('\0')
                    .to_string();
                track.family = codec::family_from_matroska(&track.codec_id);
            }
            id::CODEC_PRIVATE => track.codec_private = cursor.read_payload(&child)?,
            id::DEFAULT_DURATION => {
                let bytes = cursor.read_payload(&child)?;
                track.default_duration_ns = Some(ebml::read_uint(&bytes));
            }
            id::CODEC_DELAY => {
                let bytes = cursor.read_payload(&child)?;
                track.codec_delay_ns = ebml::read_uint(&bytes);
            }
            id::FLAG_LACING => {
                let bytes = cursor.read_payload(&child)?;
                track.lacing_allowed = ebml::read_uint(&bytes) != 0;
            }
            id::VIDEO => {
                if declared_type == 1 {
                    track.kind = TrackKind::Video;
                }
                let (width, height) = read_video_size(cursor, &child)?;
                track.pixel_width = width;
                track.pixel_height = height;
            }
            id::AUDIO => {
                if declared_type == 2 {
                    track.kind = TrackKind::Audio;
                }
                let (frequency, channels) = read_audio_format(cursor, &child)?;
                track.sampling_frequency = frequency;
                track.channels = channels;
            }
            id::CONTENT_ENCODINGS => track.encoded = read_content_encoding(cursor, &child)?,
            _ => cursor.skip(child.payload_len()),
        }
    }

    if track.encoded {
        return Err(MatroskaError::EncodedTrack(track.number).into());
    }
    Ok(track)
}

/// Frame size, from inside the track's Video element.
fn read_video_size(
    cursor: &mut Cursor,
    element: &ebml::ElementHeader,
) -> io::Result<(Option<u64>, Option<u64>)> {
    cursor.seek(element.payload_start)?;
    let mut width = None;
    let mut height = None;
    while cursor.position() < element.payload_end {
        let Some(child) = cursor.read_element(element.payload_end)? else {
            break;
        };
        match child.id {
            id::PIXEL_WIDTH => {
                let bytes = cursor.read_payload(&child)?;
                width = Some(ebml::read_uint(&bytes));
            }
            id::PIXEL_HEIGHT => {
                let bytes = cursor.read_payload(&child)?;
                height = Some(ebml::read_uint(&bytes));
            }
            _ => cursor.skip(child.payload_len()),
        }
    }
    Ok((width, height))
}

/// Sample rate and channel count, from inside the track's Audio element.
fn read_audio_format(cursor: &mut Cursor, element: &ebml::ElementHeader) -> io::Result<(f64, u64)> {
    cursor.seek(element.payload_start)?;
    // Matroska defaults an audio track to 8 kHz mono.
    let mut frequency = 8_000.0;
    let mut channels = 1u64;
    while cursor.position() < element.payload_end {
        let Some(child) = cursor.read_element(element.payload_end)? else {
            break;
        };
        match child.id {
            id::SAMPLING_FREQUENCY => {
                let bytes = cursor.read_payload(&child)?;
                frequency = ebml::read_float(&bytes).unwrap_or(frequency);
            }
            id::CHANNELS => {
                let bytes = cursor.read_payload(&child)?;
                channels = ebml::read_uint(&bytes).max(1);
            }
            _ => cursor.skip(child.payload_len()),
        }
    }
    Ok((frequency, channels))
}

/// True when any encoding of this track compresses or encrypts its frames.
fn read_content_encoding(cursor: &mut Cursor, element: &ebml::ElementHeader) -> io::Result<bool> {
    cursor.seek(element.payload_start)?;
    let mut encoded = false;
    while cursor.position() < element.payload_end {
        let Some(encoding) = cursor.read_element(element.payload_end)? else {
            break;
        };
        if encoding.id != id::CONTENT_ENCODING {
            cursor.skip(encoding.payload_len());
            continue;
        }
        cursor.seek(encoding.payload_start)?;
        while cursor.position() < encoding.payload_end {
            let Some(child) = cursor.read_element(encoding.payload_end)? else {
                break;
            };
            if matches!(child.id, id::ENCODING_COMP_ALGO | id::ENCODING_ENC_ALGO) {
                encoded = true;
            }
            cursor.skip(child.payload_len());
        }
    }
    Ok(encoded)
}

/// Collects every video and audio frame in the segment, in decode order.
pub fn read_blocks(
    cursor: &mut Cursor,
    file_len: u64,
    header: &Header,
) -> io::Result<Vec<RawBlock>> {
    let mut blocks = Vec::new();

    cursor.seek(0)?;
    while let Some(element) = cursor.read_element(file_len)? {
        if element.id == id::SEGMENT {
            cursor.seek(element.payload_start)?;
            collect_clusters(cursor, element.payload_end, header, &mut blocks)?;
            return Ok(blocks);
        }
        cursor.skip(element.payload_len());
    }

    Ok(blocks)
}

fn collect_clusters(
    cursor: &mut Cursor,
    limit: u64,
    header: &Header,
    blocks: &mut Vec<RawBlock>,
) -> io::Result<()> {
    while cursor.position() < limit {
        let Some(element) = cursor.read_element(limit)? else {
            break;
        };
        if element.id != id::CLUSTER {
            // Cues, tags and attachments sit between clusters.
            cursor.skip(element.payload_len());
            continue;
        }
        read_cluster(cursor, &element, header, blocks)?;
    }
    Ok(())
}

fn read_cluster(
    cursor: &mut Cursor,
    element: &ebml::ElementHeader,
    header: &Header,
    blocks: &mut Vec<RawBlock>,
) -> io::Result<()> {
    cursor.seek(element.payload_start)?;

    let mut timecode: Option<i64> = None;
    let mut pending: Vec<RawBlock> = Vec::new();

    while cursor.position() < element.payload_end {
        let Some(child) = cursor.read_element(element.payload_end)? else {
            break;
        };
        match child.id {
            id::CLUSTER_TIMECODE => {
                let bytes = cursor.read_payload(&child)?;
                timecode = Some(ebml::read_uint(&bytes) as i64);
            }
            id::SIMPLE_BLOCK => {
                let head = parse_block(cursor, &child, BlockSource::Simple)?;
                if head.laced {
                    return Err(MatroskaError::LacedBlock(head.track_number).into());
                }
                pending.push(head.into_block(child.payload_start));
            }
            id::BLOCK_GROUP => {
                if let Some(block) = read_block_group(cursor, &child, header)? {
                    pending.push(block);
                }
            }
            _ => cursor.skip(child.payload_len()),
        }
    }

    let timecode = timecode.ok_or(MatroskaError::ClusterWithoutTimecode)?;
    for mut block in pending {
        block.timecode_ticks += timecode;
        blocks.push(block);
    }
    Ok(())
}

#[derive(Clone, Copy)]
enum BlockSource {
    /// The keyframe flag lives in the block itself.
    Simple,
    /// A block group decides by whether it references another block.
    Grouped,
}

struct ParsedBlockHead {
    track_number: u64,
    timecode_ticks: i64,
    head_len: u64,
    payload_len: u64,
    sync: bool,
    laced: bool,
}

impl ParsedBlockHead {
    fn into_block(self, block_start: u64) -> RawBlock {
        RawBlock {
            track_number: self.track_number,
            timecode_ticks: self.timecode_ticks,
            sync: self.sync,
            payload_start: block_start + self.head_len,
            payload_len: self.payload_len - self.head_len,
        }
    }
}

/// Reads a block's track number, its signed timecode relative to the cluster and
/// the flags byte, then steps past the whole block.
fn parse_block(
    cursor: &mut Cursor,
    element: &ebml::ElementHeader,
    source: BlockSource,
) -> io::Result<ParsedBlockHead> {
    cursor.seek(element.payload_start)?;
    let head = cursor.read_bytes(element.payload_len().min(11) as usize)?;
    cursor.seek(element.payload_end)?;

    let Some((size, head_len)) = ebml::read_data_size(&head) else {
        return Err(MatroskaError::TruncatedBlock.into());
    };
    let ebml::DataSize::Known(track_number) = size else {
        return Err(MatroskaError::TruncatedBlock.into());
    };
    if head.len() < head_len + 3 {
        return Err(MatroskaError::TruncatedBlock.into());
    }

    let flags = head[head_len + 2];
    Ok(ParsedBlockHead {
        track_number,
        timecode_ticks: ebml::read_int(&head[head_len..head_len + 2]),
        head_len: (head_len + 3) as u64,
        payload_len: element.payload_len(),
        sync: match source {
            BlockSource::Simple => flags & 0x80 != 0,
            BlockSource::Grouped => true,
        },
        laced: (flags >> 5) & 0x3 != 0,
    })
}

fn read_block_group(
    cursor: &mut Cursor,
    element: &ebml::ElementHeader,
    header: &Header,
) -> io::Result<Option<RawBlock>> {
    cursor.seek(element.payload_start)?;

    let mut block: Option<ParsedBlockHead> = None;
    let mut references = 0usize;

    while cursor.position() < element.payload_end {
        let Some(child) = cursor.read_element(element.payload_end)? else {
            break;
        };
        match child.id {
            id::BLOCK => block = Some(parse_block(cursor, &child, BlockSource::Grouped)?),
            // A per-frame duration override changes nothing: MP4 sample lengths come
            // from the timestamps, and this reader has no use for the override.
            id::BLOCK_DURATION => cursor.skip(child.payload_len()),
            id::REFERENCE_BLOCK => {
                cursor.skip(child.payload_len());
                references += 1;
            }
            _ => cursor.skip(child.payload_len()),
        }
    }

    // A group of additions only, which is how subtitle framing arrives, carries
    // no frame to index.
    let Some(mut head) = block else {
        return Ok(None);
    };
    if head.laced {
        return Err(MatroskaError::LacedBlock(head.track_number).into());
    }

    let is_video = header
        .track(head.track_number)
        .is_some_and(|track| track.kind == TrackKind::Video);
    if is_video {
        // References only describe which frames a prediction reads. MP4 carries no
        // reference graph, but a group that references is not a random access point.
        head.sync = references == 0;
    }

    Ok(Some(head.into_block(element.payload_start)))
}
