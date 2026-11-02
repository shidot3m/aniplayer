import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type CodecProbeEnvironment,
  probeCodecCapabilities,
} from "@/features/player/lib/codecCapability";
import { useCodecCapabilityStore } from "@/features/player/state/codecCapabilityStore";
import type { CodecCandidate, CodecFamily } from "@/shared/types";

const AVC_TYPE = 'video/mp4; codecs="avc1.640028"';
const HEVC_TYPE = 'video/mp4; codecs="hvc1.2.6.L153.B0"';
const VP9_TYPE = 'video/webm; codecs="vp09.00.10.08"';
const AAC_TYPE = 'audio/mp4; codecs="mp4a.40.2"';

function environment(options: {
  canPlayType?: Record<string, string>;
  mediaSource?: Record<string, boolean>;
  decodingInfo?: Partial<Record<CodecFamily, boolean>>;
}): CodecProbeEnvironment {
  const answers = options.canPlayType ?? {};
  return {
    createElement: () => ({ canPlayType: (type: string) => answers[type] ?? "" }),
    mediaSourceIsTypeSupported: options.mediaSource
      ? (type: string) => options.mediaSource?.[type] ?? false
      : undefined,
    decodingInfo: options.decodingInfo
      ? async (candidate: CodecCandidate) => options.decodingInfo?.[candidate.family] ?? false
      : undefined,
  };
}

describe("codec capability probe", () => {
  it("marks a codec the media element answers probably for as decodable", async () => {
    const report = await probeCodecCapabilities(
      environment({ canPlayType: { [AVC_TYPE]: "probably", [AAC_TYPE]: "probably" } }),
    );

    expect(report.codecs.h264).toBe("decodable");
    expect(report.codecs.aac).toBe("decodable");
  });

  it("marks a codec the media element refuses outright as undecodable", async () => {
    const report = await probeCodecCapabilities(environment({ canPlayType: {} }));

    expect(report.codecs.h264).toBe("undecodable");
  });

  it("reports HEVC as undecodable when the element guesses maybe and the platform has no decoder", async () => {
    const report = await probeCodecCapabilities(
      environment({ canPlayType: { [HEVC_TYPE]: "maybe" }, decodingInfo: { hevc: false } }),
    );

    expect(report.codecs.hevc).toBe("undecodable");
  });

  it("reports HEVC as decodable when the platform resolves the ambiguous answer with a decoder", async () => {
    const report = await probeCodecCapabilities(
      environment({ canPlayType: { [HEVC_TYPE]: "maybe" }, decodingInfo: { hevc: true } }),
    );

    expect(report.codecs.hevc).toBe("decodable");
  });

  it("treats a rejected MediaSource query as a negative but never as proof of decoding", async () => {
    const accepted = await probeCodecCapabilities(
      environment({
        canPlayType: { [VP9_TYPE]: "maybe" },
        mediaSource: { [VP9_TYPE]: true },
      }),
    );
    const rejected = await probeCodecCapabilities(
      environment({
        canPlayType: { [VP9_TYPE]: "maybe" },
        mediaSource: { [VP9_TYPE]: false },
      }),
    );

    expect(accepted.codecs.vp9).toBe("unknown");
    expect(rejected.codecs.vp9).toBe("undecodable");
  });

  it("never lets a failing platform query abort the probe", async () => {
    const env = environment({ canPlayType: { [AVC_TYPE]: "probably", [HEVC_TYPE]: "maybe" } });
    env.decodingInfo = async () => {
      throw new Error("query blocked");
    };

    const report = await probeCodecCapabilities(env);

    expect(report.codecs.h264).toBe("decodable");
    expect(report.codecs.hevc).toBe("unknown");
  });
});

type TauriWindow = Window & { __TAURI_INTERNALS__?: { invoke: typeof invoke } };
const invoke = vi.fn().mockResolvedValue(undefined);

describe("codec capability store", () => {
  afterEach(() => {
    invoke.mockClear();
    delete (window as TauriWindow).__TAURI_INTERNALS__;
    useCodecCapabilityStore.setState({ report: null, probed: false });
  });

  it("hands the probed report to the backend so the scanner can gate indexing", async () => {
    (window as TauriWindow).__TAURI_INTERNALS__ = { invoke };

    await useCodecCapabilityStore.getState().probe();

    const [command, args] = invoke.mock.calls[0] as [string, { report: unknown }];
    expect(command).toBe("app_report_codec_capability");
    expect(args.report).toMatchObject({ codecs: { hevc: "undecodable", h264: "undecodable" } });
    expect(useCodecCapabilityStore.getState().probed).toBe(true);
  });

  it("keeps the verdicts when the backend refuses the report", async () => {
    (window as TauriWindow).__TAURI_INTERNALS__ = { invoke };
    invoke.mockRejectedValueOnce(new Error("command missing"));

    await useCodecCapabilityStore.getState().probe();

    expect(useCodecCapabilityStore.getState().report?.codecs.hevc).toBe("undecodable");
  });

  it("probes once per session", async () => {
    (window as TauriWindow).__TAURI_INTERNALS__ = { invoke };

    await useCodecCapabilityStore.getState().probe();
    await useCodecCapabilityStore.getState().probe();

    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
