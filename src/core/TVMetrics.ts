/**
 * TVMetrics
 * Tracks real-time player telemetry, startup latency, quality distribution, and dropped frames.
 */

import {
  MediaRepresentation,
  TVPlaybackMetrics
} from '../types/tv_mode';

export class TVMetrics {
  private metrics: TVPlaybackMetrics;
  private currentQualityKey: string = 'unknown';
  private currentIsHdr: boolean = false;
  private lastUpdateTime: number = Date.now();

  constructor() {
    this.metrics = {
      sessionStartTime: Date.now(),
      firstFrameTimeMs: null,
      firstUhdFrameTimeMs: null,
      totalPlaybackDurationSec: 0,
      timeSpentAtQualitySec: {},
      timeSpentHDRSec: 0,
      timeSpentSDRSec: 0,
      droppedFramesCount: 0,
      totalDecodedFramesCount: 0,
      rebufferEventsCount: 0,
      totalRebufferDurationSec: 0,
      qualitySwitchesCount: 0,
      currentBandwidthEstimateBps: 20_000_000
    };
  }

  public recordFirstFrame(timestamp = Date.now()): void {
    if (this.metrics.firstFrameTimeMs === null) {
      this.metrics.firstFrameTimeMs = timestamp - this.metrics.sessionStartTime;
    }
  }

  public recordFirstUhdFrame(timestamp = Date.now()): void {
    if (this.metrics.firstUhdFrameTimeMs === null) {
      this.metrics.firstUhdFrameTimeMs = timestamp - this.metrics.sessionStartTime;
    }
  }

  public onQualitySwitch(rep: MediaRepresentation): void {
    this.accumulateTime();
    this.metrics.qualitySwitchesCount++;
    this.currentQualityKey = `${rep.height}p`;
    this.currentIsHdr = rep.hdr;

    if (rep.height >= 2160) {
      this.recordFirstUhdFrame();
    }
  }

  public onRebufferEvent(durationSec: number): void {
    this.metrics.rebufferEventsCount++;
    this.metrics.totalRebufferDurationSec += durationSec;
  }

  public updateFrameStats(dropped: number, total: number): void {
    this.metrics.droppedFramesCount = dropped;
    this.metrics.totalDecodedFramesCount = total;
  }

  public updateBandwidth(bps: number): void {
    this.metrics.currentBandwidthEstimateBps = bps;
  }

  public accumulateTime(now = Date.now()): void {
    const elapsedSec = Math.max(0, (now - this.lastUpdateTime) / 1000);
    this.lastUpdateTime = now;

    if (elapsedSec <= 0 || elapsedSec > 60) return; // Ignore paused or huge system sleeps

    this.metrics.totalPlaybackDurationSec += elapsedSec;

    if (this.currentQualityKey) {
      this.metrics.timeSpentAtQualitySec[this.currentQualityKey] =
        (this.metrics.timeSpentAtQualitySec[this.currentQualityKey] || 0) + elapsedSec;
    }

    if (this.currentIsHdr) {
      this.metrics.timeSpentHDRSec += elapsedSec;
    } else {
      this.metrics.timeSpentSDRSec += elapsedSec;
    }
  }

  public getSummary(): {
    startupSec: number;
    firstFrameSec: number | null;
    firstUhdSec: number | null;
    rebuffers: number;
    qualitySwitches: number;
    uhdPercentage: number;
    hdrPercentage: number;
    droppedFrames: number;
    droppedPercentage: number;
    totalDurationSec: number;
  } {
    this.accumulateTime();

    const total = this.metrics.totalPlaybackDurationSec || 1;
    const uhdSec = this.metrics.timeSpentAtQualitySec['2160p'] || 0;
    const uhdPercentage = Math.round((uhdSec / total) * 100);
    const hdrPercentage = Math.round((this.metrics.timeSpentHDRSec / total) * 100);

    const decoded = this.metrics.totalDecodedFramesCount || 1;
    const droppedPercentage = Math.round((this.metrics.droppedFramesCount / decoded) * 100);

    return {
      startupSec: Math.round(((this.metrics.firstFrameTimeMs || 0) / 1000) * 100) / 100,
      firstFrameSec: this.metrics.firstFrameTimeMs ? Math.round((this.metrics.firstFrameTimeMs / 1000) * 100) / 100 : null,
      firstUhdSec: this.metrics.firstUhdFrameTimeMs ? Math.round((this.metrics.firstUhdFrameTimeMs / 1000) * 100) / 100 : null,
      rebuffers: this.metrics.rebufferEventsCount,
      qualitySwitches: this.metrics.qualitySwitchesCount,
      uhdPercentage,
      hdrPercentage,
      droppedFrames: this.metrics.droppedFramesCount,
      droppedPercentage,
      totalDurationSec: Math.round(this.metrics.totalPlaybackDurationSec)
    };
  }

  public getRawMetrics(): TVPlaybackMetrics {
    this.accumulateTime();
    return { ...this.metrics };
  }
}
