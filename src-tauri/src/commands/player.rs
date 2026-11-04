use tauri::State;

use crate::playback::{resolve_source, ResolvedSource};
use crate::state::AppState;

/// The playable source behind an Episode's `hls_*` field: a stream URL the WebView may load
/// directly, or a canonical file in the downloads folder it must load through the asset
/// protocol. Validation is a couple of filesystem calls and guards no shared session, so it
/// runs on the command thread it is handed and needs no `async`.
#[tauri::command]
pub(crate) fn player_resolve_source(
    state: State<'_, AppState>,
    source: String,
) -> Result<ResolvedSource, String> {
    resolve_source(&state.app_dir, &source)
}
