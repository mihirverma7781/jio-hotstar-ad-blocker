/**
 * PrimeRepresentationProbe
 * Collects, verifies, and categorizes live representations delivered to the Prime Video session.
 * Explicitly determines whether 4K UHD and 4K HDR representations exist.
 */

import {
  PrimeObservedTrack,
  PrimeProbeEventPayload,
  UHDRepresentationStatus
} from '../types/drm_research';

export class PrimeRepresentationProbe {
  private observedTracks: Map<string, PrimeObservedTrack> = new Map();
  private lastManifestUrl: string | null = null;
  private lastManifestType: string | null = null;
  private playerEngine: string = 'Amazon ATVWebPlayerSDK';
  private hasTrackApi: boolean = false;
  private currentVideoWidth: number = 0;
  private currentVideoHeight: number = 0;

  constructor() {
    this.initMessageListener();
  }

  private initMessageListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('message', (event) => {
      if (event.data?.source === 'PV_PAGE_BRIDGE' && event.data?.payload) {
        this.processBridgePayload(event.data.payload as PrimeProbeEventPayload);
      }
    });
  }

  public processBridgePayload(payload: PrimeProbeEventPayload): void {
    if (payload.manifestUrl) {
      this.lastManifestUrl = payload.manifestUrl;
    }
    if (payload.manifestType) {
      this.lastManifestType = payload.manifestType;
    }
    if (payload.playerEngine) {
      this.playerEngine = payload.playerEngine;
    }
    if (payload.hasTrackSelectionApi !== undefined) {
      this.hasTrackApi = payload.hasTrackSelectionApi;
    }
    if (payload.videoWidth !== undefined) {
      this.currentVideoWidth = payload.videoWidth;
    }
    if (payload.videoHeight !== undefined) {
      this.currentVideoHeight = payload.videoHeight;
    }

    if (payload.observedRepresentations && Array.isArray(payload.observedRepresentations)) {
      for (const track of payload.observedRepresentations) {
        this.observedTracks.set(track.id, track);
      }
    }
  }

  /**
   * Directly registers an observed track (useful for unit tests and direct DOM observations)
   */
  public registerTrack(track: PrimeObservedTrack): void {
    this.observedTracks.set(track.id, track);
  }

  public getUhdRepresentationStatus(): UHDRepresentationStatus {
    const has4k = Array.from(this.observedTracks.values()).some(
      (t) => t.width >= 3840 || t.height >= 2160
    );
    return has4k ? 'FOUND' : 'NOT_FOUND';
  }

  public getHdrUhdRepresentationStatus(): UHDRepresentationStatus {
    const has4kHdr = Array.from(this.observedTracks.values()).some(
      (t) => (t.width >= 3840 || t.height >= 2160) && t.hdr === true
    );
    return has4kHdr ? 'FOUND' : 'NOT_FOUND';
  }

  public getAllObservedRepresentations(): PrimeObservedTrack[] {
    return Array.from(this.observedTracks.values()).sort((a, b) => b.height - a.height);
  }

  public getMaxObservedRepresentation(): PrimeObservedTrack | null {
    const tracks = this.getAllObservedRepresentations();
    return tracks.length > 0 ? tracks[0] : null;
  }

  public getObservedLadderSummary(): string[] {
    const heights = Array.from(
      new Set(this.getAllObservedRepresentations().map((t) => `${t.height}p${t.hdr ? ' HDR' : ''}`))
    );
    return heights.length > 0 ? heights : ['1080p'];
  }

  public getPlayerEngine(): string {
    return this.playerEngine;
  }

  public hasTrackSelectionApi(): boolean {
    return this.hasTrackApi;
  }

  public getCurrentDimensions(): { width: number; height: number } {
    return {
      width: this.currentVideoWidth,
      height: this.currentVideoHeight
    };
  }

  public getLastManifestUrl(): string | null {
    return this.lastManifestUrl;
  }
}
