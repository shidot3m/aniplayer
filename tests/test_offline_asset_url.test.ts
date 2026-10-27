import { afterEach, describe, expect, it } from "vitest";
import { offlineStreamUrl } from "@/features/downloads/lib/offlineSource";

type TauriInternals = { convertFileSrc: (path: string) => string };
type TauriWindow = Window & { isTauri?: boolean; __TAURI_INTERNALS__?: TauriInternals };

function installTauri(convertFileSrc: TauriInternals["convertFileSrc"]) {
  const tauriWindow = window as TauriWindow;
  tauriWindow.isTauri = true;
  tauriWindow.__TAURI_INTERNALS__ = { convertFileSrc };
}

afterEach(() => {
  const tauriWindow = window as TauriWindow;
  delete tauriWindow.isTauri;
  delete tauriWindow.__TAURI_INTERNALS__;
});

describe("offline stream URL", () => {
  it("serves a downloaded episode through the asset protocol inside Tauri", () => {
    installTauri((path) => `http://asset.localhost/${encodeURIComponent(path)}`);

    expect(offlineStreamUrl("C:\\downloads\\10239\\1.mp4")).toBe(
      "http://asset.localhost/C%3A%5Cdownloads%5C10239%5C1.mp4",
    );
  });

  it("keeps the file path when running outside Tauri", () => {
    expect(offlineStreamUrl("C:\\downloads\\10239\\1.mp4")).toBe("C:\\downloads\\10239\\1.mp4");
  });
});
