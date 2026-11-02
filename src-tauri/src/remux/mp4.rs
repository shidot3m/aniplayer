//! ISO BMFF writing: the boxes a demuxer reads before it touches `mdat`, for a
//! stream copy of one video track and, when the source had one, one audio track.
//!
//! Every box is written in place through `box_of` / `full_box_of`, which patch
//! the size afterwards: that keeps each layout here readable against ISO/IEC
//! 14496-12 and keeps the box sizes a function of counts only. Because sizes
//! never depend on offset values, the caller can measure the movie box once,
//! fill in chunk offsets, and rebuild it without the layout moving.

/// One frame or audio packet as MP4 records it.
#[derive(Debug, Clone, Copy)]
pub struct Sample {
    /// Duration in the track's timescale.
    pub duration: u32,
    /// Size of the sample once it sits inside `mdat`.
    pub size: u32,
    /// Presentation minus decode time, in the track's timescale.
    pub cts: u32,
    pub sync: bool,
    /// Where the bytes live in the source container.
    pub source_offset: u64,
    pub source_len: u64,
    /// Where the bytes land in the remuxed file.
    pub virtual_offset: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrackMedia {
    Video,
    Audio,
}

#[derive(Debug, Clone)]
pub struct TrackPlan {
    pub media: TrackMedia,
    pub timescale: u32,
    /// Sample entry fourcc: `avc1`, `hvc1` or `mp4a`.
    pub entry_fourcc: [u8; 4],
    pub width: u16,
    pub height: u16,
    pub channels: u16,
    /// Decoder configuration record without its own box header: the `avcC` or
    /// `hvcC` payload, or the AAC AudioSpecificConfig for `mp4a`.
    pub codec_config: Vec<u8>,
    pub samples: Vec<Sample>,
    /// Media time playback starts at, in the track's timescale. Non-zero when
    /// B-frames keep presentation behind decode order, or when the track's first
    /// samples sit before the container's zero and must be skipped.
    pub media_time: u64,
    /// How long the track plays nothing before its media begins, in the track's
    /// timescale. Non-zero when this track starts later than the episode does.
    pub start_delay: u64,
}

impl TrackPlan {
    /// Length of the media timeline, in the track's own timescale.
    pub fn duration(&self) -> u64 {
        self.samples
            .iter()
            .map(|sample| u64::from(sample.duration))
            .sum()
    }

    /// How long the track is actually on screen: the media timeline less the delay
    /// the edit list skips past, plus any blank time before the media begins.
    pub fn presentation_duration(&self) -> u64 {
        self.duration()
            .saturating_sub(self.media_time)
            .saturating_add(self.start_delay)
    }

    /// Time the track ends on the movie timeline, in movie timescale units.
    pub fn movie_duration(&self) -> u64 {
        self.presentation_duration() * u64::from(MOVIE_TIMESCALE) / u64::from(self.timescale.max(1))
    }

    pub fn payload_bytes(&self) -> u64 {
        self.samples
            .iter()
            .map(|sample| u64::from(sample.size))
            .sum::<u64>()
    }
}

fn u16(out: &mut Vec<u8>, value: u16) {
    out.extend_from_slice(&value.to_be_bytes());
}

fn u32(out: &mut Vec<u8>, value: u32) {
    out.extend_from_slice(&value.to_be_bytes());
}

fn zeros(out: &mut Vec<u8>, count: usize) {
    out.resize(out.len() + count, 0);
}

/// The 3x3 transform matrix in the fixed point ISO BMFF specifies: identity with
/// the final row scaled.
fn matrix(out: &mut Vec<u8>) {
    for row in [
        [0x0001_0000u32, 0, 0],
        [0, 0x0001_0000, 0],
        [0, 0, 0x4000_0000],
    ] {
        for value in row {
            u32(out, value);
        }
    }
}

/// Writes a box and patches its size once the body is complete.
fn box_of<F>(kind: &[u8; 4], write: F) -> Vec<u8>
where
    F: FnOnce(&mut Vec<u8>),
{
    let mut out = Vec::new();
    out.extend_from_slice(&[0, 0, 0, 0]);
    out.extend_from_slice(kind);
    write(&mut out);
    let size = u32::try_from(out.len()).unwrap_or(u32::MAX);
    out[0..4].copy_from_slice(&size.to_be_bytes());
    out
}

/// Same for a box carrying a version and three flag bytes.
fn full_box_of<F>(kind: &[u8; 4], version: u8, flags: u32, write: F) -> Vec<u8>
where
    F: FnOnce(&mut Vec<u8>),
{
    box_of(kind, |out| {
        u32(out, (u32::from(version) << 24) | (flags & 0x00FF_FFFF));
        write(out);
    })
}

fn ftyp_body(hevc: bool, out: &mut Vec<u8>) {
    out.extend_from_slice(b"isom");
    u32(out, 0x200);
    out.extend_from_slice(b"isomiso2mp41");
    if hevc {
        out.extend_from_slice(b"hvc1");
    }
}

/// `ftyp`: the brands a WebView2 demuxer accepts for a stream-copied file.
pub fn ftyp(hevc: bool) -> Vec<u8> {
    box_of(b"ftyp", |out| ftyp_body(hevc, out))
}

fn mvhd(duration: u64, track_count: u32) -> Vec<u8> {
    full_box_of(b"mvhd", 0, 0, |out| {
        u32(out, 0); // creation time
        u32(out, 0); // modification time
        u32(out, MOVIE_TIMESCALE);
        u32(out, clamp32(duration));
        u32(out, 0x0001_0000); // preferred rate
        u16(out, 0x0100); // preferred volume
        zeros(out, 10); // reserved
        matrix(out);
        zeros(out, 24); // pre_defined
        u32(out, track_count + 1); // next track id
    })
}

fn tkhd(track: &TrackPlan, track_id: u32) -> Vec<u8> {
    // enabled | in movie
    full_box_of(b"tkhd", 0, 0x03, |out| {
        u32(out, 0); // creation time
        u32(out, 0); // modification time
        u32(out, track_id);
        u32(out, 0); // reserved
                     // tkhd counts on the movie timeline, not the track's own.
        u32(out, clamp32(track.movie_duration()));
        zeros(out, 8); // reserved
        u16(out, 0); // layer
        u16(out, 0); // alternate group
        u16(
            out,
            if track.media == TrackMedia::Video {
                0
            } else {
                0x0100
            },
        ); // volume
        u16(out, 0); // reserved
        matrix(out);
        u32(out, u32::from(track.width) << 16);
        u32(out, u32::from(track.height) << 16);
    })
}

/// The edits this remux needs. MP4 cannot state a negative presentation time, so
/// an audio track's priming samples and a B-frame video track's composition delay
/// both become media to skip, and a track that begins later than the episode does
/// becomes blank time in front of its media.
fn edts(track: &TrackPlan) -> Vec<u8> {
    box_of(b"edts", |out| {
        out.extend(full_box_of(b"elst", 0, 0, |body| {
            let in_movie_timescale = |units: u64| {
                clamp32(units * u64::from(MOVIE_TIMESCALE) / u64::from(track.timescale.max(1)))
            };
            let media_length = track.duration().saturating_sub(track.media_time);
            let blank = track.start_delay > 0;
            u32(body, if blank { 2 } else { 1 });
            if blank {
                u32(body, in_movie_timescale(track.start_delay));
                u32(body, u32::MAX); // media time -1: nothing plays here
                u16(body, 1);
                u16(body, 0);
            }
            u32(body, in_movie_timescale(media_length));
            u32(body, clamp32(track.media_time)); // media time, track timescale
            u16(body, 1); // media rate integer
            u16(body, 0); // media rate fraction
        }));
    })
}

fn mdhd(track: &TrackPlan) -> Vec<u8> {
    full_box_of(b"mdhd", 0, 0, |out| {
        u32(out, 0); // creation time
        u32(out, 0); // modification time
        u32(out, track.timescale);
        u32(out, clamp32(track.duration()));
        u16(out, 0x55C4); // 'und'
        u16(out, 0); // pre_defined
    })
}

fn hdlr(handler: &[u8; 4], name: &str) -> Vec<u8> {
    full_box_of(b"hdlr", 0, 0, |out| {
        u32(out, 0); // pre_defined
        out.extend_from_slice(handler);
        zeros(out, 12); // reserved
        out.extend_from_slice(name.as_bytes());
        out.push(0);
    })
}

fn avc_c_or_hvc_c(track: &TrackPlan, out: &mut Vec<u8>) {
    let kind = match &track.entry_fourcc {
        b"avc1" => Some(b"avcC"),
        b"hvc1" => Some(b"hvcC"),
        _ => None,
    };
    if let Some(kind) = kind {
        out.extend(box_of(kind, |body| {
            body.extend_from_slice(&track.codec_config)
        }));
    }
}

fn visual_sample_entry(track: &TrackPlan) -> Vec<u8> {
    box_of(&track.entry_fourcc, |out| {
        zeros(out, 6); // reserved
        u16(out, 1); // data reference index
        u16(out, 0); // pre_defined
        u16(out, 0); // reserved
        zeros(out, 12); // pre_defined
        u16(out, track.width);
        u16(out, track.height);
        u32(out, 0x0048_0000); // horizontal resolution, 72 dpi
        u32(out, 0x0048_0000); // vertical resolution, 72 dpi
        u32(out, 0); // reserved
        u16(out, 1); // frame count
        let mut name = [0u8; 32];
        let label = b"Aniplayer stream copy";
        name[0] = label.len() as u8;
        name[1..1 + label.len()].copy_from_slice(label);
        out.extend_from_slice(&name);
        u16(out, 24); // bit depth
        u16(out, 0xFFFF); // pre_defined
        avc_c_or_hvc_c(track, out);
    })
}

/// `mp4a` and friends. The eight legacy QuickTime bytes between the data
/// reference index and the channel count are part of the shape every demuxer
/// reads: the sample description is a Sound Description, not the bare
/// ISO sample entry, and Chromium and FFmpeg both count those bytes.
fn audio_sample_entry(track: &TrackPlan) -> Vec<u8> {
    box_of(&track.entry_fourcc, |out| {
        zeros(out, 6); // reserved
        u16(out, 1); // data reference index
        u16(out, 0); // version
        u16(out, 0); // revision level
        u32(out, 0); // vendor
        u16(out, track.channels.max(1)); // channel count
        u16(out, 16); // sample size
        u16(out, 0); // pre_defined / compression id
        u16(out, 0); // packet size
                     // Sample rate as 16.16 fixed point. A rate above 65535 Hz has no integer
                     // half in that field, and FFmpeg writes zero for it: the AudioSpecificConfig
                     // in `esds` carries the real rate.
        u32(
            out,
            if track.timescale > u16::MAX as u32 {
                0
            } else {
                track.timescale << 16
            },
        );
        out.extend(esds(&track.codec_config));
    })
}

fn stsd(track: &TrackPlan) -> Vec<u8> {
    full_box_of(b"stsd", 0, 0, |out| {
        u32(out, 1); // entry count
        out.extend(if track.media == TrackMedia::Video {
            visual_sample_entry(track)
        } else {
            audio_sample_entry(track)
        });
    })
}

/// Compresses a table of equal neighbours into run-length entries.
fn runs(values: &[u32]) -> Vec<(u32, u32)> {
    let mut table: Vec<(u32, u32)> = Vec::new();
    for value in values {
        match table.last_mut() {
            Some((count, previous)) if previous == value => *count += 1,
            _ => table.push((1, *value)),
        }
    }
    table
}

fn stts(samples: &[Sample]) -> Vec<u8> {
    let table = runs(
        &samples
            .iter()
            .map(|sample| sample.duration)
            .collect::<Vec<_>>(),
    );
    full_box_of(b"stts", 0, 0, |out| {
        u32(out, table.len() as u32);
        for (count, delta) in table {
            u32(out, count);
            u32(out, delta);
        }
    })
}

fn ctts(samples: &[Sample]) -> Option<Vec<u8>> {
    if samples.iter().all(|sample| sample.cts == 0) {
        return None;
    }
    let table = runs(&samples.iter().map(|sample| sample.cts).collect::<Vec<_>>());
    Some(full_box_of(b"ctts", 0, 0, |out| {
        u32(out, table.len() as u32);
        for (count, offset) in table {
            u32(out, count);
            u32(out, offset);
        }
    }))
}

/// Sync sample list. Omitted when every sample is a random access point, which
/// is what the absence of this box means.
fn stss(samples: &[Sample]) -> Option<Vec<u8>> {
    if samples.iter().all(|sample| sample.sync) {
        return None;
    }
    let sync: Vec<u32> = samples
        .iter()
        .enumerate()
        .filter(|(_, sample)| sample.sync)
        .map(|(index, _)| index as u32 + 1)
        .collect();
    Some(full_box_of(b"stss", 0, 0, |out| {
        u32(out, sync.len() as u32);
        for number in sync {
            u32(out, number);
        }
    }))
}

/// One sample per chunk, which is what a stream copy hands over.
fn stsc() -> Vec<u8> {
    full_box_of(b"stsc", 0, 0, |out| {
        u32(out, 1); // entry count
        u32(out, 1); // first chunk
        u32(out, 1); // samples per chunk
        u32(out, 1); // sample description index
    })
}

fn stsz(samples: &[Sample]) -> Vec<u8> {
    let sizes: Vec<u32> = samples.iter().map(|sample| sample.size).collect();
    let uniform = sizes.windows(2).all(|pair| pair[0] == pair[1]);
    full_box_of(b"stsz", 0, 0, |out| {
        if uniform && !sizes.is_empty() {
            u32(out, sizes[0]);
            u32(out, 0);
        } else {
            u32(out, 0);
            u32(out, sizes.len() as u32);
            for size in sizes {
                u32(out, size);
            }
        }
    })
}

/// Chunk offsets: `stco` while they fit 32 bits, `co64` past that.
fn chunk_offsets(samples: &[Sample]) -> Vec<u8> {
    let offsets: Vec<u64> = samples.iter().map(|sample| sample.virtual_offset).collect();
    let wide = offsets.iter().any(|offset| *offset > u64::from(u32::MAX));
    if wide {
        full_box_of(b"co64", 0, 0, |out| {
            u32(out, offsets.len() as u32);
            for offset in offsets {
                out.extend_from_slice(&offset.to_be_bytes());
            }
        })
    } else {
        full_box_of(b"stco", 0, 0, |out| {
            u32(out, offsets.len() as u32);
            for offset in offsets {
                u32(out, offset as u32);
            }
        })
    }
}

fn stbl(track: &TrackPlan) -> Vec<u8> {
    box_of(b"stbl", |out| {
        out.extend(stsd(track));
        out.extend(stts(&track.samples));
        out.extend(ctts(&track.samples).unwrap_or_default());
        out.extend(stss(&track.samples).unwrap_or_default());
        out.extend(stsc());
        out.extend(stsz(&track.samples));
        out.extend(chunk_offsets(&track.samples));
    })
}

fn minf(track: &TrackPlan) -> Vec<u8> {
    box_of(b"minf", |out| {
        if track.media == TrackMedia::Video {
            // vmhd carries flags 1: no predecessor.
            out.extend(full_box_of(b"vmhd", 0, 1, |body| {
                u16(body, 0); // graphics mode
                u16(body, 0); // opcolor red
                u16(body, 0); // opcolor green
                u16(body, 0); // opcolor blue
            }));
        } else {
            out.extend(full_box_of(b"smhd", 0, 0, |body| {
                u16(body, 0); // balance
                u16(body, 0); // reserved
            }));
        }
        out.extend(box_of(b"dinf", |dinf| {
            dinf.extend(full_box_of(b"dref", 0, 0, |dref| {
                u32(dref, 1); // entry count
                dref.extend(full_box_of(b"url ", 0, 1, |_| {})); // self-contained
            }));
        }));
        out.extend(stbl(track));
    })
}

fn mdia(track: &TrackPlan) -> Vec<u8> {
    box_of(b"mdia", |out| {
        out.extend(mdhd(track));
        out.extend(hdlr(
            if track.media == TrackMedia::Video {
                b"vide"
            } else {
                b"soun"
            },
            if track.media == TrackMedia::Video {
                "VideoHandler"
            } else {
                "SoundHandler"
            },
        ));
        out.extend(minf(track));
    })
}

fn trak(track: &TrackPlan, track_id: u32) -> Vec<u8> {
    box_of(b"trak", |out| {
        out.extend(tkhd(track, track_id));
        if track.media_time > 0 || track.start_delay > 0 {
            out.extend(edts(track));
        }
        out.extend(mdia(track));
    })
}

/// The movie timescale, chosen so frame durations land on whole microseconds.
pub const MOVIE_TIMESCALE: u32 = 1_000_000;

/// `moov`: movie header, the video track, and the audio track when there is one.
pub fn moov(video: &TrackPlan, audio: Option<&TrackPlan>) -> Vec<u8> {
    let track_count = if audio.is_some() { 2 } else { 1 };
    box_of(b"moov", |out| {
        let movie_duration = video
            .movie_duration()
            .max(audio.map(TrackPlan::movie_duration).unwrap_or(0));
        out.extend(mvhd(movie_duration, track_count));
        out.extend(trak(video, 1));
        if let Some(audio) = audio {
            out.extend(trak(audio, 2));
        }
    })
}

/// `mdat` header. The 64-bit size form is used once the payload outgrows 32 bits.
pub fn mdat_header(payload_bytes: u64) -> Vec<u8> {
    if payload_bytes.saturating_add(8) <= u64::from(u32::MAX) {
        let mut out = Vec::with_capacity(8);
        out.extend_from_slice(
            &u32::try_from(payload_bytes + 8)
                .unwrap_or_default()
                .to_be_bytes(),
        );
        out.extend_from_slice(b"mdat");
        out
    } else {
        let mut out = Vec::with_capacity(16);
        out.extend_from_slice(&1u32.to_be_bytes());
        out.extend_from_slice(b"mdat");
        out.extend_from_slice(&(payload_bytes + 16).to_be_bytes());
        out
    }
}

/// `esds` wrapping an AAC AudioSpecificConfig.
fn esds(audio_specific_config: &[u8]) -> Vec<u8> {
    full_box_of(b"esds", 0, 0, |out| {
        let mut decoder = Vec::new();
        decoder.push(0x40); // MPEG-4 audio object type indication
        decoder.push(0x14); // stream type audio, upstream false
        decoder.extend_from_slice(&[0x00, 0x10, 0x00]); // buffer size
        decoder.extend_from_slice(&0x0002_0000u32.to_be_bytes()); // max bitrate
        decoder.extend_from_slice(&0x0002_0000u32.to_be_bytes()); // average bitrate
        decoder.extend(descriptor(0x05, audio_specific_config));
        decoder.extend(descriptor(0x06, &[0x02])); // SL config

        let mut elementary = Vec::new();
        elementary.extend_from_slice(&0u16.to_be_bytes()); // ES id
        elementary.push(0x00); // no depends, no OCR, no URL
        elementary.extend(descriptor(0x04, &decoder));

        out.extend(descriptor(0x03, &elementary));
    })
}

/// An ISO/IEC 14496-1 descriptor in the three-byte length form players expect:
/// seven value bits per byte, the high bit meaning "another byte follows".
fn descriptor(tag: u8, body: &[u8]) -> Vec<u8> {
    let length = body.len();
    let mut out = Vec::with_capacity(4 + length);
    out.push(tag);
    out.push(0x80 | ((length >> 14) as u8 & 0x7F));
    out.push(0x80 | ((length >> 7) as u8 & 0x7F));
    out.push((length & 0x7F) as u8);
    out.extend_from_slice(body);
    out
}

fn clamp32(value: u64) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}
