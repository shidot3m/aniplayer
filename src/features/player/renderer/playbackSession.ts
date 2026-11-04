import type * as Hls from "hls.js";

/**
 * What the media element reports back to the store. The element is the player now, so these
 * three callbacks replace the whole event channel a child process used to push.
 */
export interface PlaybackObserver {
  onTime(position: number, duration: number): void;
  onEnded(): void;
  onFault(message: string): void;
}

/** The playback settings the store holds and the element obeys. */
export interface PlaybackSettings {
  volume: number;
  muted: boolean;
  speed: number;
}

/** Why playback stopped, written for the person watching the frame instead of for a log. */
const FAULT_NETWORK = "Не удалось загрузить поток: сеть не отвечает";
const FAULT_DECODE = "Этот поток не декодируется на машине";
const FAULT_PLAYBACK = "Не удалось начать воспроизведение";
const FAULT_UNSUPPORTED = "Видео в этом окне воспроизведения недоступно";
const FAULT_LOADER = "Не удалось загрузить проигрыватель";

interface Session {
  url: string;
  /** Where to land once the media can be measured: a resume point or a restored position. */
  startAt: number;
  autoplay: boolean;
}

const clampFraction = (percent: number): number => Math.max(0, Math.min(1, percent / 100));

/**
 * The single playback session of the app: one `<video>` element fed by one hls.js instance
 * through Media Source Extensions.
 *
 * The store drives it imperatively and an attached view hands it an element, in either order:
 * `open()` before `attach()` keeps the request pending, `attach()` before `open()` binds what
 * is already playing. That ordering is what lets React remount the overlay — in development it
 * always does — without tearing the picture down: the session belongs to the store, as it did
 * when a child process owned it.
 */
class PlaybackSession {
  private video: HTMLVideoElement | null = null;
  private library: typeof Hls.default | null = null;
  private hls: Hls.default | null = null;
  private session: Session | null = null;
  private settings: PlaybackSettings = { volume: 80, muted: false, speed: 1 };
  private observer: PlaybackObserver | null = null;
  private lastPosition = 0;
  private mediaRecovered = false;
  private bindToken = 0;

  setObserver(observer: PlaybackObserver | null): void {
    this.observer = observer;
  }

  attach(video: HTMLVideoElement): void {
    if (this.video === video) return;
    this.unbindElement();
    this.video = video;
    video.addEventListener("timeupdate", this.handleTime);
    video.addEventListener("ended", this.handleEnded);
    video.addEventListener("error", this.handleMediaElementError);
    if (this.session) this.bind();
  }

  detach(video: HTMLVideoElement): void {
    if (this.video === video) this.unbindElement();
  }

  open(url: string, startAt: number, settings: PlaybackSettings): void {
    this.settings = settings;
    this.session = { url, startAt, autoplay: true };
    this.lastPosition = startAt;
    this.mediaRecovered = false;
    if (this.video) this.bind();
  }

  /**
   * Points the live session at a different playlist. Every AniLiberty Quality tier is its own
   * media playlist, so a Quality change is a source reload under a mounted element rather than
   * an HLS level switch and rather than a new session: the position and the paused state carry
   * over, which is what the #50 report asked for.
   */
  switchUrl(url: string): void {
    if (!this.session || this.session.url === url) return;
    this.session = {
      url,
      startAt: this.lastPosition,
      autoplay: this.video ? !this.video.paused : this.session.autoplay,
    };
    this.mediaRecovered = false;
    if (this.video) this.bind();
  }

  close(): void {
    this.session = null;
    this.mediaRecovered = false;
    this.bindToken += 1;
    this.hls?.destroy();
    this.hls = null;
  }

  setPaused(paused: boolean): void {
    if (!this.video) return;
    if (this.session) this.session.autoplay = !paused;
    if (paused) this.video.pause();
    else void this.play();
  }

  seek(seconds: number): void {
    if (!this.video) return;
    this.video.currentTime = seconds;
    this.lastPosition = seconds;
  }

  setVolume(volume: number, muted: boolean): void {
    this.settings = { ...this.settings, volume, muted };
    if (!this.video) return;
    this.video.volume = clampFraction(volume);
    this.video.muted = muted || volume === 0;
  }

  setSpeed(speed: number): void {
    this.settings = { ...this.settings, speed };
    if (this.video) this.video.playbackRate = speed;
  }

  private unbindElement(): void {
    if (!this.video) return;
    this.video.removeEventListener("timeupdate", this.handleTime);
    this.video.removeEventListener("ended", this.handleEnded);
    this.video.removeEventListener("error", this.handleMediaElementError);
    this.hls?.detachMedia();
    this.video = null;
  }

  /** (Re)binds the pending session to the element: load the library, then create or reuse. */
  private bind(): void {
    const token = ++this.bindToken;
    void this.bindWhenLoaded(token);
  }

  /**
   * hls.js is ~0.6 MB and only playback needs it, so the store's static graph must not carry
   * it (ADR 0002): the module arrives with the first frame the user asks for. A switch or a
   * remount during that fetch invalidates this bind, and the newer one takes over.
   */
  private async bindWhenLoaded(token: number): Promise<void> {
    const library = this.library ?? (await this.loadLibrary());
    if (!library || token !== this.bindToken) return;

    const video = this.video;
    const session = this.session;
    if (!video || !session) return;

    if (!library.isSupported()) {
      this.observer?.onFault(FAULT_UNSUPPORTED);
      return;
    }

    if (!this.hls) {
      this.hls = new library();
      this.hls.on(library.Events.MANIFEST_PARSED, this.handleManifestParsed);
      this.hls.on(library.Events.ERROR, this.handleError);
    } else {
      this.hls.detachMedia();
    }
    this.hls.attachMedia(video);
    this.hls.loadSource(session.url);

    video.volume = clampFraction(this.settings.volume);
    video.muted = this.settings.muted || this.settings.volume === 0;
    video.playbackRate = this.settings.speed;
    video.addEventListener("loadedmetadata", this.handleMediaReady, { once: true });
  }

  private async loadLibrary(): Promise<typeof Hls.default | null> {
    try {
      const module = await import("hls.js");
      this.library = module.default;
      return this.library;
    } catch {
      this.observer?.onFault(FAULT_LOADER);
      return null;
    }
  }

  /**
   * A freshly attached media element carries no position of its own, so the session's start
   * point is applied as soon as the duration is measurable. hls.js appends from there.
   */
  private handleManifestParsed = (): void => {
    if (this.video && this.session && this.video.currentTime !== this.session.startAt) {
      this.applyStart(this.session.startAt);
    }
  };

  private handleMediaReady = (): void => {
    const session = this.session;
    if (!session || !this.video) return;
    this.applyStart(session.startAt);
    if (session.autoplay) void this.play();
  };

  private applyStart(seconds: number): void {
    if (!this.video || seconds <= 0) return;
    this.video.currentTime = seconds;
    this.lastPosition = seconds;
  }

  private async play(): Promise<void> {
    if (!this.video) return;
    try {
      await this.video.play();
    } catch {
      this.observer?.onFault(FAULT_PLAYBACK);
    }
  }

  private handleTime = (): void => {
    const video = this.video;
    if (!video) return;
    this.lastPosition = video.currentTime;
    this.observer?.onTime(video.currentTime, Number.isFinite(video.duration) ? video.duration : 0);
  };

  private handleEnded = (): void => {
    this.observer?.onEnded();
  };

  private handleMediaElementError = (): void => {
    this.observer?.onFault(FAULT_DECODE);
  };

  private handleError = (_event: string, data: Hls.ErrorData): void => {
    const library = this.library;
    if (!data.fatal || !this.hls || !library) return;
    if (data.type === library.ErrorTypes.MEDIA_ERROR && !this.mediaRecovered) {
      this.mediaRecovered = true;
      this.hls.recoverMediaError();
      return;
    }
    this.observer?.onFault(
      data.type === library.ErrorTypes.NETWORK_ERROR ? FAULT_NETWORK : FAULT_DECODE,
    );
  };
}

/** The one session the app has: the player feature owns it, the shell never reaches it. */
export const playback = new PlaybackSession();
