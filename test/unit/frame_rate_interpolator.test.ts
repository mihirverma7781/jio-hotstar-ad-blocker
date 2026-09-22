import { describe, it, expect } from 'vitest';
import { FrameRateInterpolator } from '../../src/enhancement/FrameRateInterpolator';

describe('FrameRateInterpolator', () => {
  it('initializes with target FPS matching selected mode', () => {
    const interpolator60 = new FrameRateInterpolator('SMOOTH_60');
    expect(interpolator60.getTargetFps()).toBe(60);

    const interpolator48 = new FrameRateInterpolator('CINEMATIC_48');
    expect(interpolator48.getTargetFps()).toBe(48);

    const interpolatorOff = new FrameRateInterpolator('OFF');
    expect(interpolatorOff.getTargetFps()).toBe(24);
  });

  it('measures source frame rate accurately from arrival timestamps', () => {
    const interpolator = new FrameRateInterpolator('SMOOTH_60');

    // Simulate 24fps frames arriving every ~41.6ms
    let t = 1000;
    interpolator.onSourceFrame(0.0, t);
    for (let i = 1; i <= 10; i++) {
      t += 41.66;
      interpolator.onSourceFrame(i * 0.0416, t);
    }

    expect(interpolator.getInputFps()).toBeCloseTo(24, 0);
  });

  it('returns shouldRender=false when called too early for 60fps frame interval', () => {
    const interpolator = new FrameRateInterpolator('SMOOTH_60');
    const start = 1000;
    interpolator.onSourceFrame(0, start);

    // First render tick
    const first = interpolator.evaluateFrameTiming(start);
    expect(first.shouldRender).toBe(true);

    // Call again only 4ms later (interval for 60fps is ~16.6ms)
    const tooEarly = interpolator.evaluateFrameTiming(start + 4);
    expect(tooEarly.shouldRender).toBe(false);
  });

  it('detects and synthesizes interpolated intermediate frame between source ticks', () => {
    const interpolator = new FrameRateInterpolator('SMOOTH_60');
    const sourceTime = 2000;
    // Source frame arrives at 2000ms
    interpolator.onSourceFrame(0.0, sourceTime);

    // Initial render at 2000ms
    interpolator.evaluateFrameTiming(sourceTime);

    // Next display tick arrives ~18ms later (halfway through a 41.6ms 24fps source frame interval)
    const intermediate = interpolator.evaluateFrameTiming(sourceTime + 18);
    expect(intermediate.shouldRender).toBe(true);
    expect(intermediate.isInterpolated).toBe(true);
    expect(intermediate.blendFactor).toBeGreaterThan(0.2);
    expect(intermediate.blendFactor).toBeLessThan(0.8);
  });

  it('bypasses synthesis when mode is OFF', () => {
    const interpolator = new FrameRateInterpolator('OFF');
    const timing = interpolator.evaluateFrameTiming(5000);
    expect(timing.shouldRender).toBe(true);
    expect(timing.isInterpolated).toBe(false);
    expect(timing.blendFactor).toBe(0.0);
  });
});
