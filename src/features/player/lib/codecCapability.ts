import type {
  CodecCandidate,
  CodecCapabilityReport,
  CodecFamily,
  CodecVerdict,
} from "@/shared/types";

/** The webview questions the probe asks; injected so tests can answer them. */
export interface CodecProbeEnvironment {
  createElement: () => { canPlayType: (type: string) => string };
  mediaSourceIsTypeSupported?: (type: string) => boolean;
  decodingInfo?: (candidate: CodecCandidate) => Promise<boolean>;
}

/**
 * One string per codec family: the profile the app actually meets in the wild.
 * HEVC is probed at Main 10 because that is what AniLiberty ships, and a machine
 * that can only decode Main 8 is reported as unable rather than handed a black
 * frame.
 */
export const CODEC_CANDIDATES: CodecCandidate[] = [
  { family: "h264", kind: "video", container: "video/mp4", codec: "avc1.640028" },
  { family: "hevc", kind: "video", container: "video/mp4", codec: "hvc1.2.6.L153.B0" },
  { family: "av1", kind: "video", container: "video/mp4", codec: "av01.0.05M.08" },
  { family: "vp9", kind: "video", container: "video/webm", codec: "vp09.00.10.08" },
  { family: "aac", kind: "audio", container: "audio/mp4", codec: "mp4a.40.2" },
  { family: "opus", kind: "audio", container: "audio/webm", codec: "opus" },
  { family: "vorbis", kind: "audio", container: "audio/webm", codec: "vorbis" },
];

export function candidateType(candidate: CodecCandidate): string {
  return `${candidate.container}; codecs="${candidate.codec}"`;
}

/** How a family is named to the user; the same words the backend uses. */
const CODEC_LABELS: Record<CodecFamily, string> = {
  h264: "H.264",
  hevc: "HEVC",
  av1: "AV1",
  vp9: "VP9",
  aac: "AAC",
  opus: "Opus",
  vorbis: "Vorbis",
};

export function codecFamilyLabel(family: CodecFamily): string {
  return CODEC_LABELS[family];
}

function browserEnvironment(): CodecProbeEnvironment {
  return {
    createElement: () => document.createElement("video"),
    mediaSourceIsTypeSupported:
      typeof MediaSource !== "undefined" && typeof MediaSource.isTypeSupported === "function"
        ? (type) => MediaSource.isTypeSupported(type)
        : undefined,
    decodingInfo: (() => {
      const capabilities: MediaCapabilities | undefined = navigator.mediaCapabilities;
      if (!capabilities) return undefined;
      return async (candidate: CodecCandidate) => {
        const info = await capabilities.decodingInfo({
          type: "file",
          video:
            candidate.kind === "video"
              ? {
                  contentType: candidateType(candidate),
                  width: 1920,
                  height: 1080,
                  framerate: 23.976,
                  bitrate: 8_000_000,
                }
              : undefined,
          audio:
            candidate.kind === "audio"
              ? { contentType: candidateType(candidate), channels: "2", bitrate: 320_000 }
              : undefined,
        });
        return info.supported;
      };
    })(),
  };
}

async function resolveCandidate(
  candidate: CodecCandidate,
  env: CodecProbeEnvironment,
): Promise<CodecVerdict> {
  const type = candidateType(candidate);
  const answer = env.createElement().canPlayType(type).trim().toLowerCase();
  if (answer === "probably") return "decodable";
  if (answer === "") return "undecodable";

  // "maybe" is the WebView guessing from the container without looking at the
  // decoder, so it decides nothing on its own: the platform query does.
  if (env.decodingInfo) {
    try {
      return (await env.decodingInfo(candidate)) ? "decodable" : "undecodable";
    } catch {
      return env.mediaSourceIsTypeSupported?.(type) === false ? "undecodable" : "unknown";
    }
  }

  // A MediaSource rejection is a real negative; acceptance only proves the
  // bitstream parses, not that anything can decode it.
  const mediaSource = env.mediaSourceIsTypeSupported?.(type);
  if (mediaSource === false) return "undecodable";
  return "unknown";
}

export async function probeCodecCapabilities(
  env: CodecProbeEnvironment = browserEnvironment(),
): Promise<CodecCapabilityReport> {
  const codecs = {} as Record<CodecFamily, CodecVerdict>;
  const pending = CODEC_CANDIDATES.map(async (candidate) => {
    codecs[candidate.family] = await resolveCandidate(candidate, env);
  });
  await Promise.all(pending);

  return { codecs, probedAt: new Date().toISOString() };
}

/** `unknown` never opens playback: an unprobed codec is treated as unavailable. */
export function isDecodable(report: CodecCapabilityReport | null, family: CodecFamily): boolean {
  return report?.codecs[family] === "decodable";
}
