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

use tauri_utils::config::{Color, Config, Csp, CspDirectiveSources, FsScope};

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

/// The media stack the WebView now owns: hls.js hands the `<video>` element a `blob:`
/// MediaSource URL and fetches playlists and segments with XHR, which for a downloaded
/// Episode goes to the asset protocol. Both are the whole media surface, and nothing else
/// may be reachable from it.
const REQUIRED_MEDIA_SOURCES: &[&str] = &["blob:"];
const ASSET_SOURCES: &[&str] = &["asset:", "http://asset.localhost"];
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
fn production_policy_plays_hls_inside_the_webview() {
    let map = production();

    assert_contains(&map, "connect-src", &["'self'", "https:"]);
    // The media element's only source is the MediaSource blob hls.js creates; a playlist
    // and its segments arrive over XHR, from the CDN (https) or from the asset protocol.
    assert_contains(&map, "media-src", REQUIRED_MEDIA_SOURCES);
    assert_contains(&map, "worker-src", &["'self'", "blob:"]);
    assert_contains(&map, "connect-src", ASSET_SOURCES);
    assert_excludes(
        &map,
        "media-src",
        &[
            "'self'",
            "https:",
            "http:",
            "asset:",
            "http://asset.localhost",
        ],
    );
    // hls.js ships as a module; nothing in the playback path evaluates code or frames a page.
    assert_excludes(&map, "worker-src", &["https:", "http:"]);
    // Posters are remote or inline placeholders; local files never reach an <img>.
    assert_contains(&map, "img-src", &["'self'", "https:", "data:"]);
    assert_excludes(&map, "img-src", &["http:", "asset:"]);
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

/// A downloaded Episode is an Offline playlist on disk, and the WebView reads it through the
/// asset protocol. The protocol is therefore on, and confined to the folder the downloader
/// writes into: the executable's own `downloads/`, which is also where `resolve_source`
/// canonicalizes before handing a path out.
#[test]
fn asset_protocol_is_enabled_and_confined_to_the_downloads_folder() {
    let config = app_config();
    let asset = &config.app.security.asset_protocol;
    assert!(
        asset.enable,
        "the webview can only play a downloaded episode through the asset protocol"
    );
    let allowed: Vec<String> = match &asset.scope {
        FsScope::AllowedPaths(paths) => paths.iter().map(|p| p.display().to_string()).collect(),
        FsScope::Scope { allow, deny, .. } => {
            assert!(deny.is_empty(), "the downloads scope needs no deny list");
            allow.iter().map(|p| p.display().to_string()).collect()
        }
    };
    assert_eq!(
        allowed,
        vec![r"$EXE/downloads/**".to_string()],
        "the asset protocol must serve the downloads folder and nothing else",
    );
    assert_contains(&production(), "connect-src", ASSET_SOURCES);
    assert_contains(&development(), "connect-src", ASSET_SOURCES);
}

/// One window is the whole stack: the frame and the controls share it, so there is no second
/// surface to keep on top of, no hole to cut in the main window, and no redirection-bitmap
/// trick to hold that hole open. Losing any of these three returns the [#49] and [#52] class
/// of symptoms — a picture that falls under another window on Alt+Tab — to the tree.
///
/// [ADR 0014](../../docs/adr/0014-webview-hls-playback.md) is why the WebView is the backend.
#[test]
fn the_window_stack_is_a_single_opaque_window() {
    let config = app_config();
    let windows = &config.app.windows;
    assert_eq!(
        windows.len(),
        1,
        "the player no longer needs a second window to draw into",
    );
    let main = &windows[0];
    assert_eq!(main.label, "main");
    assert!(!main.transparent, "the main window carries the frame now");
    assert!(
        !main.no_redirection_bitmap,
        "noRedirectionBitmap only serves a transparent window",
    );
    assert!(
        !main.always_on_top,
        "nothing may pin the app above the desktop"
    );
    assert_eq!(
        main.background_color,
        Some(Color(9, 10, 15, 255)),
        "the window opens in the app's own dark background instead of a transparent one",
    );
}

/// The WebView hands nothing to the operating system. The torrent engine owned
/// the only outward opening — `magnet:*` links — and it is gone ([ADR
/// 0013](adr/0013-hls-only-delivery-drops-bittorrent.md)); opening a downloads
/// folder is a Rust call, not a page-granted permission.
#[test]
fn capabilities_grant_no_external_opening() {
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

    let offenders: Vec<&str> = identifiers
        .iter()
        .copied()
        .filter(|id| id.starts_with("shell:") || id.starts_with("opener:"))
        .collect();
    assert!(
        offenders.is_empty(),
        "the page may open nothing outside the app: {offenders:?}",
    );
    assert!(
        !raw.to_lowercase().contains("magnet"),
        "the magnet scope must not come back: {raw}"
    );
}
