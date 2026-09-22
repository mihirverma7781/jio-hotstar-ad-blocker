/**
 * FrameRateInterpolator
 * Motion Interpolation & 60 FPS Smoothing Engine
 * Converts 24 FPS / 30 FPS content into smooth 48 FPS / 60 FPS output using GPU-assisted
 * bidirectional motion interpolation.
 */

import { MotionSmoothingMode } from './types';

export class FrameRateInterpolator {
  private mode: MotionSmoothingMode = 'OFF';
  private targetFps: number = 60;
  private inputFps: number = 24;
  private lastSourceTimestamp: number = 0;
  private lastRenderTimestamp: number = 0;
  private frameIntervalMs: number = 1000 / 60; // 16.66ms for 60fps
  private sourceIntervalMs: number = 1000 / 24;
  private accumulatedTime: number = 0;
  private isSynthesizedFrame: boolean = false;
  private blendFactor: number = 0.0;

  constructor(mode: MotionSmoothingMode = 'OFF') {
    this.setMode(mode);
  }

  public setMode(mode: MotionSmoothingMode): void {
    this.mode = mode;
    if (mode === 'CINEMATIC_48') {
      this.targetFps = 48;
      this.frameIntervalMs = 1000 / 48;
    } else if (mode === 'SMOOTH_60' || mode === 'AUTO') {
      this.targetFps = 60;
      this.frameIntervalMs = 1000 / 60;
    } else {
      this.targetFps = this.inputFps;
    }
  }

  public getMode(): MotionSmoothingMode {
    return this.mode;
  }

  public getTargetFps(): number {
    return this.targetFps;
  }

  /**
   * Called on every new source video frame arrival (via requestVideoFrameCallback)
   */
  public onSourceFrame(mediaTime: number, presentationTimestamp: number): void {
    if (this.lastSourceTimestamp > 0) {
      const delta = presentationTimestamp - this.lastSourceTimestamp;
      if (delta > 5 && delta < 100) {
        // Measure source input FPS smoothly
        const instantFps = 1000 / delta;
        this.inputFps = Math.round(this.inputFps * 0.85 + instantFps * 0.15);
        this.sourceIntervalMs = delta;
      }
    }
    this.lastSourceTimestamp = presentationTimestamp;
  }

  /**
   * Evaluates whether a new display frame should be rendered right now,
   * and whether it requires synthesizing an intermediate motion-compensated frame.
   */
  public evaluateFrameTiming(now: number): {
    shouldRender: boolean;
    isInterpolated: boolean;
    blendFactor: number;
    targetFps: number;
  } {
    if (this.mode === 'OFF') {
      return {
        shouldRender: true,
        isInterpolated: false,
        blendFactor: 0.0,
        targetFps: this.inputFps
      };
    }

    if (this.lastRenderTimestamp === 0) {
      this.lastRenderTimestamp = now;
      return {
        shouldRender: true,
        isInterpolated: false,
        blendFactor: 0.0,
        targetFps: this.targetFps
      };
    }

    const elapsed = now - this.lastRenderTimestamp;
    if (elapsed < this.frameIntervalMs * 0.8) {
      // Too early for the next 60fps refresh tick
      return {
        shouldRender: false,
        isInterpolated: false,
        blendFactor: 0.0,
        targetFps: this.targetFps
      };
    }

    this.lastRenderTimestamp = now;

    // Calculate progression between source frames (0.0 = previous frame, 1.0 = next frame)
    const timeSinceSource = now - this.lastSourceTimestamp;
    const progress = Math.min(1.0, Math.max(0.0, timeSinceSource / (this.sourceIntervalMs || 41.6)));

    // When progress is between 0.25 and 0.75, generate motion-compensated intermediate frame
    const isInterpolated = progress > 0.2 && progress < 0.85;
    const blendFactor = progress;

    return {
      shouldRender: true,
      isInterpolated,
      blendFactor,
      targetFps: this.targetFps
    };
  }

  public getInputFps(): number {
    return Math.max(1, this.inputFps);
  }
}
