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
    LEVEL_SWITCHED: "hlsLevelSwitched",
    ERROR: "hlsError",
  };
  static readonly ErrorTypes = {
    NETWORK_ERROR: "networkError",
    MEDIA_ERROR: "mediaError",
    OTHER_ERROR: "otherError",
  };
  static isSupported = vi.fn(() => true);

  readonly handlers = new Map<string, Set<Handler>>();
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

  constructor() {
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

export function setMediaDuration(seconds: number): void {
  fakeDuration = seconds;
}

export function installMediaElementStub(): void {
  Object.defineProperty(HTMLMediaElement.prototype, "duration", {
    configurable: true,
    get: () => fakeDuration,
  });
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
