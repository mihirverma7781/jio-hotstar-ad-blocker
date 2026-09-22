import { describe, it, expect } from 'vitest';
import { VideoUpscalerEngine } from '../../src/enhancement/VideoUpscalerEngine';

describe('VideoUpscalerEngine', () => {
  const engine = new VideoUpscalerEngine();

  it('calculates 2x upscale correctly for 1080p source (1920x1080 -> 3840x2160)', () => {
    const res = engine.calculateTargetResolution(1920, 1080, 2);
    expect(res.width).toBe(3840);
    expect(res.height).toBe(2160);
    expect(res.scaleFactor).toBe(2.0);
  });

  it('calculates 3x upscale correctly for 720p source (1280x720 -> 3840x2160)', () => {
    const res = engine.calculateTargetResolution(1280, 720, 3);
    expect(res.width).toBe(3840);
    expect(res.height).toBe(2160);
    expect(res.scaleFactor).toBe(3.0);
  });

  it('calculates 4x upscale correctly for 480p/540p source (960x540 -> 3840x2160)', () => {
    const res = engine.calculateTargetResolution(960, 540, 4);
    expect(res.width).toBe(3840);
    expect(res.height).toBe(2160);
    expect(res.scaleFactor).toBe(4.0);
  });

  it('auto-adapts scale factor based on vertical resolution height', () => {
    // 540p -> 4x
    const res540 = engine.calculateTargetResolution(960, 540, 'AUTO');
    expect(res540.scaleFactor).toBe(4.0);

    // 720p -> 3x
    const res720 = engine.calculateTargetResolution(1280, 720, 'AUTO');
    expect(res720.scaleFactor).toBe(3.0);

    // 1080p -> 2x
    const res1080 = engine.calculateTargetResolution(1920, 1080, 'AUTO');
    expect(res1080.scaleFactor).toBe(2.0);
  });

  it('provides source-adaptive profile recommendations tailored to source quality', () => {
    // 540p source requires HIGH deblocking and MEDIUM denoise
    const profile540 = engine.getSourceAdaptiveProfile(960, 540, 'AUTO', 50);
    expect(profile540.recommendedDeblock).toBe('HIGH');
    expect(profile540.recommendedDenoise).toBe('MEDIUM');
    expect(profile540.recommendedSharpness).toBeLessThanOrEqual(20);

    // 1080p source uses NEURAL mode and full user sharpness
    const profile1080 = engine.getSourceAdaptiveProfile(1920, 1080, 'AUTO', 40);
    expect(profile1080.recommendedMode).toBe('NEURAL');
    expect(profile1080.recommendedDeblock).toBe('LOW');
    expect(profile1080.recommendedSharpness).toBe(40);
  });

  it('resets temporal stability factor on high luma delta (scene cut)', () => {
    engine.updateTemporalStability(0.2);
    // Sudden drastic brightness change (scene cut > 0.15)
    const factor = engine.updateTemporalStability(0.85);
    expect(factor).toBe(1.0);
  });
});
