import { describe, it, expect, beforeEach } from 'vitest';
import { TVAdaptationController } from '../../src/core/TVAdaptationController';
import { MediaRepresentation } from '../../src/types/tv_mode';

describe('TVAdaptationController', () => {
  const sampleLadder: MediaRepresentation[] = [
    { id: 'rep-720p', width: 1280, height: 720, bitrate: 2500000, codec: 'H264', codecString: 'avc1', framerate: 30, hdr: false, dynamicRange: 'SDR', bitDepth: 8, mimeType: 'video/mp4' },
    { id: 'rep-1080p', width: 1920, height: 1080, bitrate: 5500000, codec: 'H264', codecString: 'avc1', framerate: 60, hdr: false, dynamicRange: 'SDR', bitDepth: 8, mimeType: 'video/mp4' },
    { id: 'rep-1440p', width: 2560, height: 1440, bitrate: 9000000, codec: 'VP9', codecString: 'vp09', framerate: 60, hdr: false, dynamicRange: 'SDR', bitDepth: 8, mimeType: 'video/webm' },
    { id: 'rep-4k', width: 3840, height: 2160, bitrate: 16000000, codec: 'AV1', codecString: 'av01', framerate: 60, hdr: false, dynamicRange: 'SDR', bitDepth: 8, mimeType: 'video/mp4' }
  ];

  let abr: TVAdaptationController;

  beforeEach(() => {
    abr = new TVAdaptationController({
      startupBufferTarget: 8,
      rebufferThreshold: 3,
      upgradeThreshold: 12,
      downgradeThreshold: 4,
      qualityHoldTime: 5000,
      bandwidthSafetyFactor: 0.75
    });
  });

  it('selects conservative 1080p on initial startup when bandwidth is ample', () => {
    abr.setBandwidthEstimate(25_000_000); // 25 Mbps
    const result = abr.evaluate(0, sampleLadder);

    expect(result.nextRepresentation.height).toBe(1080);
    expect(result.action).toBe('hold');
  });

  it('performs emergency drop immediately when buffer drops below rebufferThreshold (<3s)', () => {
    abr.setBandwidthEstimate(25_000_000);
    abr.evaluate(10, sampleLadder); // Set initial state to 1080p

    // Buffer collapses to 1.5 seconds
    const result = abr.evaluate(1.5, sampleLadder);
    expect(result.action).toBe('emergency-drop');
    expect(result.nextRepresentation.height).toBeLessThan(1080);
  });

  it('promotes quality to 1440p and 4K when buffer is healthy and hold time expires', () => {
    abr.setBandwidthEstimate(30_000_000); // 30 Mbps ample bandwidth
    const t0 = 100000;
    abr.evaluate(10, sampleLadder, t0); // Initial 1080p

    // Immediate evaluate with good buffer but hold time not met -> holds
    const holdRes = abr.evaluate(14, sampleLadder, t0 + 2000);
    expect(holdRes.action).toBe('hold');

    // After qualityHoldTime (5000ms), buffer > upgradeThreshold (14s > 12s) -> upgrades to 1440p
    const upgradeRes = abr.evaluate(14, sampleLadder, t0 + 6000);
    expect(upgradeRes.action).toBe('upgrade');
    expect(upgradeRes.nextRepresentation.height).toBe(1440);
  });

  it('recovers gradually without violent oscillation', () => {
    abr.setBandwidthEstimate(40_000_000);
    const t0 = 100000;
    abr.evaluate(10, sampleLadder, t0); // Initial 1080p

    // First upgrade to 1440p
    const res1 = abr.evaluate(15, sampleLadder, t0 + 6000);
    expect(res1.nextRepresentation.height).toBe(1440);

    // Cannot immediately jump to 4K on same tick
    const res2 = abr.evaluate(15, sampleLadder, t0 + 7000);
    expect(res2.action).toBe('hold');
    expect(res2.nextRepresentation.height).toBe(1440);

    // After second hold time, steps up to 4K
    const res3 = abr.evaluate(16, sampleLadder, t0 + 13000);
    expect(res3.action).toBe('upgrade');
    expect(res3.nextRepresentation.height).toBe(2160);
  });
});
