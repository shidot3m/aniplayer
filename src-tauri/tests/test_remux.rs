//! Hermetic checks for the Matroska to MP4 stream copy, run against small real
//! files encoded with x264, x265, AAC and Opus.

use aniplayer_lib::codec::CodecFamily;
use aniplayer_lib::remux::ebml::Cursor;
use aniplayer_lib::remux::matroska::{read_blocks, read_header, TrackKind};
use aniplayer_lib::remux::{self, Container, RemuxError};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

fn fixture(name: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join(name)
}

/// Reads the whole virtual file in fixed-size windows.
fn read_whole(plan: &remux::Plan, chunk: u64) -> Vec<u8> {
    let mut out = Vec::new();
    let mut offset = 0u64;
    while offset < plan.len() {
        let want = chunk.min(plan.len() - offset);
        let bytes = plan.read_range(offset, want).unwrap();
        assert!(!bytes.is_empty(), "a read must advance");
        out.extend_from_slice(&bytes);
        offset += bytes.len() as u64;
    }
    out
}

fn be_u32(bytes: &[u8], at: usize) -> u32 {
    u32::from_be_bytes(bytes[at..at + 4].try_into().unwrap())
}

/// Top-level boxes of an MP4 file as (fourcc, offset, size).
fn top_level(bytes: &[u8]) -> Vec<([u8; 4], usize, usize)> {
    let mut out = Vec::new();
    let mut index = 0usize;
    while index + 8 <= bytes.len() {
        let size = be_u32(bytes, index) as usize;
        let kind: [u8; 4] = bytes[index + 4..index + 8].try_into().unwrap();
        assert!(
            size >= 8,
            "the box at {index} claims a size below its header"
        );
        assert!(
            index + size <= bytes.len(),
            "the box at {index} runs past the file"
        );
        out.push((kind, index, size));
        index += size;
    }
    assert_eq!(index, bytes.len(), "the last box must end the file");
    out
}

/// Offset of the box at the end of a path of fourccs, walking box headers from the
/// top level down. The test reads the file the way a demuxer would instead of
/// grepping for fourccs that frame payloads can also spell, and it does not reuse
/// the writer's own layout code.
fn find_box(bytes: &[u8], path: &[&[u8; 4]]) -> Option<usize> {
    let (wanted, rest) = path.split_first()?;
    let mut cursor = 0usize;
    while cursor + 8 <= bytes.len() {
        let size = be_u32(bytes, cursor) as usize;
        let kind: [u8; 4] = bytes[cursor + 4..cursor + 8].try_into().unwrap();
        assert!(size >= 8, "a box cannot be shorter than its header");
        assert!(
            cursor + size <= bytes.len(),
            "a box cannot run past the file"
        );
        if &kind == *wanted {
            return if rest.is_empty() {
                Some(cursor)
            } else {
                find_box(&bytes[cursor + 8..cursor + size], rest).map(|inside| cursor + 8 + inside)
            };
        }
        cursor += size;
    }
    None
}

fn box_at(bytes: &[u8], path: &[&[u8; 4]]) -> usize {
    find_box(bytes, path).unwrap_or_else(|| {
        panic!(
            "no {} box in the remuxed file",
            String::from_utf8_lossy(*path.last().unwrap())
        )
    })
}

fn source_blocks(
    path: &Path,
) -> (
    aniplayer_lib::remux::matroska::Header,
    Vec<aniplayer_lib::remux::matroska::RawBlock>,
) {
    let file = std::fs::File::open(path).expect("fixture must open");
    let len = file.metadata().expect("metadata").len();
    let mut cursor = Cursor::new(file).expect("cursor");
    let header = read_header(&mut cursor, len).expect("header");
    let blocks = read_blocks(&mut cursor, len, &header).expect("blocks");
    (header, blocks)
}

/// Track numbers of the tracks a player would decode.
fn playable_tracks(header: &aniplayer_lib::remux::matroska::Header) -> Vec<u64> {
    header
        .tracks
        .iter()
        .filter(|track| matches!(track.kind, TrackKind::Video | TrackKind::Audio))
        .map(|track| track.number)
        .collect()
}

/// The fixtures each have exactly one picture track.
fn video_track(header: &aniplayer_lib::remux::matroska::Header) -> u64 {
    header
        .tracks
        .iter()
        .find(|track| track.kind == TrackKind::Video)
        .expect("the fixture has a video track")
        .number
}

fn read_slice(path: &Path, offset: u64, len: u64) -> Vec<u8> {
    let mut file = std::fs::File::open(path).expect("fixture must open");
    file.seek(SeekFrom::Start(offset)).expect("seek");
    let mut buffer = vec![0u8; len as usize];
    file.read_exact(&mut buffer).expect("read");
    buffer
}

#[test]
fn sniffing_names_the_container_and_the_codecs_inside() {
    let h264 = remux::sniff_streams(&fixture("h264_aac.mkv")).expect("h264_aac.mkv must sniff");
    assert_eq!(h264.container, Container::Matroska);
    assert_eq!(h264.video, Some(CodecFamily::H264));
    assert_eq!(h264.audio, vec![CodecFamily::Aac]);
    assert!(
        h264.names_every_track(),
        "unknown codecs: {:?}",
        h264.unknown_codecs
    );

    let hevc = remux::sniff_streams(&fixture("hevc_aac.mkv")).expect("must sniff");
    assert_eq!(hevc.video, Some(CodecFamily::Hevc));

    let opus = remux::sniff_streams(&fixture("h264_opus.mkv")).expect("must sniff");
    assert_eq!(opus.video, Some(CodecFamily::H264));
    assert_eq!(opus.audio, vec![CodecFamily::Opus]);

    let mp4 = remux::sniff_streams(&fixture("h264_aac.mp4")).expect("must sniff");
    assert_eq!(mp4.container, Container::Mp4);
    assert_eq!(mp4.video, Some(CodecFamily::H264));
    assert_eq!(mp4.audio, vec![CodecFamily::Aac]);

    let webm = remux::sniff_streams(&fixture("vp9.webm")).expect("must sniff");
    assert_eq!(webm.container, Container::Matroska);
    assert_eq!(webm.video, Some(CodecFamily::Vp9));
}

#[test]
fn matroska_h264_remuxes_into_a_faststart_mp4() {
    let source = fixture("h264_aac.mkv");
    let plan = remux::Plan::build(&source).expect("an H.264 Matroska file must remux");
    assert_eq!(plan.video_codec, CodecFamily::H264);
    assert_eq!(plan.audio_codec, Some(CodecFamily::Aac));

    let bytes = read_whole(&plan, 4096);
    assert_eq!(
        bytes.len() as u64,
        plan.len(),
        "the virtual file reads to its length"
    );

    let boxes = top_level(&bytes);
    let names: Vec<[u8; 4]> = boxes.iter().map(|(kind, _, _)| *kind).collect();
    assert_eq!(
        names,
        vec![*b"ftyp", *b"moov", *b"mdat"],
        "moov must precede mdat"
    );

    let stsd = box_at(
        &bytes,
        &[b"moov", b"trak", b"mdia", b"minf", b"stbl", b"stsd"],
    );
    let entry_fourcc: [u8; 4] = bytes[stsd + 20..stsd + 24].try_into().unwrap();
    assert_eq!(&entry_fourcc, b"avc1", "the video sample entry");
    assert!(
        bytes[stsd..stsd + 4096]
            .windows(4)
            .any(|window| window == b"avcC"),
        "the avcC record must be carried"
    );
    assert!(
        declares(&bytes, b"mp4a"),
        "the audio track must be described too"
    );
}

/// True when the container, excluding any frame data, declares this fourcc.
fn declares(bytes: &[u8], fourcc: &[u8; 4]) -> bool {
    let (_, mdat_at, _) = top_level(bytes)
        .into_iter()
        .find(|(kind, _, _)| kind == b"mdat")
        .expect("mdat");
    bytes[..mdat_at].windows(4).any(|window| window == fourcc)
}

/// The payload of the remuxed file is the frames of every playable track, in the
/// order the source stored them, with nothing between them. Samples of the two
/// tracks interleave inside `mdat`, so contiguity is checked per sample table, not
/// here.
#[test]
fn mdat_carries_the_source_frames_and_nothing_else() {
    let source = fixture("h264_aac.mkv");
    let plan = remux::Plan::build(&source).expect("remux must succeed");
    let bytes = read_whole(&plan, 1 << 20);
    assert_eq!(
        bytes.len() as u64,
        plan.len(),
        "the file reads to its length"
    );

    let (header, blocks) = source_blocks(&source);
    let playable = playable_tracks(&header);
    let mut frames: Vec<&_> = blocks
        .iter()
        .filter(|block| playable.contains(&block.track_number))
        .collect();
    frames.sort_by_key(|block| block.payload_start);
    assert!(frames.len() > 2, "both tracks must contribute frames");

    let (_, mdat_at, mdat_size) = top_level(&bytes)
        .into_iter()
        .find(|(kind, _, _)| kind == b"mdat")
        .expect("mdat");
    let payload_at = mdat_at + 8;
    assert_eq!(
        payload_at + mdat_size - 8,
        bytes.len(),
        "mdat must run to the end of the file"
    );

    let mut expected: Vec<u8> = Vec::new();
    for block in &frames {
        expected.extend_from_slice(&read_slice(&source, block.payload_start, block.payload_len));
    }
    assert_eq!(
        &bytes[payload_at..],
        expected.as_slice(),
        "the payload is the source frames, concatenated in order"
    );
}

#[test]
fn every_sample_sits_where_the_sample_table_says() {
    let source = fixture("h264_aac.mkv");
    let plan = remux::Plan::build(&source).expect("remux must succeed");
    let bytes = read_whole(&plan, 1 << 20);

    let stsz = box_at(
        &bytes,
        &[b"moov", b"trak", b"mdia", b"minf", b"stbl", b"stsz"],
    );
    let stco = box_at(
        &bytes,
        &[b"moov", b"trak", b"mdia", b"minf", b"stbl", b"stco"],
    );
    let count = be_u32(&bytes, stsz + 16) as usize;
    assert!(count > 0, "the copied track must hold samples");
    assert_eq!(
        count,
        be_u32(&bytes, stco + 12) as usize,
        "one chunk per sample"
    );

    let uniform = be_u32(&bytes, stsz + 12);
    let sizes: Vec<u32> = (0..count)
        .map(|index| {
            if uniform == 0 {
                be_u32(&bytes, stsz + 20 + index * 4)
            } else {
                uniform
            }
        })
        .collect();
    let offsets: Vec<u32> = (0..count)
        .map(|index| be_u32(&bytes, stco + 16 + index * 4))
        .collect();

    let (_, mdat_at, mdat_size) = top_level(&bytes)
        .into_iter()
        .find(|(kind, _, _)| kind == b"mdat")
        .expect("mdat");
    let payload_at = mdat_at as u32 + 8;
    let payload_end = mdat_at as u32 + mdat_size as u32;

    let mut previous_end = payload_at;
    for (index, (offset, size)) in offsets.iter().zip(&sizes).enumerate() {
        let offset = *offset;
        let size = *size;
        assert!(
            offset >= previous_end,
            "sample {index} must not land on the one before it"
        );
        assert!(
            offset + size <= payload_end,
            "sample {index} must stay inside mdat"
        );
        previous_end = offset + size;
    }
}

#[test]
fn copied_frames_are_the_source_frames_with_nothing_added_or_dropped() {
    let source = fixture("h264_aac.mkv");
    let plan = remux::Plan::build(&source).expect("remux must succeed");
    let bytes = read_whole(&plan, 64 * 1024);

    let (header, blocks) = source_blocks(&source);
    let video_number = video_track(&header);
    let video_blocks: Vec<_> = blocks
        .iter()
        .filter(|block| block.track_number == video_number)
        .collect();

    let stsz = box_at(
        &bytes,
        &[b"moov", b"trak", b"mdia", b"minf", b"stbl", b"stsz"],
    );
    let stco = box_at(
        &bytes,
        &[b"moov", b"trak", b"mdia", b"minf", b"stbl", b"stco"],
    );
    let count = be_u32(&bytes, stsz + 16) as usize;
    assert_eq!(count, video_blocks.len(), "one MP4 sample per video frame");

    for (index, block) in video_blocks.iter().enumerate() {
        let offset = be_u32(&bytes, stco + 16 + index * 4) as usize;
        let size = be_u32(&bytes, stsz + 20 + index * 4) as usize;
        let original = read_slice(&source, block.payload_start, block.payload_len);
        assert_eq!(size as u64, original.len() as u64, "sample {index} size");
        assert_eq!(
            &bytes[offset..offset + size],
            original.as_slice(),
            "sample {index} must carry the source frame byte for byte"
        );
    }
}

/// A Matroska file that stores frames with Annex-B start codes breaks the
/// container's own framing rule. The reader says so instead of quietly writing a
/// bitstream MP4 cannot describe.
#[test]
fn annex_b_framed_matroska_is_refused_by_name() {
    let folder =
        std::env::temp_dir().join(format!("aniplayer-remux-annexb-{}", std::process::id()));
    std::fs::create_dir_all(&folder).expect("temp folder");
    let path = folder.join("annexb.mkv");
    std::fs::write(&path, annex_b_matroska()).expect("fixture must be writable");

    let error = remux::Plan::build(&path).expect_err("Annex-B framing must be refused");
    assert!(
        matches!(error, RemuxError::UnexpectedBitstream),
        "the refusal must name the framing: {error}"
    );
    let _ = std::fs::remove_file(&path);
    let _ = std::fs::remove_dir_all(&folder);
}

/// Writes the smallest Matroska file the reader accepts: one H.264 video track
/// whose single frame starts with an Annex-B start code.
fn annex_b_matroska() -> Vec<u8> {
    fn element(id: &[u8], payload: &[u8]) -> Vec<u8> {
        let mut out = id.to_vec();
        // Sizes below 127 fit a one-byte length descriptor with its marker set.
        assert!(payload.len() < 127, "this writer only needs short elements");
        out.push(0x80 | payload.len() as u8);
        out.extend_from_slice(payload);
        out
    }

    // Track number, relative timecode 0, and the keyframe flag.
    let mut frame = vec![0x81, 0x00, 0x00, 0x80];
    frame.extend_from_slice(&[0x00, 0x00, 0x00, 0x01, 0x67, 0x42, 0x00, 0x1E]);

    let cluster = element(
        &[0x1F, 0x43, 0xB6, 0x75],
        &element(&[0xE7], &[0x00])
            .into_iter()
            .chain(element(&[0xA3], &frame))
            .collect::<Vec<u8>>(),
    );

    // A configuration record the reader will accept: version 1 followed by body.
    let codec_private = [1u8, 2, 3, 4, 5, 6, 7, 8];
    let track_entry = element(
        &[0xD7],
        &[1], // TrackNumber
    )
    .into_iter()
    .chain(element(&[0x83], &[1])) // TrackType video
    .chain(element(&[0x86], b"V_MPEG4/ISO/AVC")) // CodecID
    .chain(element(&[0x63, 0xA2], &codec_private)) // CodecPrivate
    .chain(element(
        &[0x23, 0xE3, 0x83],
        &[0x02, 0x75, 0x6B, 0xDA], // DefaultDuration, 41.7 ms
    ))
    .chain(element(&[0xE0], &[0x00])) // Video
    .collect::<Vec<u8>>();
    let track_entry = element(&[0xAE], &track_entry);
    let tracks = element(&[0x16, 0x54, 0xAE, 0x6B], &track_entry);

    let info = element(
        &[0x15, 0x49, 0xA9, 0x66],
        &element(&[0x2A, 0xD7, 0xB1], &[0x0F, 0x42, 0x40]), // TimecodeScale 1e6 ns
    );

    let segment_payload = info
        .into_iter()
        .chain(tracks)
        .chain(cluster)
        .collect::<Vec<u8>>();
    let mut segment = vec![0x18, 0x53, 0x80, 0x67];
    // Unknown-size marker: the segment runs to the end of the file.
    segment.push(0xFF);
    let mut file = element(
        &[0x1A, 0x45, 0xDF, 0xA3],
        &element(&[0x42, 0x82], b"matroska"),
    );
    file.extend_from_slice(&segment);
    file.extend_from_slice(&segment_payload);
    file
}

/// A track that ends before its last picture has been shown loses that picture in
/// players that trim at the stated duration. Out-of-order frames push the media
/// timeline past the presentation window by the composition delay, and the delay
/// has to be accounted for twice: in the edit list and in the sample durations.
#[test]
fn the_reported_duration_reaches_the_last_picture() {
    let source = fixture("h264_aac.mkv");
    let plan = remux::Plan::build(&source).expect("remux must succeed");
    let bytes = read_whole(&plan, 1 << 20);

    let (header, blocks) = source_blocks(&source);
    let video_number = video_track(&header);
    let ticks: Vec<i64> = blocks
        .iter()
        .filter(|block| block.track_number == video_number)
        .map(|block| block.timecode_ticks)
        .collect();
    let span_us = (ticks.iter().max().expect("frames") - ticks.iter().min().expect("frames"))
        * header.timecode_scale_ns as i64
        / 1_000;
    let frame_us = span_us / (ticks.len() as i64 - 1);

    // The video track is the first of each pair, so the first mdhd and elst are its.
    // mdhd: 8 box header, 4 version/flags, 4 creation, 4 modification, then
    // timescale and duration.
    let mdhd = box_at(&bytes, &[b"moov", b"trak", b"mdia", b"mdhd"]);
    let media_us =
        u64::from(be_u32(&bytes, mdhd + 24)) * 1_000_000 / u64::from(be_u32(&bytes, mdhd + 20));
    // elst: 8 box header, 4 version/flags, 4 entry count, then the segment
    // duration in movie timescale and the media time in the track's own.
    let elst = box_at(&bytes, &[b"moov", b"trak", b"edts", b"elst"]);
    let segment_us = u64::from(be_u32(&bytes, elst + 16));
    let delay_us = u64::from(be_u32(&bytes, elst + 20));
    assert!(
        delay_us > 0,
        "frames out of display order need a delay to skip"
    );
    assert_eq!(
        media_us - delay_us,
        segment_us,
        "the edit must cover exactly what the media timeline plays after its delay"
    );
    assert!(
        segment_us as i64 >= span_us + frame_us,
        "the video track closes at {} ms, but its last picture is shown at {} ms plus a frame of {} ms",
        segment_us / 1_000,
        span_us / 1_000,
        frame_us / 1_000
    );
    assert!(
        plan.duration_us >= segment_us,
        "the movie must be at least as long as the track it carries"
    );
}

/// Children of a box, in file order, as (fourcc, offset, size).
fn children(bytes: &[u8], at: usize) -> Vec<([u8; 4], usize, usize)> {
    let size = be_u32(bytes, at) as usize;
    let mut out = Vec::new();
    let mut cursor = at + 8;
    while cursor + 8 <= at + size {
        let child_size = be_u32(bytes, cursor) as usize;
        assert!(
            child_size >= 8,
            "the box at {cursor} inside the box at {at} is shorter than its own header"
        );
        assert!(
            cursor + child_size <= at + size,
            "a box cannot outrun its parent"
        );
        let kind: [u8; 4] = bytes[cursor + 4..cursor + 8].try_into().unwrap();
        out.push((kind, cursor, child_size));
        cursor += child_size;
    }
    out
}

fn child(bytes: &[u8], at: usize, kind: &[u8; 4]) -> Option<(usize, usize)> {
    children(bytes, at)
        .into_iter()
        .find(|(found, _, _)| found == kind)
        .map(|(_, offset, size)| (offset, size))
}

/// The handler type of a track, four bytes inside the `hdlr` box under its media
/// box.
fn handler(bytes: &[u8], trak_at: usize) -> Option<[u8; 4]> {
    let (mdia, _) = child(bytes, trak_at, b"mdia")?;
    let (hdlr, _) = child(bytes, mdia, b"hdlr")?;
    Some(bytes[hdlr + 16..hdlr + 20].try_into().unwrap())
}

/// AAC hands the decoder its encoder delay as a frame at the start of the track,
/// and a native MP4 skips it through the edit list. Skipping it is what keeps the
/// audio in step with the picture, so the remux has to do the same.
#[test]
fn an_aac_track_skips_the_priming_sample_the_way_a_native_mp4_does() {
    let plan = remux::Plan::build(&fixture("h264_aac.mkv")).expect("remux must succeed");
    let bytes = read_whole(&plan, 1 << 20);

    let (_, moov_at, _) = top_level(&bytes)
        .into_iter()
        .find(|(kind, _, _)| kind == b"moov")
        .expect("moov");
    let (_, audio_at, _) = children(&bytes, moov_at)
        .into_iter()
        .filter(|(kind, _, _)| kind == b"trak")
        .find(|(_, at, _)| handler(&bytes, *at) == Some(*b"soun"))
        .expect("the episode carries an audio track");

    let (mdia, _) = child(&bytes, audio_at, b"mdia").expect("the audio track carries media");
    let (mdhd, _) = child(&bytes, mdia, b"mdhd").expect("mdhd");
    let timescale = u64::from(be_u32(&bytes, mdhd + 20));
    let media = u64::from(be_u32(&bytes, mdhd + 24));

    let (edts, _) =
        child(&bytes, audio_at, b"edts").expect("the audio track edits its priming away");
    let (elst, _) = child(&bytes, edts, b"elst").expect("elst");
    assert_eq!(
        be_u32(&bytes, elst + 12),
        1,
        "a track that begins with the episode needs one edit, not a blank stretch"
    );
    // elst: 8 box header, 4 version/flags, 4 entry count, then 4 segment duration,
    // 4 media time, 4 rate.
    let skipped = u64::from(be_u32(&bytes, elst + 20));
    assert_eq!(
        skipped, 1024,
        "one AAC-LC frame of encoder delay is skipped, in the track's own timescale"
    );

    let played_us = (media - skipped) * 1_000_000 / timescale;
    assert_eq!(
        plan.duration_us, played_us,
        "the episode lasts as long as the audio it actually plays, not its priming too"
    );

    // One run in the duration table means every frame is the same length, which is
    // what keeps the track's own clock in step with the samples it decodes.
    let (minf, _) = child(&bytes, mdia, b"minf").expect("minf");
    let (stbl, _) = child(&bytes, minf, b"stbl").expect("stbl");
    let (stts, _) = child(&bytes, stbl, b"stts").expect("stts");
    assert_eq!(
        be_u32(&bytes, stts + 12),
        1,
        "frames of one constant length are described by a single run"
    );
    assert_eq!(
        be_u32(&bytes, stts + 20),
        1024,
        "an AAC-LC frame is 1024 samples, not the container's rounded milliseconds"
    );
}

#[test]
fn hevc_remuxes_with_the_tag_hardware_decoders_accept() {
    let plan = remux::Plan::build(&fixture("hevc_aac.mkv")).expect("HEVC must remux");
    let bytes = read_whole(&plan, 1 << 16);

    let stsd = box_at(
        &bytes,
        &[b"moov", b"trak", b"mdia", b"minf", b"stbl", b"stsd"],
    );
    let fourcc: [u8; 4] = bytes[stsd + 20..stsd + 24].try_into().unwrap();
    assert_eq!(&fourcc, b"hvc1", "HEVC lands in the hvc1 entry");
    assert!(
        bytes[stsd..stsd + 4096]
            .windows(4)
            .any(|window| window == b"hvcC"),
        "the hvcC record must be carried"
    );
    assert!(
        bytes[..64].windows(4).any(|window| window == b"hvc1"),
        "the file must declare the hvc1 brand"
    );
}

#[test]
fn audio_mp4_cannot_carry_is_refused_rather_than_guessed() {
    let error =
        remux::Plan::build(&fixture("h264_opus.mkv")).expect_err("Opus in MP4 must not build");
    assert!(
        matches!(&error, RemuxError::CodecNotMappable(codec) if codec == "A_OPUS"),
        "the refusal must name the codec: {error}"
    );
}

#[test]
fn any_window_of_the_virtual_file_matches_the_whole_read() {
    let plan = remux::Plan::build(&fixture("h264_aac.mkv")).expect("remux must succeed");
    let whole = plan.read_range(0, plan.len()).expect("whole read");
    assert_eq!(whole.len() as u64, plan.len());
    assert_eq!(&whole[4..8], b"ftyp");

    // A window that starts and ends inside samples.
    let start = plan.len() / 2;
    let width = 5_000.min(plan.len() - start);
    let window = plan.read_range(start, width).expect("window read");
    assert_eq!(window, whole[start as usize..(start + width) as usize]);

    let tail = plan.read_range(plan.len() - 10, 10_000).expect("tail read");
    assert_eq!(tail, whole[(plan.len() - 10) as usize..]);

    assert!(plan
        .read_range(plan.len(), 10)
        .expect("past the end")
        .is_empty());
}
