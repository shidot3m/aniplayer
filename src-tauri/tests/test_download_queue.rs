//! The download queue's cancellation contract, at the `HlsDownloader` seam.
//!
//! A release download is one queue that walks its episodes one at a time, so
//! "cancel everything" has to reach the queue and not only the episode running
//! at that moment. Prior art: `test_hls_playlist` for the pipeline itself and
//! `test_startup` for the store.

use std::sync::atomic::Ordering;
use std::sync::Arc;

use aniplayer_lib::db::Database;
use aniplayer_lib::downloader::HlsDownloader;

fn downloader() -> HlsDownloader {
    HlsDownloader::new(Arc::new(
        Database::init_in_memory().expect("in-memory database for the queue test"),
    ))
}

#[test]
fn cancel_all_stops_the_queued_release_as_well_as_the_running_episode() {
    let downloader = downloader();
    let release = downloader.begin_release(10337);

    assert!(
        !release.load(Ordering::Relaxed),
        "a release queue that has just started is not cancelled"
    );

    downloader.cancel_all(None);

    assert!(
        release.load(Ordering::Relaxed),
        "cancel all must stop the release queue, not only the episode running at that moment"
    );
}

#[test]
fn cancelling_one_episode_leaves_the_rest_of_the_release_queued() {
    let downloader = downloader();
    let release = downloader.begin_release(10337);

    downloader.cancel_episode("episode-3", None);

    assert!(
        !release.load(Ordering::Relaxed),
        "cancelling a single Episode must not abandon the Episodes still queued behind it"
    );
}

#[test]
fn starting_a_release_twice_stops_the_older_queue() {
    let downloader = downloader();
    let first = downloader.begin_release(10337);

    let second = downloader.begin_release(10337);

    assert!(
        first.load(Ordering::Relaxed),
        "the superseded queue must be told to stop, or it keeps downloading out of reach of cancel all"
    );
    assert!(
        !second.load(Ordering::Relaxed),
        "the queue that just started is the live one"
    );

    downloader.cancel_all(None);

    assert!(
        second.load(Ordering::Relaxed),
        "cancel all reaches the live queue"
    );
}

#[test]
fn a_finished_release_is_not_cancelled_by_a_later_queue_wipe() {
    let downloader = downloader();
    let finished = downloader.begin_release(10337);
    downloader.end_release(10337, &finished);

    let next = downloader.begin_release(20001);
    downloader.cancel_all(None);

    assert!(
        next.load(Ordering::Relaxed),
        "the running release must be cancelled"
    );
    assert!(
        !finished.load(Ordering::Relaxed),
        "a release that already ended must not be re-cancelled by a later wipe"
    );
}
