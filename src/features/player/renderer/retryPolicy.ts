import workerPath from "hls.js/dist/hls.worker.js?url";

/**
 * A request the CDN left unanswered must cost a pause, not a frozen frame. Measured on the live
 * stream (docs/evidence/62): `#EXT-X-TARGETDURATION: 12`, median segment 10 s, 138 segments per
 * 22:55 Episode, each fetched as a 302 onto one of several `cache*.libria.fun` backends — and the
 * backend is chosen by the segment, so asking for the SAME segment again lands on the SAME
 * machine. Retries therefore pay off only against a blip, not against a dead host; the session
 * plan below is what moves past a dead one.
 *
 * Deliberate departures from hls.js defaults: the manifest policy stops trusting a first byte
 * that never arrives (default `maxTimeToFirstByteMs: Infinity` — the shape of the #45 wedge),
 * a segment gives up in 20 s instead of 2 min, and every retry pauses and grows instead of
 * hammering the same dead host back-to-back. Retry counts stay small because each one costs the
 * viewer buffer, and because the session has its own budget on top of these.
 */
const SEGMENT_POLICY = {
  maxTimeToFirstByteMs: 8_000,
  maxLoadTimeMs: 20_000,
  timeoutRetry: {
    maxNumRetry: 2,
    retryDelayMs: 500,
    maxRetryDelayMs: 2_000,
    backoff: "exponential" as const,
  },
  errorRetry: {
    maxNumRetry: 2,
    retryDelayMs: 500,
    maxRetryDelayMs: 4_000,
    backoff: "exponential" as const,
  },
};

/** A playlist is small and answers fast or not at all: the same bound, fewer, longer pauses. */
const PLAYLIST_POLICY = {
  maxTimeToFirstByteMs: 8_000,
  maxLoadTimeMs: 12_000,
  timeoutRetry: {
    maxNumRetry: 3,
    retryDelayMs: 1_000,
    maxRetryDelayMs: 8_000,
    backoff: "exponential" as const,
  },
  errorRetry: {
    maxNumRetry: 3,
    retryDelayMs: 1_000,
    maxRetryDelayMs: 8_000,
    backoff: "exponential" as const,
  },
};

/**
 * The transmuxer runs on a Web Worker so a retry storm cannot take the React controls down with
 * it — the other half of the #45 symptom. hls.js ships as ESM here, and the ESM build cannot
 * find its own worker: `workerPath` is what puts transmuxing off the main thread.
 *
 * `lowLatencyMode` stays off: it is for live playlists with partial segments, and the catalog
 * serves flat VOD playlists. Left on it would reload every playlist for no benefit.
 */
export const playbackLoadPolicy = {
  enableWorker: true,
  workerPath,
  lowLatencyMode: false,
  fragLoadPolicy: { default: SEGMENT_POLICY },
  playlistLoadPolicy: { default: PLAYLIST_POLICY },
  manifestLoadPolicy: { default: PLAYLIST_POLICY },
};

/** `#EXT-X-TARGETDURATION` of the catalog's playlists, measured in the #62 live pass. */
const SEGMENT_SECONDS = 12;

/**
 * The session's own budget on top of the library's.
 *
 * Measured on the live app: a catalog playlist is a single tier, so a segment that never arrives
 * never becomes a *fatal* error — hls.js simply retries the same segment forever, and that loop is
 * the frozen frame of #45. Two triggers therefore walk the same ladder: the library declaring the
 * network fatal, and the session's own count of failed segments.
 *
 * Every step of the ladder moves one segment further into the playlist. That is the only lever the
 * measurement leaves: the 302 backend is chosen by the segment path and stays chosen, so asking the
 * same segment again — or the playlist, which names the same segment — always reaches the same dead
 * machine, while the next segment is a new 302 to a different one. Six steps because a step costs
 * the viewer up to 12 s of an Episode and 12 s of patience; after six the CDN is not rotating, it is
 * gone, and the fault says so. The budget is spent, not owed: a fragment that arrives refills it, so
 * a long Episode survives many dead hosts instead of accumulating toward a fault.
 */
export const networkWalkPlan = [
  { delayMs: 2_000, skipSeconds: SEGMENT_SECONDS },
  { delayMs: 2_000, skipSeconds: 2 * SEGMENT_SECONDS },
  { delayMs: 4_000, skipSeconds: 3 * SEGMENT_SECONDS },
  { delayMs: 4_000, skipSeconds: 4 * SEGMENT_SECONDS },
  { delayMs: 8_000, skipSeconds: 5 * SEGMENT_SECONDS },
  { delayMs: 8_000, skipSeconds: 6 * SEGMENT_SECONDS },
];

/**
 * How many times one segment may fail before the session stops waiting for the library and walks.
 * Two is what the segment policy above is allowed to spend on its own (the initial load plus
 * `maxNumRetry: 2`), so the third failure means every retry that was granted has been used up.
 */
export const segmentFailureLimit = 3;
