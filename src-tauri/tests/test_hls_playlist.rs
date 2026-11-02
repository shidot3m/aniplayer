use aniplayer_lib::downloader::hls::{prepare_local_playlist, segment_file_name};

const PLAYLIST_URL: &str = "https://cache.libria.fun/videos/10329/1080/index.m3u8?token=abc";

#[test]
fn rewrites_segment_uris_to_local_names_and_keeps_playlist_tags() {
    let source = "#EXTM3U\n\
                  #EXT-X-VERSION:3\n\
                  #EXT-X-TARGETDURATION:10\n\
                  #EXT-X-MEDIA-SEQUENCE:0\n\
                  #EXTINF:9.009,\n\
                  seg-1.ts\n\
                  #EXTINF:9.009,\n\
                  https://other.example/seg-2.ts\n\
                  #EXT-X-ENDLIST\n";

    let playlist = prepare_local_playlist(source, PLAYLIST_URL).expect("playlist must parse");

    assert_eq!(
        playlist.segment_urls,
        vec![
            "https://cache.libria.fun/videos/10329/1080/seg-1.ts",
            "https://other.example/seg-2.ts",
        ]
    );
    assert_eq!(
        playlist.manifest,
        "#EXTM3U\n\
         #EXT-X-VERSION:3\n\
         #EXT-X-TARGETDURATION:10\n\
         #EXT-X-MEDIA-SEQUENCE:0\n\
         #EXTINF:9.009,\n\
         segment-00000.ts\n\
         #EXTINF:9.009,\n\
         segment-00001.ts\n\
         #EXT-X-ENDLIST\n"
    );
}

#[test]
fn stores_fragment_initialization_and_encryption_key_locally() {
    let source = "#EXTM3U\n\
                  #EXT-X-MAP:URI=\"../init.mp4\",BYTERANGE=\"700@0\"\n\
                  #EXT-X-KEY:METHOD=AES-128,URI=\"https://keys.example/key.bin\",IV=0x01\n\
                  #EXTINF:4.0,\n\
                  seg.m4s\n\
                  #EXT-X-ENDLIST\n";

    let playlist = prepare_local_playlist(source, PLAYLIST_URL).expect("resources must parse");

    assert_eq!(playlist.resources.len(), 2);
    assert_eq!(playlist.resources[0].file_name, "init-00000.mp4");
    assert_eq!(
        playlist.resources[0].url,
        "https://cache.libria.fun/videos/10329/init.mp4"
    );
    assert_eq!(playlist.resources[1].file_name, "key-00000.key");
    assert_eq!(playlist.resources[1].url, "https://keys.example/key.bin");
    assert!(playlist
        .manifest
        .contains("#EXT-X-MAP:URI=\"init-00000.mp4\",BYTERANGE=\"700@0\""));
    assert!(playlist
        .manifest
        .contains("#EXT-X-KEY:METHOD=AES-128,URI=\"key-00000.key\",IV=0x01"));
}

#[test]
fn closes_a_vod_playlist_that_has_no_endlist() {
    let source = "#EXTM3U\n#EXTINF:4.0,\nseg.ts\n";

    let playlist = prepare_local_playlist(source, PLAYLIST_URL).expect("playlist must parse");

    assert!(playlist
        .manifest
        .ends_with("segment-00000.ts\n#EXT-X-ENDLIST\n"));
}

#[test]
fn keeps_key_reset_without_downloading_a_resource() {
    let source = "#EXTM3U\n#EXT-X-KEY:METHOD=NONE\n#EXTINF:4.0,\nseg.ts\n";
    let playlist = prepare_local_playlist(source, PLAYLIST_URL).expect("key reset must parse");
    assert!(playlist.resources.is_empty());
    assert!(playlist.manifest.contains("#EXT-X-KEY:METHOD=NONE"));
}

#[test]
fn rejects_master_and_byte_range_playlists() {
    let master = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=5000000\n1080/index.m3u8\n";
    let byte_range = "#EXTM3U\n#EXTINF:4.0,\n#EXT-X-BYTERANGE:1000@0\nall.ts\n";

    assert!(prepare_local_playlist(master, PLAYLIST_URL).is_err());
    assert!(prepare_local_playlist(byte_range, PLAYLIST_URL).is_err());
}

#[test]
fn rejects_a_playlist_without_media_segments() {
    let source = "#EXTM3U\n#EXT-X-ENDLIST\n";

    assert!(prepare_local_playlist(source, PLAYLIST_URL).is_err());
}

#[test]
fn names_segments_in_download_order() {
    assert_eq!(segment_file_name(0), "segment-00000.ts");
    assert_eq!(segment_file_name(41), "segment-00041.ts");
}
