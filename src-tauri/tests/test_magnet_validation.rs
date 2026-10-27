use aniplayer_lib::downloader::torrent::validate_magnet;

#[test]
fn test_validate_magnet_accepts_valid_magnet_urls() {
    assert!(validate_magnet("magnet:?xt=urn:btih:c12fe1c06bba254a9dc9f519b335aa7c1367105b").is_ok());
    assert!(validate_magnet(
        "magnet:?xt=urn:btih:d24b1f45l9a90a5f0d8a0f0c6b6d5e5f4a3b2c1d&dn=Anime+Title+01&tr=udp://tracker.example:6969"
    )
    .is_ok());
}

#[test]
fn test_validate_magnet_rejects_wrong_scheme() {
    assert!(validate_magnet("http://example.com/magnet?xt=urn:btih:deadbeef").is_err());
    assert!(validate_magnet("xt=urn:btih:c12fe1c06bba254a9dc9f519b335aa7c1367105b").is_err());
    assert!(validate_magnet("MAGNET:?xt=urn:btih:c12fe1c06bba254a9dc9f519b335aa7c1367105b").is_err());
    assert!(validate_magnet("").is_err());
}

#[test]
fn test_validate_magnet_rejects_too_long_input() {
    let mut long = String::from("magnet:?xt=urn:btih:c12fe1c06bba254a9dc9f519b335aa7c1367105b&dn=");
    for _ in 0..10_000 {
        long.push_str("aaaaaaaaaa");
    }
    assert!(validate_magnet(&long).is_err());
}

#[test]
fn test_validate_magnet_rejects_control_characters() {
    assert!(validate_magnet("magnet:?xt=urn:btih:c12fe1c06bba254a9dc9f519b335aa7c1367105b\nC:\\Windows\\System32\\calc.exe").is_err());
    assert!(validate_magnet("magnet:?xt=urn:btih:deadbeef\x00extra").is_err());
    assert!(validate_magnet("magnet:?xt=urn:btih:deadbeef\x1b[31m").is_err());
    assert!(validate_magnet("magnet:?xt=urn:btih:deadbeef\x7f").is_err());
}
