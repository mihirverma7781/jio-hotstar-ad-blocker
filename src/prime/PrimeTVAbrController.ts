/**
 * PrimeTVAbrController
 * Implements real TV-style adaptive bitrate logic:
 * - Startup: conservative (start at lowest available)
 * - Buffer-aware upgrade: only upgrade when buffered > 10s ahead
 * - Fast downgrade: immediately downgrade on buffer < 3s
 * - Gradual recovery: after downgrade, wait 8s before upgrading
 * - Always prefer UHD when available and buffer stable
 *
 * Publishes selection events via window.postMessage to prime_bridge.
 * DOES NOT alter DRM or licensing.
 */

import { PrimeObservedTrack } from '../types/drm_research';

export type AbrTier = 'startup' | 'stable' | 'recovering' | 'degraded';

export interface AbrDecision {
  timestamp: number;
  action: 'UPGRADE' | 'DOWNGRADE' | 'HOLD';
  fromHeight: number;
  toHeight: number;
  reason: string;
  bufferedAhead: number;
}

const DECISION_LOG_MAX = 20;
const TICK_INTERVAL_MS = 500;
const UPGRADE_BUFFER_THRESHOLD = 10;    // seconds ahead before upgrading
const DOWNGRADE_BUFFER_THRESHOLD = 3;   // seconds — emergency drop
const RECOVERY_COOLDOWN_MS = 8000;      // wait 8s after downgrade before re-upgrading
const UHD_BITRATE_THRESHOLD_BPS = 15_000_000; // 15 Mbps — UHD minimum

export class PrimeTVAbrController {
  private video: HTMLVideoElement;
  private tracks: PrimeObservedTrack[] = [];
  private sortedTracks: PrimeObservedTrack[] = [];  // ascending height

  private tier: AbrTier = 'startup';
  private selectedRepresentationId: string | null = null;
  private currentTrackIndex: number = 0;       // index into sortedTracks
  private downgradeTime: number = 0;

  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private decisionLog: AbrDecision[] = [];

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  /** Begins the 500 ms monitoring loop. */
  public start(): void {
    if (this.tickHandle !== null) return;
    this.tier = 'startup';
    this.tickHandle = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  /** Stops the monitoring loop. */
  public stop(): void {
    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  /** Returns the current ABR state tier. */
  public getCurrentTier(): AbrTier {
    return this.tier;
  }

  /** Returns the id of the currently selected representation, or null if none. */
  public getSelectedRepresentationId(): string | null {
    return this.selectedRepresentationId;
  }

  /**
   * Called whenever new representations are observed from the manifest.
   * Keeps sortedTracks updated (ascending by height for ladder indexing).
   */
  public onRepresentationsUpdate(tracks: PrimeObservedTrack[]): void {
    this.tracks = tracks;
    // Sort ascending so index 0 = lowest, last = highest
    this.sortedTracks = [...tracks].sort((a, b) => a.height - b.height);

    if (this.tier === 'startup' && this.sortedTracks.length > 0) {
      // Conservative startup: begin at the lowest available track
      this.currentTrackIndex = 0;
      const startTrack = this.sortedTracks[0];
      this.selectTrack(startTrack, 'HOLD', startTrack.height, 'Startup — seeding at lowest track', 0);
    }
  }

  /** Returns the last (up to) 20 ABR decisions. */
  public getDecisionLog(): AbrDecision[] {
    return [...this.decisionLog];
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  /**
   * Core ABR tick — runs every 500 ms.
   * Computes bufferedAhead and decides whether to upgrade, downgrade, or hold.
   */
  private tick(): void {
    if (this.sortedTracks.length === 0) return;

    const bufferedAhead = this.computeBufferedAhead();
    const currentTrack = this.sortedTracks[this.currentTrackIndex];

    // ── Emergency downgrade ─────────────────────────────────────────────────
    if (bufferedAhead < DOWNGRADE_BUFFER_THRESHOLD) {
      const lowerIndex = this.currentTrackIndex - 1;
      if (lowerIndex >= 0) {
        const lowerTrack = this.sortedTracks[lowerIndex];
        this.recordDecision(
          'DOWNGRADE',
          currentTrack.height,
          lowerTrack.height,
          `Buffer critical (${bufferedAhead.toFixed(1)}s < ${DOWNGRADE_BUFFER_THRESHOLD}s) — emergency drop`,
          bufferedAhead
        );
        this.currentTrackIndex = lowerIndex;
        this.tier = 'degraded';
        this.downgradeTime = Date.now();
        this.selectTrack(lowerTrack, 'DOWNGRADE', currentTrack.height, `Buffer ${bufferedAhead.toFixed(1)}s`, bufferedAhead);
      } else {
        // Already at lowest, just hold
        this.recordDecision('HOLD', currentTrack.height, currentTrack.height,
          `At minimum quality, buffer still low (${bufferedAhead.toFixed(1)}s)`, bufferedAhead);
        this.tier = 'degraded';
        this.downgradeTime = Date.now();
      }
      return;
    }

    // ── Recover from degraded state ─────────────────────────────────────────
    if (this.tier === 'degraded') {
      if (Date.now() - this.downgradeTime >= RECOVERY_COOLDOWN_MS) {
        this.tier = 'recovering';
        this.recordDecision('HOLD', currentTrack.height, currentTrack.height,
          `Recovery cooldown elapsed — entering recovering state`, bufferedAhead);
      } else {
        this.recordDecision('HOLD', currentTrack.height, currentTrack.height,
          `Degraded cooldown (${((Date.now() - this.downgradeTime) / 1000).toFixed(1)}s / 8s)`, bufferedAhead);
      }
      return;
    }

    // ── Upgrade attempt ─────────────────────────────────────────────────────
    if (bufferedAhead > UPGRADE_BUFFER_THRESHOLD) {
      const higherIndex = this.currentTrackIndex + 1;
      if (higherIndex < this.sortedTracks.length) {
        const higherTrack = this.sortedTracks[higherIndex];
        this.currentTrackIndex = higherIndex;

        // If the upgraded track is UHD, mark stable; otherwise recovering
        this.tier = higherTrack.height >= 2160 ? 'stable' : (this.tier === 'recovering' ? 'stable' : 'stable');
        this.recordDecision('UPGRADE', currentTrack.height, higherTrack.height,
          `Buffer healthy (${bufferedAhead.toFixed(1)}s > ${UPGRADE_BUFFER_THRESHOLD}s) — stepping up`,
          bufferedAhead);
        this.selectTrack(higherTrack, 'UPGRADE', currentTrack.height, `Buffer ${bufferedAhead.toFixed(1)}s`, bufferedAhead);
        return;
      } else {
        // Already at highest — stable
        this.tier = 'stable';
      }
    }

    // ── Hold current ────────────────────────────────────────────────────────
    const reason = this.tier === 'recovering'
      ? `Recovering — buffer ${bufferedAhead.toFixed(1)}s not yet > ${UPGRADE_BUFFER_THRESHOLD}s`
      : `Steady — buffer ${bufferedAhead.toFixed(1)}s`;
    this.recordDecision('HOLD', currentTrack.height, currentTrack.height, reason, bufferedAhead);
    if (this.tier === 'startup' && this.selectedRepresentationId !== null) {
      this.tier = 'stable';
    }
  }

  /**
   * Emits a track selection request via window.postMessage to prime_bridge
   * and updates internal tracking state.
   */
  private selectTrack(
    track: PrimeObservedTrack,
    action: AbrDecision['action'],
    fromHeight: number,
    reason: string,
    bufferedAhead: number
  ): void {
    this.selectedRepresentationId = track.id;

    if (typeof window !== 'undefined') {
      window.postMessage(
        {
          target: 'PV_PAGE_BRIDGE',
          command: 'SELECT_TRACK',
          trackId: track.id,
          source: 'PrimeTVAbrController',
          reason
        },
        '*'
      );
    }
  }

  /** Adds a decision to the circular log (capped at DECISION_LOG_MAX). */
  private recordDecision(
    action: AbrDecision['action'],
    fromHeight: number,
    toHeight: number,
    reason: string,
    bufferedAhead: number
  ): void {
    const decision: AbrDecision = {
      timestamp: Date.now(),
      action,
      fromHeight,
      toHeight,
      reason,
      bufferedAhead
    };
    this.decisionLog.push(decision);
    if (this.decisionLog.length > DECISION_LOG_MAX) {
      this.decisionLog.shift();
    }
  }

  /**
   * Computes how many seconds of video are buffered ahead of the current playhead.
   * Returns 0 if unavailable.
   */
  private computeBufferedAhead(): number {
    try {
      const buffered = this.video.buffered;
      const currentTime = this.video.currentTime;
      if (buffered.length === 0) return 0;
      // Use the last buffered range that covers currentTime
      for (let i = buffered.length - 1; i >= 0; i--) {
        if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) {
          return buffered.end(i) - currentTime;
        }
      }
      return 0;
    } catch {
      return 0;
    }
  }
}
