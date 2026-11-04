use tauri::State;

use crate::playback::resolve_source;
use crate::state::AppState;

/// The playable URL behind an Episode's `hls_*` field: a stream URL the WebView loads
/// directly, or an asset-protocol URL for a file in the downloads folder.
///
/// Validation is a couple of filesystem calls and guards no shared session, so it runs on the
/// command thread it is handed and needs no `async`.
#[tauri::command]
pub(crate) fn player_resolve_source(
    state: State<'_, AppState>,
    source: String,
) -> Result<String, String> {
    resolve_source(&state.app_dir, &source)
}
