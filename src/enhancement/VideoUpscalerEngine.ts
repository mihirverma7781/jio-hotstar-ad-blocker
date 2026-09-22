/**
 * VideoUpscalerEngine
 * Calculates output resolution scales, enforces source-adaptive heuristics,
 * and maintains temporal stability to avoid shimmering artifacts.
 */

import { Resolution, ScaleFactor, DenoiseMode, DeblockMode, UpscalerMode } from './types';

export interface SourceAdaptiveProfile {
  targetScale: number;
  outputResolution: Resolution;
  recommendedDenoise: DenoiseMode;
  recommendedDeblock: DeblockMode;
  recommendedSharpness: number;
  recommendedMode: UpscalerMode;
}

export class VideoUpscalerEngine {
  private previousLumaSample: number = 0;
  private temporalStabilityFactor: number = 1.0;

  /**
   * Calculates target resolution based on source dimensions and scale factor.
   */
  public calculateTargetResolution(
    sourceWidth: number,
    sourceHeight: number,
    requestedScale: ScaleFactor
  ): { width: number; height: number; scaleFactor: number } {
    const srcW = sourceWidth > 0 ? sourceWidth : 1920;
    const srcH = sourceHeight > 0 ? sourceHeight : 1080;

    let scale = 2.0;

    if (requestedScale === 2) {
      scale = 2.0;
    } else if (requestedScale === 3) {
      scale = 3.0;
    } else if (requestedScale === 4) {
      scale = 4.0;
    } else if (requestedScale === 'DISPLAY_NATIVE') {
      const screenW = typeof window !== 'undefined' ? (window.screen.width * (window.devicePixelRatio || 1)) : 3840;
      scale = Math.max(1.0, Math.min(4.0, screenW / srcW));
    } else if (requestedScale === 'AUTO') {
      // Auto-adapt: 1080p -> 2x (4K), 720p -> 3x (4K), 480p -> 4x
      if (srcH <= 540) {
        scale = 4.0;
      } else if (srcH <= 720) {
        scale = 3.0;
      } else {
        scale = 2.0;
      }
    }

    const outW = Math.round(srcW * scale);
    const outH = Math.round(srcH * scale);

    return { width: outW, height: outH, scaleFactor: scale };
  }

  /**
   * Source-Adaptive Processing: Adjusts processing intensity based on input stream quality.
   */
  public getSourceAdaptiveProfile(
    sourceWidth: number,
    sourceHeight: number,
    requestedMode: UpscalerMode,
    userSharpness: number
  ): SourceAdaptiveProfile {
    const srcH = sourceHeight > 0 ? sourceHeight : 1080;
    const { width, height, scaleFactor } = this.calculateTargetResolution(sourceWidth, sourceHeight, 'AUTO');

    if (srcH <= 540) {
      // 480p / 540p: Strong compression artifacts require high deblocking & denoise, conservative sharpness
      return {
        targetScale: scaleFactor,
        outputResolution: { width, height },
        recommendedDenoise: 'MEDIUM',
        recommendedDeblock: 'HIGH',
        recommendedSharpness: Math.min(userSharpness, 20),
        recommendedMode: requestedMode === 'AUTO' ? 'ENHANCED' : requestedMode
      };
    } else if (srcH <= 720) {
      // 720p: Moderate denoise + 3x upscale + edge sharpening
      return {
        targetScale: scaleFactor,
        outputResolution: { width, height },
        recommendedDenoise: 'LOW',
        recommendedDeblock: 'MEDIUM',
        recommendedSharpness: Math.min(userSharpness, 30),
        recommendedMode: requestedMode === 'AUTO' ? 'ENHANCED' : requestedMode
      };
    } else if (srcH <= 960) {
      // 960p (common adaptive streaming ladder): Light denoise + 2x/4x upscale + edge reconstruction
      return {
        targetScale: scaleFactor,
        outputResolution: { width, height },
        recommendedDenoise: 'LOW',
        recommendedDeblock: 'LOW',
        recommendedSharpness: Math.min(userSharpness, 35),
        recommendedMode: requestedMode === 'AUTO' ? 'NEURAL' : requestedMode
      };
    } else {
      // 1080p: Full neural super-resolution to 4K (3840x2160)
      return {
        targetScale: scaleFactor,
        outputResolution: { width: 3840, height: 2160 },
        recommendedDenoise: 'LOW',
        recommendedDeblock: 'LOW',
        recommendedSharpness: userSharpness,
        recommendedMode: requestedMode === 'AUTO' ? 'NEURAL' : requestedMode
      };
    }
  }

  /**
   * Temporal Stability: Evaluates frame-to-frame delta to damp high-frequency shimmering.
   */
  public updateTemporalStability(currentFrameLuma: number): number {
    const delta = Math.abs(currentFrameLuma - this.previousLumaSample);
    this.previousLumaSample = currentFrameLuma;

    if (delta > 0.15) {
      // Scene cut: reset stability dampening
      this.temporalStabilityFactor = 1.0;
    } else {
      // Smooth gradual adjustment
      this.temporalStabilityFactor = 0.85 + 0.15 * (1.0 - Math.min(1.0, delta * 5.0));
    }

    return this.temporalStabilityFactor;
  }
}
