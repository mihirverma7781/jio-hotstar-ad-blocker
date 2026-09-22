/**
 * VideoElementTracker
 * Monitors DOM mutations, navigation, fullscreen changes, and video element replacement
 * to maintain seamless attachment of the enhancement pipeline.
 */

export type VideoChangeCallback = (video: HTMLVideoElement | null) => void;

export class VideoElementTracker {
  private activeVideo: HTMLVideoElement | null = null;
  private observer: MutationObserver | null = null;
  private changeCallbacks: VideoChangeCallback[] = [];
  private checkInterval: any = null;

  constructor() {
    this.initObserver();
    this.scanForVideo();
  }

  public onVideoChange(callback: VideoChangeCallback): void {
    this.changeCallbacks.push(callback);
    if (this.activeVideo) {
      callback(this.activeVideo);
    }
  }

  public getActiveVideo(): HTMLVideoElement | null {
    return this.activeVideo;
  }

  private scanForVideo(): void {
    if (typeof document === 'undefined') return;

    const videos = Array.from(document.querySelectorAll('video'));
    let bestVideo: HTMLVideoElement | null = null;

    // Pick the most relevant video (playing, has dimensions, in viewport)
    for (const v of videos) {
      if (v.offsetWidth > 100 && v.offsetHeight > 100 && !v.ended) {
        bestVideo = v;
        break;
      }
    }

    if (!bestVideo && videos.length > 0) {
      bestVideo = videos[0];
    }

    if (bestVideo !== this.activeVideo) {
      this.activeVideo = bestVideo;
      this.notifyCallbacks();
    }
  }

  private initObserver(): void {
    if (typeof document === 'undefined') return;

    this.observer = new MutationObserver(() => {
      this.scanForVideo();
    });

    try {
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'style', 'class']
      });
    } catch {
      // Fallback
    }

    // Periodic safety check
    this.checkInterval = setInterval(() => {
      this.scanForVideo();
    }, 1500);

    // Listen for fullscreen and resize
    window.addEventListener('fullscreenchange', () => this.scanForVideo());
    window.addEventListener('resize', () => this.scanForVideo());
  }

  private notifyCallbacks(): void {
    for (const cb of this.changeCallbacks) {
      try {
        cb(this.activeVideo);
      } catch (err) {
        console.error('[VideoElementTracker] Callback error:', err);
      }
    }
  }

  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.changeCallbacks = [];
  }
}
