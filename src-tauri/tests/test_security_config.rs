//! Contract tests for the shipped Tauri configuration: the application must boot
//! with an enforced Content Security Policy and with the smallest capability set.

use std::collections::HashMap;
use std::path::Path;

use tauri_utils::config::{Config, Csp, CspDirectiveSources};

fn app_config() -> Config {
    let path = Path::new("tauri.conf.json");
    let raw = std::fs::read_to_string(path).expect("tauri.conf.json must be readable");
    tauri_utils::config::parse::parse_json(&raw, path)
        .expect("tauri.conf.json must be a valid Tauri configuration")
}

fn directives(csp: &Csp) -> HashMap<String, CspDirectiveSources> {
    csp.clone().into()
}

/// Sources of a directive. A missing directive yields no sources, so the
/// assertions below report it as a violation.
fn sources(map: &HashMap<String, CspDirectiveSources>, directive: &str) -> Vec<String> {
    map.get(directive)
        .cloned()
        .map(Vec::from)
        .unwrap_or_default()
}

fn assert_contains(map: &HashMap<String, CspDirectiveSources>, directive: &str, wanted: &[&str]) {
    let present = sources(map, directive);
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

/// Origins the player needs: HLS playlists and segments plus posters come from
/// whatever host the API hands back, MediaSource attaches a blob, and downloaded
/// episodes are served by the asset protocol.
const PLAYBACK_SOURCES: &[&str] = &[
    "https:",                 // HLS playlists/segments and posters served by the API
    "blob:",                  // MediaSource buffer attached to <video> by hls.js
    "asset:",                 // downloaded episodes served by the asset protocol
    "http://asset.localhost", // Windows form of the asset protocol origin
];

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
    let csp = app_config().app.security.csp.expect("production CSP");
    let map = directives(&csp);

    assert_contains(&map, "default-src", &["'self'"]);
    // Tauri injects a nonce for its own bootstrap script, so the app never needs
    // inline script execution; inline style attributes are used by React.
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
    let csp = app_config().app.security.csp.expect("production CSP");
    let map = directives(&csp);

    assert_contains(&map, "connect-src", &["ipc:", "http://ipc.localhost"]);
}

#[test]
fn production_policy_allows_hls_playback_and_image_loading() {
    let csp = app_config().app.security.csp.expect("production CSP");
    let map = directives(&csp);

    assert_contains(&map, "connect-src", &["'self'", "https:"]);
    assert_contains(&map, "media-src", PLAYBACK_SOURCES);
    // Posters are remote or inline placeholders; local files never reach an <img>.
    assert_contains(&map, "img-src", &["'self'", "https:", "data:"]);
    assert_excludes(
        &map,
        "img-src",
        &["http:", "asset:", "http://asset.localhost"],
    );
    // hls.js runs demuxing in a blob-backed worker.
    assert_contains(&map, "worker-src", &["blob:"]);
}

#[test]
fn development_policy_is_explicit_and_relaxes_only_the_dev_server() {
    let config = app_config();
    let csp = config
        .app
        .security
        .dev_csp
        .clone()
        .expect("development CSP must be configured explicitly instead of inheriting nothing");
    let map = directives(&csp);

    // The Vite dev server injects an inline React Refresh preamble and opens a
    // HMR socket on the dev URL; the dev page origin itself is covered by 'self'.
    assert_contains(&map, "script-src", &["'self'", "'unsafe-inline'"]);
    assert_contains(
        &map,
        "connect-src",
        &[
            "ipc:",
            "http://ipc.localhost",
            "http://127.0.0.1:1420",
            "ws://127.0.0.1:1420",
        ],
    );
    // Everything the production policy pins down stays pinned in development.
    assert_contains(&map, "default-src", &["'self'"]);
    assert_contains(&map, "media-src", PLAYBACK_SOURCES);
    assert_excludes(&map, "script-src", &["'unsafe-eval'"]);
    assert_excludes(&map, "connect-src", &["ws:", "http:"]);
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
    assert!(
        identifiers.contains(&"opener:allow-open-url"),
        "magnet opening needs opener:allow-open-url"
    );

    let opener = permissions
        .iter()
        .find(|p| p.get("identifier").and_then(|i| i.as_str()) == Some("opener:allow-open-url"))
        .expect("opener:allow-open-url permission");
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
