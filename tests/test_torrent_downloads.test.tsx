import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TorrentsTab } from "@/features/release/ui/TorrentsTab";
import type { TorrentItem } from "../src/shared/types";
import { useDownloadStore } from "../src/store/downloadStore";

const mockTorrents: TorrentItem[] = [
  {
    id: 991,
    hash: "abc123hash",
    size: 1024 * 1024 * 500, // 500MB
    label: "Серии 1-12 [HEVC 1080p]",
    filename: "jujutsu_kaisen_s1_hevc.torrent",
    seeders: 42,
    leechers: 3,
    magnet: "magnet:?xt=urn:btih:abc123hash&dn=jujutsu",
    codec: {
      value: "hevc",
      label: "x265 / HEVC",
    },
    quality: {
      value: "1080p",
      description: "Full HD",
    },
  },
];

describe("Torrent Engine and Download Store", () => {
  beforeEach(() => {
    // Reset Zustand store state before each test
    useDownloadStore.setState({
      activeDownloads: {},
      downloadedEpisodes: [],
    });
    // Mock global fetch for TorrentsTab
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTorrents,
      }),
    );
  });

  it("adds torrent to activeDownloads when startTorrentDownload is called", async () => {
    const store = useDownloadStore.getState();
    await act(async () => {
      await store.startTorrentDownload(1001, 991, "magnet:?xt=urn:btih:abc123hash");
    });

    const active = useDownloadStore.getState().activeDownloads;
    expect(active["torrent-991"]).toBeDefined();
    expect(active["torrent-991"].releaseId).toBe(1001);
    expect(active["torrent-991"].status).toBe("DOWNLOADING");
  });

  it("removes torrent from activeDownloads when cancelDownload is called", async () => {
    const store = useDownloadStore.getState();
    await act(async () => {
      await store.startTorrentDownload(1001, 991, "magnet:?xt=urn:btih:abc123hash");
    });
    expect(useDownloadStore.getState().activeDownloads["torrent-991"]).toBeDefined();

    await act(async () => {
      await store.cancelDownload("torrent-991");
    });
    expect(useDownloadStore.getState().activeDownloads["torrent-991"]).toBeUndefined();
  });

  it("renders 'Скачать в приложение' button and reflects downloading state in TorrentsTab", async () => {
    render(<TorrentsTab releaseId={1001} />);

    // Wait for torrents to load
    const downloadBtn = await screen.findByText("Скачать в приложение");
    expect(downloadBtn).toBeDefined();

    // Click download in app
    await act(async () => {
      fireEvent.click(downloadBtn);
    });

    // Verify it is now marked as downloading
    expect(useDownloadStore.getState().activeDownloads["torrent-991"]).toBeDefined();

    // The UI should display download progress or cancel button
    expect(await screen.findByText(/Отмена/)).toBeDefined();
  });
});
