import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHlsVideo } from "@/features/player/renderer/useHlsVideo";

const hls = vi.hoisted(() => ({
  loadSource: vi.fn(),
  attachMedia: vi.fn(),
  on: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("hls.js", () => {
  class HlsMock {
    static isSupported = () => true;
    static Events = { MANIFEST_PARSED: "manifestParsed", ERROR: "error" };
    static ErrorTypes = { NETWORK_ERROR: "networkError", MEDIA_ERROR: "mediaError" };

    loadSource = hls.loadSource;
    attachMedia = hls.attachMedia;
    on = hls.on;
    destroy = hls.destroy;
  }

  return { default: HlsMock };
});

function VideoHarness({ src }: { src: string }) {
  const { videoRef } = useHlsVideo({
    streamUrl: src,
    isPlaying: false,
    volume: 100,
    isMuted: false,
    speed: 1,
  });

  return (
    <video ref={videoRef} data-testid="video">
      <track kind="captions" />
    </video>
  );
}

function renderedVideo() {
  return screen.getByTestId("video") as HTMLVideoElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("offline video source", () => {
  it("plays a downloaded episode natively instead of handing it to hls.js", () => {
    const assetUrl = "http://asset.localhost/C%3A%5Cdownloads%5C10239%5C1.mp4";

    render(<VideoHarness src={assetUrl} />);

    expect(renderedVideo().getAttribute("src")).toBe(assetUrl);
    expect(hls.loadSource).not.toHaveBeenCalled();
  });

  it("still routes HLS playlists through hls.js", () => {
    const streamUrl = "https://cache.libria.fun/videos/10329/1080/index.m3u8?token=abc";

    render(<VideoHarness src={streamUrl} />);

    expect(hls.loadSource).toHaveBeenCalledWith(streamUrl);
    expect(renderedVideo().getAttribute("src")).toBeNull();
  });
});
