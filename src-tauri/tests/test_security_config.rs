//! Contract tests for the shipped Tauri configuration.
//!
//! The production policy is enforced through the `Content-Security-Policy`
//! response header of the custom protocol. In `tauri dev` the document is served
//! by the Vite dev server instead, so `devCsp` is the declared development policy
//! and is what a dev-profile build serving bundled assets gets; keeping it
//! explicit stops the development relaxation from silently becoming the shipped
//! policy.

use std::collections::{HashMap, HashSet};
use std::path::Path;

use tauri_utils::config::{Config, Csp, CspDirectiveSources, FsScope};

fn app_config() -> Config {
    let path = Path::new("tauri.conf.json");
    let raw = std::fs::read_to_string(path).expect("tauri.conf.json must be readable");
    tauri_utils::config::parse::parse_json(&raw, path)
        .expect("tauri.conf.json must be a valid Tauri configuration")
}

fn production() -> HashMap<String, CspDirectiveSources> {
    let csp = app_config()
        .app
        .security
        .csp
        .expect("production CSP must be configured instead of null");
    to_directives(&csp)
}

fn development() -> HashMap<String, CspDirectiveSources> {
    let csp = app_config()
        .app
        .security
        .dev_csp
        .expect("development CSP must be configured explicitly, not inherited");
    to_directives(&csp)
}

fn to_directives(csp: &Csp) -> HashMap<String, CspDirectiveSources> {
    csp.clone().into()
}

fn sources(map: &HashMap<String, CspDirectiveSources>, directive: &str) -> Vec<String> {
    map.get(directive)
        .cloned()
        .map(Vec::from)
        .unwrap_or_default()
}

fn normalized_paths(paths: &[std::path::PathBuf]) -> Vec<String> {
    paths
        .iter()
        .map(|path| path.to_string_lossy().replace('\\', "/"))
        .collect()
}

fn assert_contains(map: &HashMap<String, CspDirectiveSources>, directive: &str, wanted: &[&str]) {
    let present = match map.get(directive) {
        Some(directive) => Vec::from(directive.clone()),
        None => panic!("`{directive}` must be declared in the policy"),
    };
    for source in wanted {
        assert!(
            present.iter().any(|s| s == source),
            "`{directive}` must allow `{source}`, got: {present:?}",
        );
    }
}

fn assert_excludes(map: &HashMap<String, CspDirectiveSources>, directive: &str, banned: &[&str]) {
    let present = sources(map, directive);
    for source in banned {
        assert!(
            !present.iter().any(|s| s == source),
            "`{directive}` must not allow `{source}`, got: {present:?}",
        );
    }
}

/// Origins playback needs in any environment: the API hands out HLS playlists and
/// posters for whatever host serves them, hls.js attaches a MediaSource blob to
/// `<video>`, a downloaded episode is fetched over the asset protocol, and a remuxed
/// Matroska episode arrives over the remux protocol.
const PLAYBACK_SOURCES: &[&str] = &[
    "https:",
    "blob:",
    "asset:",
    "http://asset.localhost",
    "http://remux.localhost",
];
const IPC_SOURCES: &[&str] = &["ipc:", "http://ipc.localhost"];

#[test]
fn security_policy_is_enabled() {
    let config = app_config();
    assert!(
        config.app.security.csp.is_some(),
        "production CSP must be enabled instead of null"
    );
}

#[test]
fn production_policy_anchors_on_self_and_blocks_injection() {
    let map = production();

    assert_contains(&map, "default-src", &["'self'"]);
    // Tauri injects the hash of its own bootstrap script, so the application
    // never needs inline script execution. Inline style attributes do.
    assert_contains(&map, "script-src", &["'self'"]);
    assert_excludes(
        &map,
        "script-src",
        &["'unsafe-inline'", "'unsafe-eval'", "https:"],
    );
    assert_contains(&map, "style-src", &["'unsafe-inline'"]);
    assert_contains(&map, "object-src", &["'none'"]);
    assert_contains(&map, "frame-src", &["'none'"]);
    assert_contains(&map, "base-uri", &["'self'"]);
    assert_contains(&map, "form-action", &["'none'"]);
}

#[test]
fn production_policy_allows_the_ipc_origins() {
    assert_contains(&production(), "connect-src", IPC_SOURCES);
}

#[test]
fn production_policy_allows_hls_playback_and_image_loading() {
    let map = production();

    assert_contains(&map, "connect-src", &["'self'", "https:"]);
    assert_contains(&map, "media-src", PLAYBACK_SOURCES);
    // Posters are remote or inline placeholders; local files never reach an <img>.
    assert_contains(&map, "img-src", &["'self'", "https:", "data:"]);
    assert_excludes(&map, "img-src", &["http:", "asset:"]);
    // hls.js demuxes in a blob-backed worker and fetches segments itself.
    assert_contains(&map, "worker-src", &["blob:"]);
    assert_contains(&map, "connect-src", &["asset:", "http://asset.localhost"]);
    // The remux protocol is for the media element and nothing else. Page script must
    // not be able to fetch it, which would hand any injected code a byte-range
    // reader over the torrent library.
    assert_excludes(&map, "connect-src", &["http://remux.localhost"]);
}

#[test]
fn development_policy_relaxes_only_the_dev_server() {
    let map = development();

    // The Vite dev server injects an inline React Refresh preamble and opens an
    // HMR socket on the dev URL. The dev page origin itself is already 'self'.
    assert_contains(&map, "script-src", &["'self'", "'unsafe-inline'"]);
    assert_contains(
        &map,
        "connect-src",
        &[
            "http://127.0.0.1:1420",
            "ws://127.0.0.1:1420",
            "http://ipc.localhost",
        ],
    );
    assert_excludes(&map, "script-src", &["'unsafe-eval'"]);
    assert_excludes(&map, "connect-src", &["ws:", "http:"]);
}

#[test]
fn development_and_production_policies_differ_only_where_the_dev_server_needs_it() {
    let prod = production();
    let dev = development();
    let relaxed = ["script-src", "connect-src"];

    let declared: HashSet<&String> = prod.keys().chain(dev.keys()).collect();
    for directive in declared {
        if relaxed.contains(&directive.as_str()) {
            continue;
        }
        assert_eq!(
            sources(&prod, directive),
            sources(&dev, directive),
            "`{directive}` must not drift between the development and production policies",
        );
    }

    for required in [
        "default-src",
        "script-src",
        "style-src",
        "img-src",
        "media-src",
        "connect-src",
        "worker-src",
    ] {
        assert!(
            prod.contains_key(required),
            "policy must declare `{required}` instead of leaning on default-src alone"
        );
    }
}

/// A downloaded episode reaches the webview only through the asset protocol,
/// whose scope is the second half of the protection: an enabled protocol with
/// a wide scope would expose every file on disk. The downloads folder lives
/// next to the executable, which `$RESOURCE` resolves to on Windows; `$EXE`
/// cannot be used there because `dirs::executable_dir()` returns `None`.
#[test]
fn asset_protocol_is_enabled_and_confined_to_downloads() {
    let config = app_config();
    let asset = config.app.security.asset_protocol;
    assert!(
        asset.enable,
        "the asset protocol must be enabled for offline playback"
    );

    let (allowed, forbidden) = match asset.scope {
        FsScope::AllowedPaths(paths) => (paths, Vec::new()),
        FsScope::Scope { allow, deny, .. } => (allow, deny),
    };
    let allowed = normalized_paths(&allowed);
    let forbidden = normalized_paths(&forbidden);

    assert!(
        forbidden.is_empty(),
        "the asset protocol scope must not carve out denials: {forbidden:?}"
    );
    assert_eq!(
        allowed,
        vec!["$RESOURCE/downloads/**"],
        "the asset protocol must expose exactly the downloads folder"
    );
}

#[test]
fn capabilities_grant_only_the_magnet_opener() {
    let raw = std::fs::read_to_string("capabilities/default.json")
        .expect("default capability must be readable");
    let value: serde_json::Value =
        serde_json::from_str(&raw).expect("default capability must be valid JSON");
    let permissions = value
        .get("permissions")
        .and_then(|p| p.as_array())
        .expect("capabilities must declare a permissions array");
    let identifiers: Vec<&str> = permissions
        .iter()
        .map(|p| {
            p.get("identifier")
                .and_then(|i| i.as_str())
                .unwrap_or(p.as_str().unwrap_or_default())
        })
        .collect();

    assert!(
        !identifiers.iter().any(|id| id.starts_with("shell:")),
        "the removed shell plugin must not come back: {identifiers:?}"
    );

    let opener = permissions
        .iter()
        .find(|p| p.get("identifier").and_then(|i| i.as_str()) == Some("opener:allow-open-url"))
        .expect("magnet opening needs opener:allow-open-url");
    let scoped = opener
        .get("allow")
        .and_then(|a| a.as_array())
        .expect("opener permission must carry an explicit allow scope");
    let urls: Vec<&str> = scoped
        .iter()
        .filter_map(|entry| entry.get("url").and_then(|u| u.as_str()))
        .collect();
    assert_eq!(
        urls,
        vec!["magnet:*"],
        "the opener scope must be limited to magnet links"
    );
}
