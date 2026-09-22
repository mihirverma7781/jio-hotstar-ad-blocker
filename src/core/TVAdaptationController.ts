/**
 * TVAdaptationController
 * Implements modern TV-style Adaptive Bitrate (ABR) algorithm:
 * - Conservative startup
 * - Sustained stability (avoids rapid ping-pong quality oscillations)
 * - Buffer-aware safety margins
 * - Rapid emergency downgrade on buffer starvation
 * - Gradual, cautious quality promotion with hold times
 */

import {
  ABRParameters,
  MediaRepresentation,
  TVABRState
} from '../types/tv_mode';

export class TVAdaptationController {
  private params: ABRParameters;
  private state: TVABRState;
  private lastSwitchTimestamp: number = 0;
  private consecutiveDegradationCount = 0;
  private consecutiveRecoveryCount = 0;

  constructor(customParams?: Partial<ABRParameters>) {
    this.params = {
      startupBufferTarget: 8,
      rebufferThreshold: 3,
      upgradeThreshold: 12,
      downgradeThreshold: 4,
      qualityHoldTime: 8000,
      bandwidthSafetyFactor: 0.75,
      ...customParams
    };

    this.state = {
      currentRepresentation: null,
      currentBufferSeconds: 0,
      bandwidthEstimateBps: 20_000_000, // Initial default: 20 Mbps
      state: 'startup',
      timeSinceLastSwitchMs: 0,
      rebufferCount: 0,
      qualitySwitchesCount: 0,
      reasons: []
    };
  }

  public getState(): TVABRState {
    this.state.timeSinceLastSwitchMs = Date.now() - this.lastSwitchTimestamp;
    return { ...this.state };
  }

  public getParameters(): ABRParameters {
    return { ...this.params };
  }

  public updateParameters(params: Partial<ABRParameters>): void {
    this.params = { ...this.params, ...params };
  }

  public setBandwidthEstimate(bps: number): void {
    // Exponential smoothing for bandwidth estimate
    if (this.state.bandwidthEstimateBps === 0) {
      this.state.bandwidthEstimateBps = bps;
    } else {
      this.state.bandwidthEstimateBps = Math.round(
        this.state.bandwidthEstimateBps * 0.7 + bps * 0.3
      );
    }
  }

  public notifyRebuffer(): void {
    this.state.rebufferCount++;
    this.state.state = 'degrading';
    this.consecutiveDegradationCount += 2;
  }

  /**
   * Evaluates current buffer and bandwidth to decide which representation to play next.
   */
  public evaluate(
    currentBufferSeconds: number,
    availableReps: MediaRepresentation[],
    now = Date.now()
  ): {
    nextRepresentation: MediaRepresentation;
    action: 'hold' | 'upgrade' | 'downgrade' | 'emergency-drop';
    reason: string;
  } {
    this.state.currentBufferSeconds = currentBufferSeconds;
    const timeSinceSwitch = this.lastSwitchTimestamp ? now - this.lastSwitchTimestamp : Infinity;

    if (!availableReps || availableReps.length === 0) {
      throw new Error('No media representations provided for adaptation evaluation.');
    }

    // Sort ascending by bitrate for standard ABR ladder traversal
    const ladder = [...availableReps].sort((a, b) => a.bitrate - b.bitrate);

    // Initial startup selection
    if (!this.state.currentRepresentation) {
      const initial = this.selectStartupRepresentation(ladder);
      this.state.currentRepresentation = initial;
      this.lastSwitchTimestamp = now;
      this.state.state = 'startup';
      return {
        nextRepresentation: initial,
        action: 'hold',
        reason: `Initial startup selection based on safe initial bandwidth (${Math.round(this.state.bandwidthEstimateBps / 1_000_000)} Mbps).`
      };
    }

    const currentIdx = ladder.findIndex(r => r.id === this.state.currentRepresentation?.id);
    const currentIndex = currentIdx === -1 ? 0 : currentIdx;
    const safeBandwidth = this.state.bandwidthEstimateBps * this.params.bandwidthSafetyFactor;

    // 1. EMERGENCY DOWNGRADE: Buffer below rebufferThreshold (e.g. <3 seconds)
    if (currentBufferSeconds < this.params.rebufferThreshold) {
      this.consecutiveDegradationCount++;
      this.consecutiveRecoveryCount = 0;
      this.state.state = 'degrading';

      // Drop by at least 1 or 2 rungs or lowest safe rung immediately
      const dropIndex = Math.max(0, currentIndex - 2);
      const targetRep = ladder[dropIndex];

      if (targetRep.id !== this.state.currentRepresentation.id) {
        this.applySwitch(targetRep, now);
        return {
          nextRepresentation: targetRep,
          action: 'emergency-drop',
          reason: `CRITICAL: Buffer starved (${currentBufferSeconds.toFixed(1)}s < ${this.params.rebufferThreshold}s). Emergency drop to preserve smooth playback.`
        };
      }
    }

    // 2. STANDARD DOWNGRADE: Buffer deteriorating (<downgradeThreshold) or sustained bandwidth deficit
    const currentBitrate = this.state.currentRepresentation.bitrate;
    const isBandwidthDeficit = currentBitrate > safeBandwidth;
    const isBufferDeteriorating = currentBufferSeconds < this.params.downgradeThreshold;

    if (isBufferDeteriorating || isBandwidthDeficit) {
      this.consecutiveDegradationCount++;
      this.consecutiveRecoveryCount = 0;

      if (currentIndex > 0) {
        // Step down to next lower rung
        const targetRep = ladder[currentIndex - 1];
        this.applySwitch(targetRep, now);
        this.state.state = 'degrading';
        return {
          nextRepresentation: targetRep,
          action: 'downgrade',
          reason: `Buffer softening (${currentBufferSeconds.toFixed(1)}s) or throughput deficit (${Math.round(safeBandwidth / 1000)}k < ${Math.round(currentBitrate / 1000)}k). Downgrading to maintain buffer.`
        };
      }
    }

    // 3. CAUTIOUS UPGRADE: Sufficient buffer (>upgradeThreshold) & steady bandwidth
    const canAttemptUpgrade =
      currentBufferSeconds >= this.params.upgradeThreshold &&
      timeSinceSwitch >= this.params.qualityHoldTime &&
      currentIndex < ladder.length - 1;

    if (canAttemptUpgrade) {
      const candidateRep = ladder[currentIndex + 1];

      // Check if candidate bitrate comfortably fits inside safe bandwidth
      if (candidateRep.bitrate <= safeBandwidth) {
        this.consecutiveRecoveryCount++;
        this.consecutiveDegradationCount = 0;

        // Upgrade rung
        this.applySwitch(candidateRep, now);
        this.state.state = 'recovering';
        return {
          nextRepresentation: candidateRep,
          action: 'upgrade',
          reason: `Healthy buffer (${currentBufferSeconds.toFixed(1)}s > ${this.params.upgradeThreshold}s) and sustained headroom. Upgrading to ${candidateRep.height}p.`
        };
      }
    }

    // 4. HOLD: Steady state
    this.state.state = 'steady';
    return {
      nextRepresentation: this.state.currentRepresentation,
      action: 'hold',
      reason: `Stable buffer (${currentBufferSeconds.toFixed(1)}s) and bandwidth matching current quality (${this.state.currentRepresentation.height}p).`
    };
  }

  private selectStartupRepresentation(ladder: MediaRepresentation[]): MediaRepresentation {
    const safeBw = this.state.bandwidthEstimateBps * this.params.bandwidthSafetyFactor;

    // Conservative TV approach: don't start at 4K immediately unless bandwidth is massive;
    // start at 1080p or highest safe tier below 2160p
    let candidate = ladder[0];
    for (const rep of ladder) {
      if (rep.bitrate <= safeBw && rep.height <= 1080) {
        candidate = rep;
      }
    }
    return candidate;
  }

  private applySwitch(rep: MediaRepresentation, now: number): void {
    this.state.currentRepresentation = rep;
    this.lastSwitchTimestamp = now;
    this.state.qualitySwitchesCount++;
  }
}
