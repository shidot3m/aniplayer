//! The serving half of the remux: a virtual MP4 addressed by a token, read by byte
//! range, with nothing written to disk.

use aniplayer_lib::remux::RemuxService;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::http::header;
use tauri::http::{Request, StatusCode};

fn fixtures() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
}

fn request(uri: &str, range: Option<&str>) -> Request<Vec<u8>> {
    let mut builder = Request::builder().method("GET").uri(uri);
    if let Some(range) = range {
        builder = builder.header(header::RANGE, range);
    }
    builder
        .body(Vec::new())
        .expect("a test request is always well formed")
}

fn count_files(root: &Path) -> usize {
    fs::read_dir(root)
        .expect("the fixture folder must be readable")
        .flatten()
        .filter(|entry| entry.path().is_file())
        .count()
}

fn prepare(service: &RemuxService, name: &str) -> Result<u64, String> {
    service
        .prepare(&fixtures(), &fixtures().join(name).to_string_lossy())
        .map_err(|error| error.to_string())
}

#[test]
fn a_prepared_matroska_answers_as_mp4_without_leaving_a_copy_behind() {
    let before = count_files(&fixtures());
    let service = RemuxService::new();
    let token = prepare(&service, "h264_aac.mkv").expect("an H.264 Matroska must prepare");

    let answer = service.respond(&request(&format!("/{token}"), None));
    assert_eq!(answer.status(), StatusCode::PARTIAL_CONTENT);
    assert_eq!(
        answer
            .headers()
            .get(header::ACCEPT_RANGES)
            .map(|v| v.as_bytes()),
        Some(b"bytes".as_ref()),
        "the WebView only seeks in a stream that says it can be sought"
    );
    assert_eq!(
        answer
            .headers()
            .get(header::CONTENT_TYPE)
            .map(|v| v.as_bytes()),
        Some(b"video/mp4".as_ref())
    );
    assert_eq!(
        &answer.body()[4..8],
        b"ftyp",
        "the virtual file opens as MP4"
    );
    assert_eq!(
        answer
            .headers()
            .get(header::ACCESS_CONTROL_EXPOSE_HEADERS)
            .map(|v| v.as_bytes()),
        Some(b"content-range".as_ref()),
        "WebView2 discards a range read it is not allowed to see"
    );
    assert_eq!(
        answer
            .headers()
            .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
            .map(|v| v.as_bytes()),
        Some(b"*".as_ref()),
        "a request without an origin is still answered"
    );

    assert_eq!(
        count_files(&fixtures()),
        before,
        "serving a remuxed episode must not write anything next to the source"
    );
}

/// The page asks from its own origin and the answer comes back for that origin, the
/// same contract Tauri's asset protocol keeps.
#[test]
fn the_requesting_origin_is_the_one_that_may_read_the_stream() {
    let service = RemuxService::new();
    let token = prepare(&service, "h264_aac.mkv").expect("the fixture must prepare");
    let answer = service.respond(
        &Request::builder()
            .method("GET")
            .uri(format!("/{token}"))
            .header(header::ORIGIN, "http://tauri.localhost")
            .body(Vec::new())
            .expect("a test request is always well formed"),
    );

    assert_eq!(
        answer
            .headers()
            .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
            .map(|v| v.as_bytes()),
        Some(b"http://tauri.localhost".as_ref())
    );
}

#[test]
fn overlapping_ranges_of_one_stream_agree_on_their_shared_bytes() {
    let service = RemuxService::new();
    let token = prepare(&service, "h264_aac.mkv").expect("the fixture must prepare");
    let whole = service.respond(&request(&format!("/{token}"), None));
    let total = whole.body().len();

    let window = service.respond(&request(
        &format!("/{token}"),
        Some(&format!("bytes={}-{}", total / 3, total / 3 + 4_000)),
    ));
    assert_eq!(window.status(), StatusCode::PARTIAL_CONTENT);
    assert_eq!(
        window.body(),
        &whole.body()[total / 3..total / 3 + 4_001],
        "a range must be the same bytes the first read returned"
    );
    assert_eq!(
        window
            .headers()
            .get(header::CONTENT_RANGE)
            .map(|value| value.to_str().unwrap().to_string()),
        Some(format!(
            "bytes {}-{}/{}",
            total / 3,
            total / 3 + 4_000,
            total
        ))
    );
}

#[test]
fn a_suffix_range_answers_with_the_tail() {
    let service = RemuxService::new();
    let token = prepare(&service, "h264_aac.mkv").expect("the fixture must prepare");
    let whole = service.respond(&request(&format!("/{token}"), None));
    let total = whole.body().len();

    let tail = service.respond(&request(&format!("/{token}"), Some("bytes=-512")));
    assert_eq!(tail.body().len(), 512);
    assert_eq!(tail.body(), &whole.body()[total - 512..]);
    assert_eq!(
        tail.headers()
            .get(header::CONTENT_RANGE)
            .map(|value| value.to_str().unwrap().to_string()),
        Some(format!("bytes {}-{}/{}", total - 512, total - 1, total))
    );
}

#[test]
fn a_range_past_the_end_is_refused_with_the_length_it_knows() {
    let service = RemuxService::new();
    let token = prepare(&service, "h264_aac.mkv").expect("the fixture must prepare");
    let total = service
        .respond(&request(&format!("/{token}"), None))
        .body()
        .len();

    let answer = service.respond(&request(&format!("/{token}"), Some("bytes=999999999-")));
    assert_eq!(answer.status(), StatusCode::RANGE_NOT_SATISFIABLE);
    assert_eq!(
        answer
            .headers()
            .get(header::CONTENT_RANGE)
            .map(|value| value.to_str().unwrap().to_string()),
        Some(format!("bytes */{total}")),
        "a 416 has to tell the reader how long the stream really is"
    );
}

#[test]
fn a_token_nobody_prepared_serves_nothing() {
    let service = RemuxService::new();
    let answer = service.respond(&request("/424242", None));
    assert_eq!(answer.status(), StatusCode::NOT_FOUND);
    assert!(answer.body().is_empty());
}

#[test]
fn only_files_inside_the_torrent_library_can_be_prepared() {
    let outside = std::env::temp_dir().join("aniplayer-outside-remux.bin");
    fs::write(&outside, b"not in the library").expect("the temp file must be writable");

    let service = RemuxService::new();
    let error = service
        .prepare(&fixtures(), &outside.to_string_lossy())
        .expect_err("a path outside the library must be refused");
    assert_eq!(
        error.to_string(),
        "the file is outside the downloads folder",
        "the refusal must be the one the user can act on"
    );

    let _ = fs::remove_file(&outside);
}

#[test]
fn a_payload_mp4_cannot_carry_is_refused_by_name() {
    let service = RemuxService::new();
    let error = prepare(&service, "vp9.webm").expect_err("VP9 has no MP4 sample entry");
    assert!(
        error.contains("VP9"),
        "the refusal must name the codec: {error}"
    );
}

#[test]
fn replaying_an_episode_costs_no_second_plan() {
    let service = RemuxService::new();
    let first = prepare(&service, "h264_aac.mkv").expect("the fixture must prepare");
    let again = prepare(&service, "h264_aac.mkv").expect("the fixture must prepare again");

    assert_eq!(first, again, "the same file keeps the same token");
    assert_eq!(
        service.prepared_count(),
        1,
        "and only one plan is held for it"
    );
}
