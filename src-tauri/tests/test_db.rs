use aniplayer_lib::db::models::*;
use aniplayer_lib::db::repository::Database;

#[test]
fn test_database_settings_crud() {
    let db = Database::init_in_memory().expect("Failed to init in-memory db");
    
    // Save settings
    db.save_setting("volume", "85").expect("Save setting failed");
    db.save_setting("anime4k_preset", "A+A").expect("Save setting failed");
    
    // Retrieve settings
    assert_eq!(db.get_setting("volume").unwrap(), Some("85".to_string()));
    assert_eq!(db.get_setting("anime4k_preset").unwrap(), Some("A+A".to_string()));
    assert_eq!(db.get_setting("non_existent").unwrap(), None);
}

#[test]
fn test_database_bookmarks_crud() {
    let db = Database::init_in_memory().expect("Failed to init in-memory db");
    
    let bookmark1 = BookmarkItem {
        release_id: 10239,
        category: "WATCHING".to_string(),
        release_data_json: "{\"title\":\"Адский режим\"}".to_string(),
        updated_at: None,
    };
    db.save_bookmark(&bookmark1).expect("Save bookmark failed");

    let bookmark2 = BookmarkItem {
        release_id: 9999,
        category: "FAVORITES".to_string(),
        release_data_json: "{\"title\":\"Любимое аниме\"}".to_string(),
        updated_at: None,
    };
    db.save_bookmark(&bookmark2).expect("Save bookmark failed");

    // Get all
    let all = db.get_bookmarks(None).expect("Get all failed");
    assert_eq!(all.len(), 2);

    // Filter by category
    let watching = db.get_bookmarks(Some("WATCHING".to_string())).expect("Get watching failed");
    assert_eq!(watching.len(), 1);
    assert_eq!(watching[0].release_id, 10239);

    // Delete bookmark
    db.delete_bookmark(10239).expect("Delete failed");
    let after_delete = db.get_bookmarks(None).expect("Get after delete failed");
    assert_eq!(after_delete.len(), 1);
}

#[test]
fn test_database_history_and_continue_watching() {
    let db = Database::init_in_memory().expect("Failed to init in-memory db");
    
    let hist1 = HistoryItem {
        release_id: 10239,
        episode_id: "ep-1".to_string(),
        episode_ordinal: 1.0,
        last_position: 520.0,
        duration: 1420.0,
        is_completed: false,
        updated_at: None,
    };
    db.save_history(&hist1).expect("Save history failed");

    let continue_list = db.get_continue_watching().expect("Get continue failed");
    assert_eq!(continue_list.len(), 1);
    assert_eq!(continue_list[0].release_id, 10239);
    assert_eq!(continue_list[0].last_position, 520.0);
}

#[test]
fn test_database_downloaded_episodes_with_skip_codes() {
    let db = Database::init_in_memory().expect("Failed to init in-memory db");
    
    let dl = DownloadedEpisodeMeta {
        episode_id: "ep-1".to_string(),
        release_id: 10239,
        episode_ordinal: 1.0,
        file_path: "downloads/10239/1.mp4".to_string(),
        file_size: 350000000,
        quality: "1080p".to_string(),
        opening_start: Some(23.0),
        opening_stop: Some(113.0),
        ending_start: Some(1421.0),
        ending_stop: Some(1511.0),
        download_status: "COMPLETED".to_string(),
    };
    db.save_downloaded_episode(&dl).expect("Save dl failed");

    let retrieved = db.get_downloaded_episode("ep-1").expect("Get dl failed").unwrap();
    assert_eq!(retrieved.file_path, "downloads/10239/1.mp4");
    assert_eq!(retrieved.opening_start, Some(23.0));
    assert_eq!(retrieved.ending_stop, Some(1511.0));
}
