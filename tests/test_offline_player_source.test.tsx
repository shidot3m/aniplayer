import { fireEvent, render, screen } from "@testing-library/react";
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

function VideoHarness({ src, initialTime = 0 }: { src: string; initialTime?: number }) {
  const { videoRef } = useHlsVideo({
    streamUrl: src,
    isPlaying: false,
    volume: 100,
    isMuted: false,
    speed: 1,
    initialTime,
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

  it("applies the initial playback settings once the file metadata is loaded", () => {
    render(
      <VideoHarness
        src="http://asset.localhost/C%3A%5Cdownloads%5C10239%5C1.mp4"
        initialTime={5}
      />,
    );
    const video = renderedVideo();

    expect(video.currentTime).toBe(0);
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(5);
    expect(video.volume).toBe(1);
  });

  it("still routes HLS playlists through hls.js", () => {
    const streamUrl = "https://cache.libria.fun/videos/10329/1080/index.m3u8?token=abc";

    render(<VideoHarness src={streamUrl} />);

    expect(hls.loadSource).toHaveBeenCalledWith(streamUrl);
    expect(renderedVideo().getAttribute("src")).toBeNull();
  });

  it("routes a downloaded playlist through hls.js because WebView2 cannot demux TS natively", () => {
    const assetUrl = "http://asset.localhost/E%3A%5Cdownloads%5C10239%5C1%5Cindex.m3u8";

    render(<VideoHarness src={assetUrl} />);

    expect(hls.loadSource).toHaveBeenCalledWith(assetUrl);
    expect(renderedVideo().getAttribute("src")).toBeNull();
  });

  it("plays a remuxed Matroska episode natively, as the plain MP4 the remux made it", () => {
    const remuxUrl = "http://remux.localhost/3";

    render(<VideoHarness src={remuxUrl} />);

    expect(renderedVideo().getAttribute("src")).toBe(remuxUrl);
    expect(hls.loadSource).not.toHaveBeenCalled();
  });

  it("leaves remote streams that are not asset URLs on the hls.js path", () => {
    const streamUrl = "https://cache.libria.fun/videos/10329/1080/stream";

    render(<VideoHarness src={streamUrl} />);

    expect(hls.loadSource).toHaveBeenCalledWith(streamUrl);
    expect(renderedVideo().getAttribute("src")).toBeNull();
  });
});
