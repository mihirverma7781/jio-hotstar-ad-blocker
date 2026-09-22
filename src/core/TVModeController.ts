/**
 * TVModeController
 * Central orchestrator managing the 10-step TV playback lifecycle:
 * 1. Detect display
 * 2. Detect browser decoder capabilities
 * 3. Detect HDR capability
 * 4. Inspect available representations
 * 5. Construct capability matrix
 * 6. Rank representations
 * 7. Select highest playable representation
 * 8. Monitor playback and buffer health
 * 9. Dynamically adapt via TV ABR
 * 10. Gracefully fallback on playback failure
 */

import {
  MediaRepresentation,
  QualitySelectionResult,
  TVModeProfile
} from '../types/tv_mode';
import { TVCapabilityEngine } from './TVCapabilityEngine';
import { TVHdrEngine } from './TVHdrEngine';
import { TVQualitySelector } from './TVQualitySelector';
import { TVAdaptationController } from './TVAdaptationController';
import { TVDiagnostics, TVHudData } from './TVDiagnostics';
import { TVMetrics } from './TVMetrics';

export class TVModeController {
  private profile: TVModeProfile;
  private videoElement: HTMLVideoElement | null = null;
  private availableRepresentations: MediaRepresentation[] = [];
  private activeRepresentation: MediaRepresentation | null = null;
  private adaptationController: TVAdaptationController;
  private metrics: TVMetrics;
  private monitorIntervalId: any = null;
  private isEnabled: boolean = true;
  private isFullscreenPreferred: boolean = false;
  private onQualitySwitchCallback?: (rep: MediaRepresentation) => void;

  constructor(customProfile?: Partial<TVModeProfile>) {
    this.profile = {
      preferredResolution: 2160,
      preferredDynamicRange: 'HDR',
      preferredCodecs: ['HEVC', 'AV1', 'VP9', 'H264'],
      preferHDR: true,
      prefer4K: true,
      targetFramerate: 60,
      initialBitrateStrategy: 'conservative',
      adaptationStrategy: 'tv-balanced',
      ...customProfile
    };

    this.adaptationController = new TVAdaptationController();
    this.metrics = new TVMetrics();
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.stopMonitoring();
      TVDiagnostics.toggleHUD(false);
    } else if (this.videoElement) {
      this.startMonitoring();
    }
  }

  public getProfile(): TVModeProfile {
    return { ...this.profile };
  }

  public updateProfile(newProfile: Partial<TVModeProfile>): void {
    this.profile = { ...this.profile, ...newProfile };
    if (this.availableRepresentations.length > 0) {
      this.reselectQuality();
    }
  }

  public onQualitySwitch(cb: (rep: MediaRepresentation) => void): void {
    this.onQualitySwitchCallback = cb;
  }

  /**
   * Attaches controller to a live HTMLVideoElement
   */
  public attachVideo(video: HTMLVideoElement): void {
    this.videoElement = video;
    this.attachVideoEvents(video);

    if (this.isEnabled) {
      this.startMonitoring();
    }
  }

  /**
   * Sets available media representations discovered from DASH / HLS manifests or local lab
   */
  public async setRepresentations(representations: MediaRepresentation[]): Promise<QualitySelectionResult> {
    this.availableRepresentations = representations;
    return this.reselectQuality();
  }

  /**
   * Executes the full 10-step TV lifecycle selection
   */
  public async reselectQuality(): Promise<QualitySelectionResult> {
    // 1. Detect display
    const display = TVCapabilityEngine.getDisplayCapability();

    // 2 & 3. Detect decoder & HDR capability
    const decoderReport = await TVCapabilityEngine.probeDecoderCapabilities();
    const hdrReport = TVHdrEngine.evaluateHdr(this.availableRepresentations, this.activeRepresentation, display);

    // 4, 5, 6, 7. Rank & Select highest playable representation
    const result = await TVQualitySelector.selectBestRepresentation(
      this.availableRepresentations,
      this.profile,
      display
    );

    if (result.selected) {
      this.applyRepresentation(result.selected, result.reason);
    }

    return result;
  }

  private applyRepresentation(rep: MediaRepresentation, reason: string): void {
    const isInitial = this.activeRepresentation === null;
    this.activeRepresentation = rep;
    this.metrics.onQualitySwitch(rep);

    if (this.onQualitySwitchCallback) {
      this.onQualitySwitchCallback(rep);
    }

    this.updateDiagnostics(reason);
  }

  /**
   * Monitors real-time playback, buffer duration, and triggers dynamic ABR
   */
  private startMonitoring(): void {
    this.stopMonitoring();

    this.monitorIntervalId = setInterval(() => {
      if (!this.isEnabled || !this.videoElement) return;

      const video = this.videoElement;
      const bufferSec = this.calculateBufferAhead(video);

      // Dropped frames update
      if (typeof (video as any).getVideoPlaybackQuality === 'function') {
        const q = (video as any).getVideoPlaybackQuality();
        this.metrics.updateFrameStats(q.droppedVideoFrames, q.totalVideoFrames);
      }

      // Dynamic ABR Step (steps 8 & 9)
      if (this.availableRepresentations.length > 1) {
        try {
          const evalResult = this.adaptationController.evaluate(
            bufferSec,
            this.availableRepresentations
          );

          if (
            evalResult.nextRepresentation &&
            evalResult.nextRepresentation.id !== this.activeRepresentation?.id
          ) {
            this.applyRepresentation(evalResult.nextRepresentation, evalResult.reason);
          }
        } catch {}
      }

      // Step 10: Fallback on playback errors
      if (video.error) {
        this.handlePlaybackError(video.error);
      }

      this.updateDiagnostics();
    }, 1000);
  }

  private stopMonitoring(): void {
    if (this.monitorIntervalId) {
      clearInterval(this.monitorIntervalId);
      this.monitorIntervalId = null;
    }
  }

  private calculateBufferAhead(video: HTMLVideoElement): number {
    try {
      const curTime = video.currentTime;
      const ranges = video.buffered;
      for (let i = 0; i < ranges.length; i++) {
        if (ranges.start(i) <= curTime && curTime <= ranges.end(i)) {
          return Math.max(0, ranges.end(i) - curTime);
        }
      }
    } catch {}
    return 0;
  }

  private handlePlaybackError(error: MediaError): void {
    // Cautiously drop to lower resolution tier
    if (!this.activeRepresentation || this.availableRepresentations.length <= 1) return;

    const sorted = [...this.availableRepresentations].sort((a, b) => b.bitrate - a.bitrate);
    const curIdx = sorted.findIndex(r => r.id === this.activeRepresentation?.id);

    if (curIdx >= 0 && curIdx < sorted.length - 1) {
      const fallbackRep = sorted[curIdx + 1];
      this.applyRepresentation(
        fallbackRep,
        `Hardware decode/network error (${error.code}). Falling back to ${fallbackRep.height}p.`
      );
    }
  }

  private attachVideoEvents(video: HTMLVideoElement): void {
    video.addEventListener('playing', () => {
      this.metrics.recordFirstFrame();
    }, { once: true });

    video.addEventListener('waiting', () => {
      this.metrics.onRebufferEvent(1);
      this.adaptationController.notifyRebuffer();
    });
  }

  private updateDiagnostics(customReason?: string): void {
    if (!this.activeRepresentation && this.availableRepresentations.length === 0) return;

    const rep = this.activeRepresentation || this.availableRepresentations[0];
    const display = TVCapabilityEngine.getDisplayCapability();
    const abrState = this.adaptationController.getState();
    const metrics = this.metrics.getSummary();

    const hudData: TVHudData = {
      resolution: rep ? `${rep.width} × ${rep.height}` : 'Auto',
      quality: rep ? `${rep.height}p ${rep.dynamicRange}` : '1080p SDR',
      codec: rep ? rep.codec : 'Unknown',
      bitrateMbps: rep ? rep.bitrate / 1_000_000 : 0,
      framerate: rep ? rep.framerate : 60,
      dynamicRange: rep ? rep.dynamicRange : 'SDR',
      bufferSec: abrState.currentBufferSeconds,
      bandwidthMbps: abrState.bandwidthEstimateBps / 1_000_000,
      droppedFrames: metrics.droppedFrames,
      displayHDR: display.displayHDR,
      canDecode2160p: display.effectiveWidth >= 3840 || display.effectiveHeight >= 2160,
      currentRepresentationId: rep ? rep.id : 'N/A',
      reasonForSelection: customReason || (abrState.reasons[0] || 'TV Mode: Optimal playable tier')
    };

    TVDiagnostics.renderHUD(hudData);
  }

  public getMetrics(): TVMetrics {
    return this.metrics;
  }

  public getActiveRepresentation(): MediaRepresentation | null {
    return this.activeRepresentation;
  }
}
