import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useCatalogStore } from "@/features/catalog";
import { DownloadsView, useDownloadStore } from "@/features/downloads";
import type { DownloadedEpisodeMeta, Release, UnsupportedTorrentFile } from "@/shared/types";

const release: Release = {
  id: 10239,
  name: { main: "Тестовое аниме" },
  episodes: [],
};

const downloadedEpisode: DownloadedEpisodeMeta = {
  episode_id: "ep-1",
  release_id: 10239,
  episode_ordinal: 1,
  file_path: "C:\\Aniplayer\\downloads\\10239\\1\\index.m3u8",
  file_size: 1024,
  quality: "1080p",
  opening_start: null,
  opening_stop: null,
  ending_start: null,
  ending_stop: null,
  download_status: "COMPLETED",
};

const unsupportedFiles: UnsupportedTorrentFile[] = [
  {
    release_id: 10239,
    file_name: "Season 1/02.mkv",
    file_path: "C:\\Aniplayer\\downloads\\torrents\\10239\\Season 1\\02.mkv",
    file_size: 2048,
  },
  {
    release_id: 10239,
    file_name: "Season 1/03.avi",
    file_path: "C:\\Aniplayer\\downloads\\torrents\\10239\\Season 1\\03.avi",
    file_size: 4096,
  },
];

function seedStores(downloaded: DownloadedEpisodeMeta[], unsupported: UnsupportedTorrentFile[]) {
  useCatalogStore.setState({ latestReleases: [release], history: [] });
  useDownloadStore.setState({
    downloadedEpisodes: downloaded,
    unsupportedFiles: unsupported,
  });
}

beforeEach(() => {
  seedStores([], []);
});

describe("downloads view unsupported torrent files", () => {
  it("reports torrent files the WebView cannot play with an actionable message", () => {
    seedStores([downloadedEpisode], unsupportedFiles);

    render(<DownloadsView />);

    expect(screen.getByText(/не открывает такие файлы/)).toBeDefined();
    expect(screen.getByText(/02\.mkv/)).toBeDefined();
    expect(screen.getByText(/03\.avi/)).toBeDefined();
    expect(screen.getByText(/перекодируйте их в MP4/i)).toBeDefined();
    expect(screen.getByText("Открыть папку")).toBeDefined();
  });

  it("shows the warning instead of the empty state when only unsupported files exist", () => {
    seedStores([], unsupportedFiles);

    render(<DownloadsView />);

    expect(screen.getByText(/не открывает такие файлы/)).toBeDefined();
    expect(screen.queryByText("Нет скачанных серий")).toBeNull();
  });
});
