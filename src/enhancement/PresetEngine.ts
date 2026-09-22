/**
 * PresetEngine
 * Manages video enhancement profiles tailored for Cinema, Anime, Sports, Clean, Vivid, etc.
 */

import { PresetName, EnhancementPreset, EnhancementConfig } from './types';

export const ENHANCEMENT_PRESETS: Record<PresetName, EnhancementPreset> = {
  NATURAL: {
    name: 'NATURAL',
    displayName: 'Natural',
    description: 'Subtle enhancement preserving authentic film grain and creator intent.',
    upscalerMode: 'ENHANCED',
    scale: 'AUTO',
    qualityTier: 'BALANCED',
    sharpness: 20,
    denoise: 'LOW',
    deblock: 'OFF',
    contrast: 102,
    saturation: 102,
    hdrVisualEnhancement: false,
    hdrIntensity: 'SUBTLE',
    motionSmoothing: 'OFF'
  },
  CINEMA: {
    name: 'CINEMA',
    displayName: 'Cinema 4K',
    description: 'Rich contrast, edge-directed super-resolution, and subtle HDR tone expansion.',
    upscalerMode: 'ENHANCED',
    scale: 2,
    qualityTier: 'HIGH',
    sharpness: 30,
    denoise: 'LOW',
    deblock: 'LOW',
    contrast: 106,
    saturation: 104,
    hdrVisualEnhancement: true,
    hdrIntensity: 'SUBTLE',
    motionSmoothing: 'OFF'
  },
  CLEAN: {
    name: 'CLEAN',
    displayName: 'Clean & Denoised',
    description: 'Suppresses macroblocking, mosquito noise, and compression artifacts.',
    upscalerMode: 'ENHANCED',
    scale: 'AUTO',
    qualityTier: 'BALANCED',
    sharpness: 15,
    denoise: 'MEDIUM',
    deblock: 'MEDIUM',
    contrast: 100,
    saturation: 100,
    hdrVisualEnhancement: false,
    hdrIntensity: 'SUBTLE',
    motionSmoothing: 'OFF'
  },
  HDR_ENHANCE: {
    name: 'HDR_ENHANCE',
    displayName: 'HDR Tone Enhance',
    description: 'Deep blacks, expanded highlight headroom, and wider perceived dynamic range.',
    upscalerMode: 'NEURAL',
    scale: 2,
    qualityTier: 'HIGH',
    sharpness: 35,
    denoise: 'LOW',
    deblock: 'LOW',
    contrast: 110,
    saturation: 108,
    hdrVisualEnhancement: true,
    hdrIntensity: 'BALANCED',
    motionSmoothing: 'OFF'
  },
  VIVID: {
    name: 'VIVID',
    displayName: 'Vivid Clarity',
    description: 'Crisp neural details, punchy colors, and dynamic local contrast.',
    upscalerMode: 'NEURAL',
    scale: 2,
    qualityTier: 'ULTRA',
    sharpness: 40,
    denoise: 'LOW',
    deblock: 'OFF',
    contrast: 112,
    saturation: 115,
    hdrVisualEnhancement: true,
    hdrIntensity: 'VIVID',
    motionSmoothing: 'OFF'
  },
  ANIME: {
    name: 'ANIME',
    displayName: 'Anime & Animation',
    description: 'Edge-preserving high-frequency reconstruction tailored for cell animation.',
    upscalerMode: 'NEURAL',
    scale: 2,
    qualityTier: 'ULTRA',
    sharpness: 50,
    denoise: 'MEDIUM',
    deblock: 'LOW',
    contrast: 105,
    saturation: 112,
    hdrVisualEnhancement: false,
    hdrIntensity: 'SUBTLE',
    motionSmoothing: 'SMOOTH_60'
  },
  SPORTS: {
    name: 'SPORTS',
    displayName: 'Live Sports (60 FPS)',
    description: 'Silky smooth 60 FPS motion interpolation with sharp field clarity.',
    upscalerMode: 'ENHANCED',
    scale: 'AUTO',
    qualityTier: 'HIGH',
    sharpness: 35,
    denoise: 'LOW',
    deblock: 'LOW',
    contrast: 108,
    saturation: 106,
    hdrVisualEnhancement: true,
    hdrIntensity: 'SUBTLE',
    motionSmoothing: 'SMOOTH_60'
  },
  CUSTOM: {
    name: 'CUSTOM',
    displayName: 'Custom User Profile',
    description: 'Fully customized user-defined configuration.',
    upscalerMode: 'AUTO',
    scale: 'AUTO',
    qualityTier: 'BALANCED',
    sharpness: 30,
    denoise: 'LOW',
    deblock: 'LOW',
    contrast: 100,
    saturation: 100,
    hdrVisualEnhancement: true,
    hdrIntensity: 'BALANCED',
    motionSmoothing: 'OFF'
  }
};

export class PresetEngine {
  public static getPreset(name: PresetName): EnhancementPreset {
    return ENHANCEMENT_PRESETS[name] || ENHANCEMENT_PRESETS.CINEMA;
  }

  public static applyPresetToConfig(presetName: PresetName, config: EnhancementConfig): EnhancementConfig {
    const preset = this.getPreset(presetName);
    return {
      ...config,
      preset: preset.name,
      upscalerMode: preset.upscalerMode,
      scale: preset.scale,
      qualityTier: preset.qualityTier,
      sharpness: preset.sharpness,
      denoise: preset.denoise,
      deblock: preset.deblock,
      contrast: preset.contrast,
      saturation: preset.saturation,
      hdrVisualEnhancement: preset.hdrVisualEnhancement,
      hdrIntensity: preset.hdrIntensity,
      motionSmoothing: preset.motionSmoothing
    };
  }

  public static getAllPresets(): EnhancementPreset[] {
    return Object.values(ENHANCEMENT_PRESETS);
  }
}
