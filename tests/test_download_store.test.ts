import { afterEach, describe, expect, it, vi } from "vitest";
import { useDownloadStore } from "@/features/downloads";

const invoke = vi.fn().mockResolvedValue(undefined);
type TauriWindow = Window & { __TAURI_INTERNALS__?: { invoke: typeof invoke } };

function installTauri() {
  (window as TauriWindow).__TAURI_INTERNALS__ = { invoke };
}

function lastCommand() {
  const calls = invoke.mock.calls;
  const [command, args] = calls[calls.length - 1] as [unknown, unknown];
  return { command, args };
}

afterEach(() => {
  invoke.mockClear();
  delete (window as TauriWindow).__TAURI_INTERNALS__;
});

describe("downloads folder actions", () => {
  it("opens the torrent folder for files the WebView cannot play", async () => {
    installTauri();

    await useDownloadStore.getState().openDownloadsFolder(42, true);

    expect(lastCommand()).toEqual({
      command: "downloader_open_folder",
      args: { releaseId: 42, torrent: true },
    });
  });

  it("opens the HLS release folder by default", async () => {
    installTauri();

    await useDownloadStore.getState().openDownloadsFolder(42);

    expect(lastCommand()).toEqual({
      command: "downloader_open_folder",
      args: { releaseId: 42, torrent: false },
    });
  });

  it("opens the downloads root when no release is given", async () => {
    installTauri();

    await useDownloadStore.getState().openDownloadsFolder();

    expect(lastCommand()).toEqual({
      command: "downloader_open_folder",
      args: { releaseId: null, torrent: false },
    });
  });
});
