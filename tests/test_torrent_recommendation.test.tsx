import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDownloadStore } from "@/features/downloads";
import { useCodecCapabilityStore } from "@/features/player/state/codecCapabilityStore";
import { TorrentsTab } from "@/features/release/ui/TorrentsTab";
import type { CodecCapabilityReport, CodecFamily, CodecVerdict, TorrentItem } from "@/shared/types";

const ALL_FAMILIES: CodecFamily[] = ["h264", "hevc", "av1", "vp9", "aac", "opus", "vorbis"];

const hevcTorrent: TorrentItem = {
  id: 991,
  hash: "hevcHash",
  size: 1024 * 1024 * 500,
  label: "Серии 1-12 [HEVC 1080p]",
  filename: "release_hevc.torrent",
  seeders: 42,
  leechers: 3,
  codec: { value: "hevc", label: "x265 / HEVC" },
  quality: { value: "1080p", description: "Full HD" },
};

const h264Torrent: TorrentItem = {
  id: 992,
  hash: "h264Hash",
  size: 1024 * 1024 * 900,
  label: "Серии 1-12 [H.264 1080p]",
  filename: "release_h264.torrent",
  seeders: 17,
  leechers: 1,
  codec: { value: "h264", label: "x264 / AVC" },
  quality: { value: "1080p", description: "Full HD" },
};

function reportOf(verdicts: Partial<Record<CodecFamily, CodecVerdict>>): CodecCapabilityReport {
  const codecs = Object.fromEntries(
    ALL_FAMILIES.map((family) => [family, verdicts[family] ?? "unknown"]),
  ) as Record<CodecFamily, CodecVerdict>;
  return { codecs, probedAt: "2026-11-02T00:00:00Z" };
}

function seed(verdicts: Partial<Record<CodecFamily, CodecVerdict>> | null) {
  useDownloadStore.setState({ activeDownloads: {}, downloadedEpisodes: [] });
  useCodecCapabilityStore.setState({
    report: verdicts ? reportOf(verdicts) : null,
    probed: verdicts !== null,
  });
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [hevcTorrent, h264Torrent],
    }),
  );
});

describe("torrent recommendation against the codec probe", () => {
  it("warns off the HEVC download and points at H.264 on a machine without a decoder", async () => {
    seed({ hevc: "undecodable", h264: "decodable", aac: "decodable" });

    render(<TorrentsTab releaseId={1001} />);

    expect(await screen.findByText(/не декодирует HEVC/)).toBeDefined();
    expect(screen.getByText("HEVC не декодируется — рекомендуем H.264")).toBeDefined();
    expect(
      (screen.getByRole("button", { name: "Только HEVC (x265)" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    // The H.264 release carries no warning: the app remuxes its container itself.
    expect(screen.queryAllByText(/в приложении серия откроется/)).toHaveLength(1);
  });

  it("keeps recommending HEVC where the WebView decodes it", async () => {
    seed({ hevc: "decodable", h264: "decodable", aac: "decodable" });

    render(<TorrentsTab releaseId={1001} />);

    expect(await screen.findByText("HEVC доступен")).toBeDefined();
    expect(
      (screen.getByRole("button", { name: "Только HEVC (x265)" }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(screen.queryByText(/не декодирует/)).toBeNull();
  });

  it("claims nothing about this machine before the probe has answered", async () => {
    seed(null);

    render(<TorrentsTab releaseId={1001} />);

    expect(await screen.findAllByText("Скачать в приложение")).toHaveLength(2);
    expect(screen.queryByText(/не декодирует/)).toBeNull();
    expect(screen.getByText("HEVC доступен")).toBeDefined();
    expect(
      (screen.getByRole("button", { name: "Только HEVC (x265)" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
