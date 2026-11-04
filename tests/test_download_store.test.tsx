import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDownloadStore } from "@/features/downloads";
import { DownloadFloatingWidget } from "@/features/downloads/ui/DownloadFloatingWidget";
import { formatBytes } from "@/shared/lib/utils";

const invoke = vi.hoisted(() => vi.fn().mockResolvedValue(null));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));

const progressEvents = vi.hoisted(() => ({
  callback: undefined as ((event: { payload: unknown }) => void) | undefined,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((_name: string, callback: (event: { payload: unknown }) => void) => {
    progressEvents.callback = callback;
    return Promise.resolve(() => {});
  }),
}));

type TauriWindow = Window & { __TAURI_INTERNALS__?: unknown };

function installTauri() {
  (window as TauriWindow).__TAURI_INTERNALS__ = { invoke };
}

function lastCommand() {
  const calls = invoke.mock.calls;
  const [command, args] = calls[calls.length - 1] as [unknown, unknown];
  return { command, args };
}

/** One sampled progress line for an in-flight HLS episode download. */
function hlsProgress(overrides: Record<string, unknown> = {}) {
  return {
    episodeId: "ep-100",
    releaseId: 42,
    episodeOrdinal: 3,
    totalSegments: 900,
    downloadedSegments: 450,
    downloadedBytes: 205_550_000,
    percent: 50,
    speed: 6_291_456,
    status: "DOWNLOADING",
    error: null,
    ...overrides,
  };
}

async function reportProgress(payload: Record<string, unknown>) {
  await useDownloadStore.getState().listenToProgress();
  progressEvents.callback?.({ payload });
}

afterEach(() => {
  invoke.mockClear();
  progressEvents.callback = undefined;
  delete (window as TauriWindow).__TAURI_INTERNALS__;
  useDownloadStore.setState({ activeDownloads: {}, isWidgetVisible: true, downloadedEpisodes: [] });
});

describe("downloads folder actions", () => {
  it("opens the release folder of the downloaded episodes", async () => {
    installTauri();

    await useDownloadStore.getState().openDownloadsFolder(42);

    expect(lastCommand()).toEqual({ command: "downloader_open_folder", args: { releaseId: 42 } });
  });

  it("opens the downloads root when no release is given", async () => {
    installTauri();

    await useDownloadStore.getState().openDownloadsFolder();

    expect(lastCommand()).toEqual({ command: "downloader_open_folder", args: { releaseId: null } });
  });
});

describe("HLS download queue", () => {
  it("keeps an in-flight HLS download with its bytes, percent and speed", async () => {
    installTauri();
    await reportProgress(hlsProgress());

    expect(useDownloadStore.getState().activeDownloads["ep-100"]).toEqual({
      episodeId: "ep-100",
      releaseId: 42,
      episodeOrdinal: 3,
      totalSegments: 900,
      downloadedSegments: 450,
      downloadedBytes: 205_550_000,
      percent: 50,
      speed: 6_291_456,
      status: "DOWNLOADING",
      error: null,
    });
  });

  it("drops a task the backend reports as cancelled", async () => {
    installTauri();
    await reportProgress(hlsProgress());
    await reportProgress(hlsProgress({ status: "CANCELLED" }));

    expect(useDownloadStore.getState().activeDownloads["ep-100"]).toBeUndefined();
  });

  it("cancels one task and asks the backend to stop just that episode", async () => {
    installTauri();
    await reportProgress(hlsProgress());

    await useDownloadStore.getState().cancelDownload("ep-100");

    expect(useDownloadStore.getState().activeDownloads).toEqual({});
    expect(lastCommand()).toEqual({
      command: "downloader_cancel_episode",
      args: { episodeId: "ep-100" },
    });
  });

  it("empties the whole queue on cancel all", async () => {
    installTauri();
    await reportProgress(hlsProgress());
    await reportProgress(hlsProgress({ episodeId: "ep-101", episodeOrdinal: 4 }));

    await useDownloadStore.getState().cancelAllDownloads();

    expect(useDownloadStore.getState().activeDownloads).toEqual({});
    expect(lastCommand()).toEqual({ command: "downloader_cancel_all", args: undefined });
  });
});

describe("download widget", () => {
  it("shows transferred bytes, percentage and speed for a downloading episode", async () => {
    installTauri();
    await reportProgress(hlsProgress());

    render(<DownloadFloatingWidget />);

    expect(screen.getByText("Эпизод 3")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText(/450 \/ 900 сегментов/)).toBeTruthy();
    expect(screen.getByText(formatBytes(205_550_000))).toBeTruthy();
    expect(screen.getByText(`${formatBytes(6_291_456)}/с`)).toBeTruthy();
  });

  it("names no peers anywhere", async () => {
    installTauri();
    await reportProgress(hlsProgress());

    const { container } = render(<DownloadFloatingWidget />);

    expect(container.textContent).not.toMatch(/пир|peer|сид|сидер/i);
  });
});
