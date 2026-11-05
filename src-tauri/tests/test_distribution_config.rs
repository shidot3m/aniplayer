//! Contract tests for the shipped distribution configuration.
//!
//! Two channels ship from one build: the portable archive and a per-user NSIS
//! installer ([ADR 0016](../../docs/adr/0016-portable-archive-and-per-user-nsis-installer.md)).
//! Both keep their data beside the executable, so the invariant the portable channel
//! always had — a writable folder the app itself owns — has to hold for the installer
//! too. That is what these guards pin: the install mode, not a default that a future
//! edit can drop.

use std::path::Path;

use tauri_utils::config::{BundleTarget, BundleType, Config, NSISInstallerMode};

fn app_config() -> Config {
    let path = Path::new("tauri.conf.json");
    let raw = std::fs::read_to_string(path).expect("tauri.conf.json must be readable");
    tauri_utils::config::parse::parse_json(&raw, path)
        .expect("tauri.conf.json must be a valid Tauri configuration")
}

/// A per-machine installer writes into `Program Files`, where the app cannot create
/// `data/aniplayer.db` without elevation, and it would offer an elevation prompt the
/// product does not need. `currentUser` is therefore spelled out rather than left to
/// the default: the data-beside-the-executable invariant must not rest on a default.
#[test]
fn the_installer_is_per_user_only() {
    let nsis = app_config()
        .bundle
        .windows
        .nsis
        .expect("the NSIS installer must be configured explicitly, not left to defaults");
    assert_eq!(
        nsis.install_mode,
        NSISInstallerMode::CurrentUser,
        "the installer may not offer a per-machine install: `installMode` must be `currentUser`",
    );
}

/// The release pipeline publishes exactly one installer, so the bundler must not be left
/// to build a WiX MSI next to it: an artifact nobody publishes is an artifact nobody tests,
/// and MSI is out of the distribution decision.
#[test]
fn the_bundler_target_is_nsis_alone() {
    let bundle = &app_config().bundle;
    assert!(
        bundle.active,
        "the release build bundles, so the installer comes out of `tauri build` itself",
    );
    assert_eq!(
        bundle.targets,
        BundleTarget::List(vec![BundleType::Nsis]),
        "`targets` must list `nsis` alone; `all` would also build an unpublished MSI",
    );
}

/// Nothing the installer registers may outlive it in a way the app cannot undo. File
/// associations were the app's way of answering a `magnet:` link, and the torrent engine
/// that needed them is gone ([ADR 0013](../../docs/adr/0013-hls-only-delivery-drops-bittorrent.md));
/// a minimum WebView2 version would refuse installation over an anime4K upscale the app
/// degrades without anyway ([ADR 0015](../../docs/adr/0015-anime4k-as-a-webgpu-renderer.md)).
#[test]
fn the_installer_registers_nothing_beyond_the_app_itself() {
    let bundle = &app_config().bundle;
    let associations = bundle.file_associations.as_deref().unwrap_or_default();
    assert!(
        associations.is_empty(),
        "the app owns no document type, so the installer must register no association: {associations:?}",
    );

    let windows = &bundle.windows;
    assert_eq!(
        windows.minimum_webview2_version, None,
        "installation must not depend on a WebView2 version; an older runtime degrades Anime4K, not the app",
    );
}

/// A `v1.0.0` tag publishes a versioned release whose name comes from the app config while
/// the archive is stamped from the package manifest. Cut from a mismatched pair and the two
/// channels disagree about which build the user has.
#[test]
fn the_version_is_the_same_in_every_manifest() {
    let config = app_config()
        .version
        .expect("tauri.conf.json must declare the version a release is tagged from");
    assert_eq!(
        package_json_version(),
        config,
        "`package.json` and `tauri.conf.json` must carry the same version",
    );
    assert_eq!(
        cargo_manifest_version(),
        config,
        "`Cargo.toml` and `tauri.conf.json` must carry the same version",
    );
}

/// The `version` of the `[package]` section, read without pulling a TOML parser into the
/// test graph for two lines.
fn cargo_manifest_version() -> String {
    declared_version("Cargo.toml", "[package]")
}

fn package_json_version() -> String {
    let raw = std::fs::read_to_string("../package.json")
        .expect("package.json must be readable next to the crate");
    let value: serde_json::Value =
        serde_json::from_str(&raw).expect("package.json must be valid JSON");
    value
        .get("version")
        .and_then(|v| v.as_str())
        .expect("package.json must declare a version")
        .to_string()
}

fn declared_version(path: &str, section: &str) -> String {
    let raw = std::fs::read_to_string(path)
        .unwrap_or_else(|error| panic!("{path} must be readable: {error}"));
    let mut inside = false;
    for line in raw.lines() {
        let line = line.trim();
        if line.starts_with('[') {
            inside = line == section;
        } else if inside {
            if let Some((key, value)) = line.split_once('=') {
                if key.trim() == "version" {
                    return value.trim().trim_matches('"').to_string();
                }
            }
        }
    }
    panic!("`{section}` in {path} must declare a version");
}
