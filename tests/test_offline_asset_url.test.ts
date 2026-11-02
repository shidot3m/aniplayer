import { describe, expect, it } from "vitest";
import { offlinePlaybackSource } from "@/features/downloads/lib/offlineSource";

describe("offline playback source", () => {
  it.each([
    "C:\\downloads\\10239\\1.mp4",
    "C:\\downloads\\10239\\1\\index.m3u8",
    "C:\\downloads\\torrents\\10239\\01.mkv",
  ])("passes the local path directly to mpv: %s", (path) => {
    expect(offlinePlaybackSource(path)).toBe(path);
  });
});
