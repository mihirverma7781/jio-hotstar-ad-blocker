/**
 * PrimeVideoEnhancer
 * Specialized integration for Amazon Prime Video web player.
 * Configures optimal source-adaptive parameters (960p vs 1080p),
 * detects DRM frame security, and falls back to compositor enhancement when required.
 */

import { EnhancementConfig, UpscalerMode, DenoiseMode, DeblockMode } from './types';
import { FrameAccessManager } from './FrameAccessManager';

export interface PrimeEnhancementProfile {
  sourceResolutionLabel: string;
  recommendedMode: UpscalerMode;
  denoise: DenoiseMode;
  deblock: DeblockMode;
  sharpness: number;
  hdrVisualEnhancement: boolean;
  canUseGpuPixelPipeline: boolean;
  diagnosticStatus: string;
}

export class PrimeVideoEnhancer {
  private frameAccessManager: FrameAccessManager;

  constructor(accessManager?: FrameAccessManager) {
    this.frameAccessManager = accessManager || new FrameAccessManager();
  }

  /**
   * Evaluates current Prime Video playback and constructs optimal configuration.
   */
  public evaluatePrimePlayback(
    video: HTMLVideoElement | null,
    baseConfig: EnhancementConfig
  ): { profile: PrimeEnhancementProfile; adaptedConfig: EnhancementConfig } {
    const w = video?.videoWidth || 1920;
    const h = video?.videoHeight || 1080;

    const accessReport = this.frameAccessManager.probeVideoFrameAccess(video);
    const canUseGpu = accessReport.capability !== 'COMPOSITOR_ENHANCEMENT' && accessReport.capability !== 'NONE';

    let label = '1080p';
    let mode: UpscalerMode = 'NEURAL';
    let denoise: DenoiseMode = 'LOW';
    let deblock: DeblockMode = 'LOW';
    let sharpness = 25;

    if (h <= 540) {
      label = '540p';
      mode = 'ENHANCED';
      denoise = 'MEDIUM';
      deblock = 'HIGH';
      sharpness = 20;
    } else if (h <= 720) {
      label = '720p';
      mode = 'ENHANCED';
      denoise = 'LOW';
      deblock = 'MEDIUM';
      sharpness = 30;
    } else if (h <= 960) {
      label = '960p';
      mode = 'ENHANCED';
      denoise = 'LOW';
      deblock = 'MEDIUM';
      sharpness = 35;
    } else {
      label = '1080p';
      mode = 'NEURAL';
      denoise = 'LOW';
      deblock = 'LOW';
      sharpness = 25;
    }

    const profile: PrimeEnhancementProfile = {
      sourceResolutionLabel: label,
      recommendedMode: mode,
      denoise,
      deblock,
      sharpness,
      hdrVisualEnhancement: baseConfig.hdrVisualEnhancement,
      canUseGpuPixelPipeline: canUseGpu,
      diagnosticStatus: accessReport.diagnosticReason
    };

    const adaptedConfig: EnhancementConfig = {
      ...baseConfig,
      upscalerMode: baseConfig.upscalerMode === 'AUTO' ? mode : baseConfig.upscalerMode,
      denoise: baseConfig.denoise === 'LOW' ? denoise : baseConfig.denoise,
      deblock: baseConfig.deblock === 'LOW' ? deblock : baseConfig.deblock,
      sharpness: baseConfig.sharpness || sharpness
    };

    return { profile, adaptedConfig };
  }
}
