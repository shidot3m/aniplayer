import { vi } from "vitest";

/**
 * The hls.js boundary the player tests drive. It is the module the renderer talks to, so
 * stubbing it keeps the tests on the public seam: what URL was loaded, which element was
 * attached, and how the renderer reacts to the events a real transmuxer would emit.
 */
type Handler = (event: string, data?: unknown) => void;

export interface FakeErrorData {
  type: string;
  details?: string;
  fatal: boolean;
}

class FakeHls {
  static readonly instances: FakeHls[] = [];
  static readonly Events = {
    MANIFEST_PARSED: "hlsManifestParsed",
    FRAG_LOADED: "hlsFragLoaded",
    ERROR: "hlsError",
  };
  static readonly ErrorTypes = {
    NETWORK_ERROR: "networkError",
    MEDIA_ERROR: "mediaError",
  };
  static readonly ErrorDetails = {
    FRAG_LOAD_ERROR: "fragLoadError",
    FRAG_LOAD_TIMEOUT: "fragLoadTimeout",
  };
  static isSupported = vi.fn(() => true);

  readonly handlers = new Map<string, Set<Handler>>();
  /** What the player feature asked the library to do, captured at the constructor seam. */
  readonly config: Record<string, unknown>;
  media: HTMLVideoElement | null = null;
  loadedSource: string | null = null;
  readonly attachMedia = vi.fn((media: HTMLVideoElement) => {
    this.media = media;
  });
  readonly detachMedia = vi.fn(() => {
    this.media = null;
  });
  readonly loadSource = vi.fn((url: string) => {
    this.loadedSource = url;
  });
  readonly startLoad = vi.fn();
  readonly recoverMediaError = vi.fn();
  readonly destroy = vi.fn(() => {
    this.handlers.clear();
    const index = FakeHls.instances.indexOf(this);
    if (index >= 0) FakeHls.instances.splice(index, 1);
  });

  constructor(config: Record<string, unknown> = {}) {
    this.config = config;
    FakeHls.instances.push(this);
  }

  readonly on = vi.fn((event: string, handler: Handler) => {
    const set = this.handlers.get(event) ?? new Set<Handler>();
    set.add(handler);
    this.handlers.set(event, set);
  });

  /** Fires an event the way the library would, from outside the renderer. */
  emit(event: string, data?: unknown): void {
    for (const handler of this.handlers.get(event) ?? []) handler(event, data);
  }
}

export { FakeHls };

/** A live session, for assertions that a switch or a resume kept the one instance. */
export function activeSession(): FakeHls | undefined {
  return FakeHls.instances[FakeHls.instances.length - 1];
}

export function resetMediaStub(): void {
  fakeDuration = Number.NaN;
  fakeReadyState = 0;
}

export function resetHlsStub(): void {
  FakeHls.instances.length = 0;
  FakeHls.isSupported.mockReturnValue(true);
}

/**
 * jsdom ships a media element whose duration and playback are inert. These two helpers make
 * one observable so a test can hand the renderer a real `timeupdate` and see what the element
 * was asked to do.
 */
let fakeDuration = Number.NaN;
let fakeReadyState = 0;

export function setMediaDuration(seconds: number): void {
  fakeDuration = seconds;
}

/** `HAVE_NOTHING` until media arrives, `HAVE_FUTURE_DATA` once it can keep playing. */
export function setMediaReadyState(state: number): void {
  fakeReadyState = state;
}

/** The one buffered range the fake element reports: `[start, end]`, or none when `null`. */
export function setMediaBuffered(range: [number, number] | null): void {
  Object.defineProperty(HTMLMediaElement.prototype, "buffered", {
    configurable: true,
    get() {
      if (!range) return { length: 0, start: () => 0, end: () => 0 };
      return { length: 1, start: () => range[0], end: () => range[1] };
    },
  });
}

export function installMediaElementStub(): void {
  Object.defineProperty(HTMLMediaElement.prototype, "duration", {
    configurable: true,
    get: () => fakeDuration,
  });
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
    configurable: true,
    get: () => fakeReadyState,
  });
  fakeReadyState = 0;
  Object.defineProperty(HTMLMediaElement.prototype, "paused", {
    configurable: true,
    get: function paused(this: HTMLMediaElement & { _paused?: boolean }) {
      return this._paused ?? true;
    },
  });
  Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
    configurable: true,
    get: function current(this: HTMLMediaElement & { _currentTime?: number }) {
      return this._currentTime ?? 0;
    },
    set: function next(this: HTMLMediaElement & { _currentTime?: number }, value: number) {
      this._currentTime = value;
    },
  });
  HTMLMediaElement.prototype.play = vi.fn(function play(
    this: HTMLMediaElement & { _paused?: boolean },
  ) {
    this._paused = false;
    return Promise.resolve();
  }) as unknown as HTMLMediaElement["play"];
  HTMLMediaElement.prototype.pause = vi.fn(function pause(
    this: HTMLMediaElement & { _paused?: boolean },
  ) {
    this._paused = true;
  }) as unknown as HTMLMediaElement["pause"];
}
