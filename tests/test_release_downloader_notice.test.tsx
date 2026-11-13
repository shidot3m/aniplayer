import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDownloadStore } from "@/features/downloads";
import { useReleaseDownloader } from "@/features/release/hooks/useReleaseDownloader";
import type { EpisodeItem, Release } from "@/shared/types";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));

function episode(overrides: Partial<EpisodeItem> = {}): EpisodeItem {
  return {
    id: "ep-100",
    ordinal: 3,
    hls_1080: "https://cdn/1080/index.m3u8",
    opening: { start: 23, stop: 113 },
    ending: { start: 800, stop: 890 },
    ...overrides,
  };
}

function release(episodes: EpisodeItem[]): Release {
  return {
    id: 42,
    name: { main: "Тест" },
    episodes,
  } as unknown as Release;
}

async function downloadEp(ep: EpisodeItem, rel: Release) {
  const { result } = renderHook(() => useReleaseDownloader(rel));
  await result.current.handleDownload(ep);
  return result;
}

beforeEach(() => {
  invoke.mockReset();
  vi.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  useDownloadStore.setState({ activeDownloads: {}, isWidgetVisible: true });
});

describe("release downloader reports through the widget, not native dialogs", () => {
  it("a missing stream becomes a failure line in the downloads widget", async () => {
    const ep = episode({ hls_1080: null, hls_720: null, hls_480: null });
    await downloadEp(ep, release([ep]));

    expect(window.alert).not.toHaveBeenCalled();
    expect(useDownloadStore.getState().activeDownloads["ep-100"]).toMatchObject({
      episodeId: "ep-100",
      releaseId: 42,
      episodeOrdinal: 3,
      status: "FAILED",
      error: "Поток для скачивания не найден",
    });
  });

  it("a failed start reports the backend error as a failure line", async () => {
    invoke.mockRejectedValueOnce("network down");
    const ep = episode();
    await downloadEp(ep, release([ep]));

    expect(window.alert).not.toHaveBeenCalled();
    expect(useDownloadStore.getState().activeDownloads["ep-100"]).toMatchObject({
      status: "FAILED",
      error: "Ошибка: network down",
    });
  });

  it("a started download asks the backend and shows no native dialog", async () => {
    invoke.mockResolvedValueOnce("Started downloading episode 3");
    const ep = episode();
    await downloadEp(ep, release([ep]));

    expect(window.alert).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith(
      "downloader_start_episode",
      expect.objectContaining({ releaseId: 42 }),
    );
    // The success line comes from backend progress events, so the hook adds no notice itself.
    expect(useDownloadStore.getState().activeDownloads["ep-100"]).toBeUndefined();
  });

  it("a release with no streams reports a failure line for the whole batch", async () => {
    const eps = [episode({ id: "a", hls_1080: null }), episode({ id: "b", hls_1080: null })];
    const { result } = renderHook(() => useReleaseDownloader(release(eps)));
    await result.current.handleDownloadAll();

    expect(window.alert).not.toHaveBeenCalled();
    expect(useDownloadStore.getState().activeDownloads["release-42"]).toMatchObject({
      status: "FAILED",
      error: "Нет доступных видеопотоков для скачивания этого тайтла",
    });
  });
});
