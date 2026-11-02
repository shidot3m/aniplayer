//! Serving a remuxed episode: a token-keyed cache of plans plus the range
//! responder the custom protocol hands to the WebView.
//!
//! Requests name a token, never a path. Only the prepare step touches the
//! filesystem, and it confines itself to the torrent payload folder, so the
//! protocol can read nothing the app has not already agreed to play.

use super::{Plan, RemuxError};
use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
// Tauri re-exports the request and response types its protocol handler speaks, so
// the server and the registration agree on one type instead of a second copy of
// the crate.
use tauri::http;

/// Largest response the protocol materializes at once. The WebView asks for the
/// next window when it needs more, so no episode is ever held in memory whole.
const MAX_RESPONSE_BYTES: u64 = 8 * 1024 * 1024;

/// Plans kept ready for playback. Each holds its sample table, a few megabytes,
/// so the cache stays small and playback of a recent episode stays warm.
const CACHED_PLANS: usize = 4;

type Token = u64;

#[derive(Default)]
struct Cache {
    by_token: HashMap<Token, Arc<Plan>>,
    by_path: HashMap<PathBuf, Token>,
    order: VecDeque<Token>,
    next_token: Token,
}

/// The prepared streams the app will serve.
#[derive(Default)]
pub struct RemuxService {
    cache: Mutex<Cache>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PrepareError {
    /// The path is outside the torrent payload folder.
    OutsideLibrary,
    /// The file cannot be read.
    Unreadable(String),
    /// The file cannot be remuxed.
    NotRemuxable(String),
}

impl std::fmt::Display for PrepareError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PrepareError::OutsideLibrary => {
                write!(formatter, "the file is outside the downloads folder")
            }
            PrepareError::Unreadable(reason) => write!(formatter, "{reason}"),
            PrepareError::NotRemuxable(reason) => write!(formatter, "{reason}"),
        }
    }
}

impl std::error::Error for PrepareError {}

impl RemuxService {
    pub fn new() -> Self {
        Self::default()
    }

    /// Number of plans held ready, for tests and diagnostics.
    pub fn prepared_count(&self) -> usize {
        self.lock().by_token.len()
    }

    /// Builds and caches the plan for one file, returning the token its URL uses.
    /// A file already prepared is returned as is, so replaying an episode costs
    /// nothing.
    pub fn prepare(&self, torrents_root: &Path, file_path: &str) -> Result<Token, PrepareError> {
        let root = canonical(torrents_root).ok_or(PrepareError::OutsideLibrary)?;
        let requested = Path::new(file_path);
        let resolved = canonical(requested).ok_or(PrepareError::OutsideLibrary)?;
        if !resolved.starts_with(&root) || !resolved.is_file() {
            return Err(PrepareError::OutsideLibrary);
        }

        if let Some(token) = self.existing_token(&resolved) {
            self.touch(token);
            return Ok(token);
        }

        let plan = Plan::build(&resolved).map_err(|error| match error {
            RemuxError::Io(reason) => PrepareError::Unreadable(reason),
            other => PrepareError::NotRemuxable(other.to_string()),
        })?;

        Ok(self.insert(resolved, Arc::new(plan)))
    }

    fn existing_token(&self, path: &Path) -> Option<Token> {
        self.lock().by_path.get(path).copied()
    }

    fn insert(&self, path: PathBuf, plan: Arc<Plan>) -> Token {
        let mut cache = self.lock();
        // The token is a handle into this process's prepared streams, not a secret:
        // what keeps the protocol from reaching the disk is `prepare` confining every
        // path to the torrent folder, and the CSP keeping the protocol out of
        // `connect-src` so only a media element can read it.
        let token = cache.next_token;
        cache.next_token += 1;
        cache.by_token.insert(token, plan);
        cache.by_path.insert(path, token);
        cache.order.push_back(token);
        // Only a plan nobody is playing can leave: a live stream keeps getting
        // touched by every range request.
        while cache.order.len() > CACHED_PLANS {
            let Some(evicted) = cache.order.pop_front() else {
                break;
            };
            if cache.by_token.remove(&evicted).is_some() {
                cache.by_path.retain(|_, token| *token != evicted);
            }
        }
        token
    }

    fn touch(&self, token: Token) {
        let mut cache = self.lock();
        cache.order.retain(|held| *held != token);
        cache.order.push_back(token);
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Cache> {
        self.cache
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    /// Answers one protocol request: a range of the virtual MP4 behind a token.
    ///
    /// WebView2 reaches a custom protocol from a different origin than the page, so
    /// every answer carries the CORS headers the asset protocol carries — without an
    /// exposed `Content-Range` the media element discards the range read and reports
    /// the stream as unsupported.
    pub fn respond(&self, request: &http::Request<Vec<u8>>) -> http::Response<Vec<u8>> {
        let mut answer = self.answer(request);
        let origin = request
            .headers()
            .get(http::header::ORIGIN)
            .cloned()
            .unwrap_or_else(|| http::HeaderValue::from_static("*"));
        answer
            .headers_mut()
            .insert(http::header::ACCESS_CONTROL_ALLOW_ORIGIN, origin);
        answer.headers_mut().insert(
            http::header::ACCESS_CONTROL_EXPOSE_HEADERS,
            http::HeaderValue::from_static("content-range"),
        );
        answer
    }

    fn answer(&self, request: &http::Request<Vec<u8>>) -> http::Response<Vec<u8>> {
        let token = match parse_token(request.uri().path()) {
            Some(token) => token,
            None => return not_found(),
        };
        let plan = {
            let cache = self.lock();
            match cache.by_token.get(&token) {
                Some(plan) => plan.clone(),
                None => return not_found(),
            }
        };
        self.touch(token);

        let length = plan.len();
        let range = request
            .headers()
            .get(http::header::RANGE)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| parse_range(value, length));

        let (start, end) = match range {
            Some(Specified::Unsatisfiable) => {
                return response(
                    http::StatusCode::RANGE_NOT_SATISFIABLE,
                    length,
                    None,
                    Vec::new(),
                )
            }
            Some(Specified::Window(start, end)) => (start, end),
            None => (0, MAX_RESPONSE_BYTES.min(length)),
        };

        match plan.read_range(start, end - start) {
            Ok(body) => response(
                http::StatusCode::PARTIAL_CONTENT,
                length,
                Some((start, start + body.len() as u64)),
                body,
            ),
            Err(error) => response(
                http::StatusCode::INTERNAL_SERVER_ERROR,
                length,
                None,
                error.to_string().into_bytes(),
            ),
        }
    }
}

enum Specified {
    /// A concrete byte window, already clamped to the response cap.
    Window(u64, u64),
    Unsatisfiable,
}

fn parse_token(path: &str) -> Option<Token> {
    path.trim_matches('/').parse::<Token>().ok()
}

/// Parses `bytes=start-end`, `bytes=start-` and `bytes=-suffix`, clamping the
/// answer to `MAX_RESPONSE_BYTES`.
fn parse_range(value: &str, length: u64) -> Option<Specified> {
    let spec = value.trim().strip_prefix("bytes=")?;
    // Only the first range of a multi-range request is answered; the WebView's
    // media stack asks for one range at a time.
    let spec = spec.split(',').next()?;
    let (from, to) = spec.split_once('-')?;

    let parse = |text: &str| -> Option<u64> {
        if text.is_empty() {
            None
        } else {
            text.parse::<u64>().ok()
        }
    };

    match (parse(from), parse(to)) {
        (Some(start), Some(end)) => {
            if start >= length || start > end {
                return Some(Specified::Unsatisfiable);
            }
            Some(Specified::Window(start, end.min(length - 1) + 1))
        }
        (Some(start), None) => {
            if start >= length {
                return Some(Specified::Unsatisfiable);
            }
            Some(Specified::Window(
                start,
                (start + MAX_RESPONSE_BYTES).min(length),
            ))
        }
        (None, Some(suffix)) => {
            if suffix == 0 {
                return Some(Specified::Unsatisfiable);
            }
            let width = suffix.min(MAX_RESPONSE_BYTES).min(length);
            Some(Specified::Window(length - width, length))
        }
        (None, None) => Some(Specified::Unsatisfiable),
    }
}

fn response(
    status: http::StatusCode,
    length: u64,
    window: Option<(u64, u64)>,
    body: Vec<u8>,
) -> http::Response<Vec<u8>> {
    let mut builder = http::Response::builder()
        .status(status)
        .header(http::header::ACCEPT_RANGES, "bytes")
        .header(http::header::CONTENT_TYPE, "video/mp4")
        .header(http::header::CONTENT_LENGTH, body.len().to_string());
    if let Some((start, past_end)) = window {
        builder = builder.header(
            http::header::CONTENT_RANGE,
            format!("bytes {start}-{}/{}", past_end.saturating_sub(1), length),
        );
    } else {
        builder = builder.header(http::header::CONTENT_RANGE, format!("bytes */{length}"));
    }
    builder.body(body).unwrap_or_else(|_| {
        let mut fallback = http::response::Response::new(Vec::new());
        *fallback.status_mut() = http::StatusCode::INTERNAL_SERVER_ERROR;
        fallback
    })
}

fn not_found() -> http::Response<Vec<u8>> {
    http::Response::builder()
        .status(http::StatusCode::NOT_FOUND)
        .header(http::header::CONTENT_LENGTH, "0")
        .body(Vec::new())
        .unwrap_or_else(|_| http::Response::new(Vec::new()))
}

/// The path as the operating system resolves it, or None when it cannot. A path
/// that cannot be canonicalized cannot be confined to the library either, so it is
/// refused rather than taken on trust.
fn canonical(path: &Path) -> Option<PathBuf> {
    path.canonicalize().ok()
}
