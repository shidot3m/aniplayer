# 19. An interrupted HLS download reconciles to FAILED, its bytes stay on disk

Date: 2026-11-13

Status: accepted

## Context

An HLS download records a `DOWNLOADING` row when its task starts ([ADR 0008](0008-local-hls-offline-downloads.md), `downloader/hls.rs`) and only updates that row when the task itself reaches a terminal state: COMPLETED on the last byte, FAILED on a fetch/write failure inside `download_episode`, or the row deleted on cancel. Every one of those outcomes is produced by the running task.

When the process dies mid-download — the window closed, the machine rebooted, `Stop-Process` — the task dies with it and writes nothing. The row is left `DOWNLOADING` with `file_size = 0`, because the size is only stamped at completion. Its segments stay on disk under `downloads/<release_id>/<ordinal>/` and the local `index.m3u8` is never written, so `player_resolve_source` refuses the stored path ([ADR 0014](0014-webview-is-the-only-playback-backend.md)): there is nothing to play.

The library then showed the row as `Эпизод N · 1080p · Размер: 0 Б` with only «Папка аниме» and «Удалить эпизод с диска» — a zero-byte entry that read as a downloaded, watchable episode and could be neither resumed nor finished. Startup touched none of it: the only launch cleanup was `purge_legacy_torrent_downloads`, scoped to the retired `torrent-` id prefix ([ADR 0013](0013-hls-only-delivery-drops-bittorrent.md)). Filed as [#78](https://github.com/shidot3m/aniplayer/issues/78).

## Decision

- **Startup reconciles `DOWNLOADING` to `FAILED`.** `startup::reconcile_interrupted_downloads` runs right after the legacy purge in `bootstrap()` and issues one `UPDATE downloaded_episodes SET download_status = 'FAILED' WHERE download_status = 'DOWNLOADING'`. At startup no download task is alive, so every `DOWNLOADING` row is by definition one the previous process died in the middle of; the status filter alone identifies them, with no version marker and no per-row timestamp.
- **The already-downloaded bytes are never touched.** The pass changes only the status column — not `file_size`, not the folder. A killed download's 267 MB of segments stay on disk, exactly as the legacy purge leaves a user's media in place ([ADR 0013](0013-hls-only-delivery-drops-bittorrent.md)). Silently deleting them (the third option on the ticket) was rejected for that reason.
- **`FAILED` is the "not finished" status the library surfaces.** No new enum value was added: the schema's `CHECK (download_status IN ('PENDING','DOWNLOADING','COMPLETED','FAILED'))` already allows it, and `FAILED` already means "not playable offline" to the UI. A reconciled row renders as an «Не завершено» entry with an explanation instead of a playable «0 Б» one, counts as neither an offline series nor disk bytes in the headline, and is kept out of the offline episode list `player` may walk.
- **Finish is a manual re-download, not an incremental resume.** The row offers a «Скачать заново» action that calls `downloader_start_episode` again with the episode's live HLS stream, resolved from the catalog; the run wipes the folder and re-fetches. It is labeled as a fresh download, not «докачать», because continuing from the segments already on disk is the incremental-resume option this decision knowingly did not take.
- **If the source cannot be resolved, the action is not offered.** The database stores everything a retry needs except the m3u8 URL, which is not persisted. When the release is no longer in the catalog or its bookmarks, the row shows only the explanation, and the existing delete action remains.

## Considered options

- **Incremental resume** (re-scan the folder against the playlist and fetch only the missing segments) — rejected for now: the most useful outcome, since the bytes are already there, but a new resume path in `download_episode`, segment-set reconciliation and its own failure modes. Kept as the natural follow-up if partial bytes prove worth recovering; choosing FAILED now does not foreclose it — a resume would replace this same reconcile step.
- **Delete the row and its orphan folder at startup** — rejected: it is the least of the lies only because it stops listing the episode, and it throws away bytes the user already paid for. The app never owns the user's media files.
- **Add a distinct "not finished" status** — rejected: a new enum value needs a schema migration and a new UI branch for what `FAILED` already expresses; the reconciliation is one `UPDATE` against the existing vocabulary.

## Consequences

- A row is never stuck at `0 Б` presenting itself as downloaded: the library, its headline count and its size, and the offline episode list all key off `COMPLETED`.
- Interrupted bytes survive until the user either re-downloads the episode or deletes it; the app takes no filesystem action on them.
- `reconcile_interrupted_downloads` is idempotent: a second launch reports zero changed rows, and a clean library changes none — the same shape `purge_legacy_torrent_downloads` holds, and `test_startup` pins both.
- `bootstrap()` gains a third fallible step, reported as its own `StartupError::InterruptedDownloads` variant with the same actionable wording as the legacy cleanup failure.
