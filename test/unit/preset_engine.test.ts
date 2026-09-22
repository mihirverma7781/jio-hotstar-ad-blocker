import { describe, it, expect } from 'vitest';
import { PresetEngine, ENHANCEMENT_PRESETS } from '../../src/enhancement/PresetEngine';
import { EnhancementConfig } from '../../src/enhancement/types';

describe('PresetEngine', () => {
  const baseConfig: EnhancementConfig = {
    enabled: true,
    upscalerMode: 'AUTO',
    scale: 'AUTO',
    qualityTier: 'BALANCED',
    sharpness: 30,
    denoise: 'LOW',
    deblock: 'LOW',
    contrast: 100,
    saturation: 100,
    hdrVisualEnhancement: false,
    hdrIntensity: 'SUBTLE',
    motionSmoothing: 'OFF',
    preset: 'NATURAL',
    gpuBackend: 'AUTO',
    bypassEnhancement: false,
    sideBySideComparison: false,
    compareSplitPosition: 0.5,
    showDebugHud: false,
    tiledProcessing: false,
    tileSize: 256
  };

  it('retrieves preset definition by name', () => {
    const sports = PresetEngine.getPreset('SPORTS');
    expect(sports.name).toBe('SPORTS');
    expect(sports.motionSmoothing).toBe('SMOOTH_60');
    expect(sports.qualityTier).toBe('HIGH');
  });

  it('applies CINEMA preset parameters correctly to configuration', () => {
    const cinemaConfig = PresetEngine.applyPresetToConfig('CINEMA', baseConfig);
    expect(cinemaConfig.preset).toBe('CINEMA');
    expect(cinemaConfig.upscalerMode).toBe('ENHANCED');
    expect(cinemaConfig.scale).toBe(2);
    expect(cinemaConfig.contrast).toBe(106);
    expect(cinemaConfig.hdrVisualEnhancement).toBe(true);
  });

  it('applies SPORTS preset activating 60 FPS motion smoothing', () => {
    const sportsConfig = PresetEngine.applyPresetToConfig('SPORTS', baseConfig);
    expect(sportsConfig.preset).toBe('SPORTS');
    expect(sportsConfig.motionSmoothing).toBe('SMOOTH_60');
    expect(sportsConfig.sharpness).toBe(35);
  });

  it('applies ANIME preset setting ultra tier, 50 sharpness, and 60 FPS motion smoothing', () => {
    const animeConfig = PresetEngine.applyPresetToConfig('ANIME', baseConfig);
    expect(animeConfig.preset).toBe('ANIME');
    expect(animeConfig.qualityTier).toBe('ULTRA');
    expect(animeConfig.sharpness).toBe(50);
    expect(animeConfig.motionSmoothing).toBe('SMOOTH_60');
  });

  it('lists all available preset summaries with valid keys', () => {
    const list = PresetEngine.getAllPresets();
    expect(list.length).toBe(Object.keys(ENHANCEMENT_PRESETS).length);
    const keys = list.map(p => p.name);
    expect(keys).toContain('CINEMA');
    expect(keys).toContain('SPORTS');
    expect(keys).toContain('ANIME');
    expect(keys).toContain('VIVID');
  });
});
