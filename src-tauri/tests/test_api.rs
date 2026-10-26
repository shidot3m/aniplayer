use aniplayer_lib::api::client::AnilibriaClient;

#[tokio::test]
async fn test_api_client_status_and_user_agent() {
    let client = AnilibriaClient::new();
    let status = client.get_status().await.expect("API status request failed");
    assert!(status.is_alive, "API is not alive");
}

#[tokio::test]
async fn test_api_fetch_latest_and_release_details() {
    let client = AnilibriaClient::new();
    let latest = client.get_latest_releases(5).await.expect("Get latest failed");
    assert!(!latest.is_empty(), "Latest releases list is empty");
    
    let first_id = latest[0].id;
    let details = client.get_release(&first_id.to_string()).await.expect("Get details failed");
    assert_eq!(details.id, first_id);
    assert!(!details.name.main.is_empty());
    
    // Test episodes
    if !details.episodes.is_empty() {
        let ep = &details.episodes[0];
        assert!(ep.ordinal >= 0.0);
    }
}

#[tokio::test]
async fn test_api_fetch_torrents_and_codecs() {
    let client = AnilibriaClient::new();
    // Test with known release with torrents
    let torrents = client.get_release_torrents(10239).await.expect("Get torrents failed");
    assert!(!torrents.is_empty(), "Torrents list is empty for release 10239");
    let has_hevc = torrents.iter().any(|t| {
        t.codec.as_ref().map(|c| c.label.to_uppercase().contains("HEVC") || c.value.to_uppercase().contains("HEVC")).unwrap_or(false)
    });
    assert!(has_hevc, "Expected at least one HEVC torrent for release 10239");
}

#[tokio::test]
async fn test_api_fetch_genres() {
    let client = AnilibriaClient::new();
    let genres = client.get_genres().await.expect("Get genres failed");
    assert!(!genres.is_empty(), "Genres list should not be empty");
    let has_releases_count = genres.iter().any(|g| g.total_releases.unwrap_or(0) > 0);
    assert!(has_releases_count, "Expected at least one genre to have total_releases");

    // Test paginated releases for a genre with more than one page
    let genre = genres
        .iter()
        .find(|g| g.total_releases.unwrap_or(0) > 10)
        .expect("Expected a genre with more than 10 releases");
    let first_page = client
        .get_genre_releases(genre.id, 1, 10)
        .await
        .expect("Get genre releases page 1 failed");
    assert!(!first_page.releases.is_empty());
    assert!(first_page.releases.len() <= 10);
    assert_eq!(first_page.pagination.current_page, 1);
    assert!(first_page.pagination.total_pages >= 2);

    let second_page = client
        .get_genre_releases(genre.id, 2, 10)
        .await
        .expect("Get genre releases page 2 failed");
    assert!(!second_page.releases.is_empty());
    assert_eq!(second_page.pagination.current_page, 2);
}

#[tokio::test]
async fn test_api_fetch_franchises() {
    let client = AnilibriaClient::new();
    // Test known release with franchise (10128)
    let franchises = client.get_release_franchises(10128).await.expect("Get franchises failed");
    assert!(!franchises.is_empty(), "Expected franchise list for release 10128");
    assert!(franchises[0].franchise_releases.as_ref().map(|r| !r.is_empty()).unwrap_or(false));
}
