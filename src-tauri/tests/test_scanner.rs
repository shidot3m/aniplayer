use aniplayer_lib::downloader::scanner::extract_episode_ordinal;

#[test]
fn test_extract_episode_ordinal() {
    assert_eq!(
        extract_episode_ordinal("[Anilibria] Hell Mode - 01 [1080p].mkv"),
        Some(1.0)
    );
    assert_eq!(
        extract_episode_ordinal("Jujutsu_Kaisen_S2_E04.mp4"),
        Some(4.0)
    );
    assert_eq!(extract_episode_ordinal("Title_ep12.mkv"), Some(12.0));
    assert_eq!(extract_episode_ordinal("Серия 03.mkv"), Some(3.0));
    assert_eq!(extract_episode_ordinal("Episode 24 [HEVC].mkv"), Some(24.0));
    assert_eq!(extract_episode_ordinal("05.mp4"), Some(5.0));
    assert_eq!(
        extract_episode_ordinal("Attack_on_Titan_Part_3_Ep_08.mkv"),
        Some(8.0)
    );
    assert_eq!(extract_episode_ordinal("random_file.txt"), None);
}
