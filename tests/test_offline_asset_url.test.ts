import { afterEach, describe, expect, it, vi } from "vitest";
import { offlineStreamUrl } from "@/features/downloads/lib/offlineSource";

type TauriInternals = { convertFileSrc: (path: string) => string };
type TauriWindow = Window & { isTauri?: boolean; __TAURI_INTERNALS__?: TauriInternals };

vi.mock("@tauri-apps/api/core", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, invoke: vi.fn() };
});

async function invokeMock(): Promise<ReturnType<typeof vi.fn>> {
  const core = await import("@tauri-apps/api/core");
  return core.invoke as unknown as ReturnType<typeof vi.fn>;
}

function installTauri(convertFileSrc: TauriInternals["convertFileSrc"]) {
  const tauriWindow = window as TauriWindow;
  tauriWindow.isTauri = true;
  tauriWindow.__TAURI_INTERNALS__ = { convertFileSrc };
}

afterEach(() => {
  const tauriWindow = window as TauriWindow;
  delete tauriWindow.isTauri;
  delete tauriWindow.__TAURI_INTERNALS__;
  vi.clearAllMocks();
});

describe("offline stream URL", () => {
  it("serves a downloaded episode through the asset protocol inside Tauri", async () => {
    installTauri((path) => `http://asset.localhost/${encodeURIComponent(path)}`);

    await expect(offlineStreamUrl("C:\\downloads\\10239\\1.mp4")).resolves.toBe(
      "http://asset.localhost/C%3A%5Cdownloads%5C10239%5C1.mp4",
    );
  });

  it("keeps the file path when running outside Tauri", async () => {
    await expect(offlineStreamUrl("C:\\downloads\\10239\\1.mp4")).resolves.toBe(
      "C:\\downloads\\10239\\1.mp4",
    );
  });

  it("uses forward slashes for a downloaded playlist so relative segments resolve", async () => {
    installTauri((path) => `http://asset.localhost/${encodeURIComponent(path)}`);

    await expect(offlineStreamUrl("C:\\downloads\\10239\\1\\index.m3u8")).resolves.toBe(
      "http://asset.localhost/C%3A/downloads/10239/1/index.m3u8",
    );
  });

  it("asks the backend for a stream URL instead of exposing a Matroska path", async () => {
    installTauri((path) => `http://asset.localhost/${encodeURIComponent(path)}`);
    const invoke = await invokeMock();
    invoke.mockResolvedValue("http://remux.localhost/7");

    await expect(offlineStreamUrl("C:\\downloads\\torrents\\10239\\01.mkv")).resolves.toBe(
      "http://remux.localhost/7",
    );
    expect(invoke).toHaveBeenCalledWith("downloader_prepare_stream", {
      filePath: "C:\\downloads\\torrents\\10239\\01.mkv",
    });
  });

  it("lets a refused remux reach the caller rather than opening a dead path", async () => {
    installTauri((path) => `http://asset.localhost/${encodeURIComponent(path)}`);
    const invoke = await invokeMock();
    invoke.mockRejectedValue(new Error("Этот компьютер не декодирует HEVC"));

    await expect(offlineStreamUrl("C:\\downloads\\torrents\\10239\\01.mkv")).rejects.toThrow(
      "не декодирует HEVC",
    );
  });
});
