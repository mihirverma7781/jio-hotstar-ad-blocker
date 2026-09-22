/**
 * EnhancementPerformanceController
 * Monitors GPU frame times, render FPS, latency, and dropped frames.
 * Automatically downshifts processing tiers and adapts frame-skip policies
 * to guarantee stutter-free playback.
 */

import { ProcessingTier, UpscalerMode } from './types';

export interface PerformanceStats {
  renderFps: number;
  inputFps: number;
  gpuTimeMs: number;
  latencyMs: number;
  droppedFrames: number;
  loadPercent: number;
  currentTier: ProcessingTier;
  frameSkipActive: boolean;
}

export class EnhancementPerformanceController {
  private currentTier: ProcessingTier = 'BALANCED';
  private frameTimes: number[] = [];
  private renderFps: number = 0;
  private inputFps: number = 24;
  private lastFpsCalcTime: number = 0;
  private frameCount: number = 0;
  private droppedFrames: number = 0;
  private initialDroppedFrames: number = 0;
  private frameSkipCounter: number = 0;
  private consecutiveSlowFrames: number = 0;
  private consecutiveFastFrames: number = 0;

  constructor(initialTier: ProcessingTier = 'BALANCED') {
    this.currentTier = initialTier;
  }

  public setTier(tier: ProcessingTier): void {
    this.currentTier = tier;
    this.consecutiveSlowFrames = 0;
    this.consecutiveFastFrames = 0;
  }

  public getTier(): ProcessingTier {
    return this.currentTier;
  }

  /**
   * Records a completed frame cycle.
   */
  public recordFrame(gpuTimeMs: number, video: HTMLVideoElement | null): void {
    const now = performance.now();
    this.frameCount++;
    this.frameTimes.push(gpuTimeMs);
    if (this.frameTimes.length > 30) this.frameTimes.shift();

    // Check video dropped frames
    if (video && (video as any).getVideoPlaybackQuality) {
      const q = (video as any).getVideoPlaybackQuality();
      if (this.initialDroppedFrames === 0 && q.droppedVideoFrames > 0) {
        this.initialDroppedFrames = q.droppedVideoFrames;
      }
      this.droppedFrames = Math.max(0, q.droppedVideoFrames - this.initialDroppedFrames);
    }

    // Recalculate FPS every 1000ms
    if (this.lastFpsCalcTime === 0) {
      this.lastFpsCalcTime = now;
    } else if (now - this.lastFpsCalcTime >= 1000) {
      this.renderFps = Math.max(1, Math.round((this.frameCount * 1000) / (now - this.lastFpsCalcTime)));
      this.frameCount = 0;
      this.lastFpsCalcTime = now;
      this.evaluateTierAdaptation();
    }
  }

  /**
   * Automatic tier downshifting / upshifting based on GPU frame time budget.
   */
  private evaluateTierAdaptation(): void {
    const avgGpuTime = this.getAverageGpuTime();
    const targetBudgetMs = 1000 / (this.renderFps || 30);

    // If GPU takes > 85% of frame interval consistently, downshift tier
    if (avgGpuTime > targetBudgetMs * 0.85) {
      this.consecutiveSlowFrames++;
      this.consecutiveFastFrames = 0;
      if (this.consecutiveSlowFrames >= 2) {
        this.downshiftTier();
        this.consecutiveSlowFrames = 0;
      }
    } else if (avgGpuTime < targetBudgetMs * 0.45) {
      this.consecutiveFastFrames++;
      this.consecutiveSlowFrames = 0;
      // Conservative upshifting
      if (this.consecutiveFastFrames >= 8) {
        this.upshiftTier();
        this.consecutiveFastFrames = 0;
      }
    }
  }

  private downshiftTier(): void {
    if (this.currentTier === 'ULTRA') {
      this.currentTier = 'HIGH';
      console.log('[PerformanceController] Auto-throttling to HIGH tier');
    } else if (this.currentTier === 'HIGH') {
      this.currentTier = 'BALANCED';
      console.log('[PerformanceController] Auto-throttling to BALANCED tier');
    } else if (this.currentTier === 'BALANCED') {
      this.currentTier = 'PERFORMANCE';
      console.log('[PerformanceController] Auto-throttling to PERFORMANCE tier');
    }
  }

  private upshiftTier(): void {
    if (this.currentTier === 'PERFORMANCE') {
      this.currentTier = 'BALANCED';
    } else if (this.currentTier === 'BALANCED') {
      this.currentTier = 'HIGH';
    }
  }

  /**
   * Frame Skip Policy: For 60 FPS or high-load situations,
   * determines if a frame should receive full neural pass or lightweight upscale.
   */
  public shouldExecuteFullNeuralPass(): boolean {
    if (this.currentTier === 'PERFORMANCE') return false;
    if (this.currentTier === 'ULTRA') return true;

    // For 60fps or high tier: alternate frames if budget is tight
    const avgGpuTime = this.getAverageGpuTime();
    if (avgGpuTime > 14.0) {
      this.frameSkipCounter = (this.frameSkipCounter + 1) % 2;
      return this.frameSkipCounter === 0;
    }

    return true;
  }

  public getAverageGpuTime(): number {
    if (this.frameTimes.length === 0) return 0;
    const sum = this.frameTimes.reduce((acc, t) => acc + t, 0);
    return Math.round((sum / this.frameTimes.length) * 10) / 10;
  }

  public getStats(): PerformanceStats {
    const avgGpu = this.getAverageGpuTime();
    const targetInterval = 1000 / (this.renderFps || 30);
    const loadPercent = Math.min(100, Math.round((avgGpu / targetInterval) * 100));

    return {
      renderFps: this.renderFps || 24,
      inputFps: this.inputFps || 24,
      gpuTimeMs: avgGpu,
      latencyMs: Math.round(avgGpu * 1.2),
      droppedFrames: this.droppedFrames,
      loadPercent,
      currentTier: this.currentTier,
      frameSkipActive: avgGpu > 14.0 && this.currentTier !== 'ULTRA'
    };
  }

  public setInputFps(fps: number): void {
    if (fps > 0) this.inputFps = fps;
  }
}
