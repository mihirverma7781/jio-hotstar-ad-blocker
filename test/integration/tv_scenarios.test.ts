import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TVModeController } from '../../src/core/TVModeController';
import { TVCapabilityEngine } from '../../src/core/TVCapabilityEngine';
import { TVDiagnostics } from '../../src/core/TVDiagnostics';
import { DisplayCapability, MediaRepresentation, TVModeProfile } from '../../src/types/tv_mode';

describe('TV Mode — Comprehensive Integration Scenarios', () => {
  const display4kHdr: DisplayCapability = {
    width: 3840,
    height: 2160,
    devicePixelRatio: 2,
    effectiveWidth: 3840,
    effectiveHeight: 2160,
    fullscreenSupport: true,
    colorGamut: 'rec2020',
    displayHDR: true
  };

  const display1080pSdr: DisplayCapability = {
    width: 1920,
    height: 1080,
    devicePixelRatio: 1,
    effectiveWidth: 1920,
    effectiveHeight: 1080,
    fullscreenSupport: true,
    colorGamut: 'srgb',
    displayHDR: false
  };

  const repsFullLadder: MediaRepresentation[] = [
    { id: '2160p-hdr-hevc', width: 3840, height: 2160, bitrate: 18500000, codec: 'HEVC', codecString: 'hvc1.2.4.L150.B0', framerate: 60, hdr: true, dynamicRange: 'HDR10', bitDepth: 10, mimeType: 'video/mp4; codecs="hvc1.2.4.L150.B0"' },
    { id: '2160p-sdr-av1', width: 3840, height: 2160, bitrate: 14000000, codec: 'AV1', codecString: 'av01.0.12M.08', framerate: 60, hdr: false, dynamicRange: 'SDR', bitDepth: 8, mimeType: 'video/mp4; codecs="av01.0.12M.08"' },
    { id: '1440p-hdr-vp9', width: 2560, height: 1440, bitrate: 10000000, codec: 'VP9', codecString: 'vp09.02.51.10.01.09.16.09.00', framerate: 60, hdr: true, dynamicRange: 'HDR10', bitDepth: 10, mimeType: 'video/webm; codecs="vp09.02.51.10.01.09.16.09.00"' },
    { id: '1440p-sdr-vp9', width: 2560, height: 1440, bitrate: 8500000, codec: 'VP9', codecString: 'vp09.00.51.08', framerate: 60, hdr: false, dynamicRange: 'SDR', bitDepth: 8, mimeType: 'video/webm; codecs="vp09.00.51.08"' },
    { id: '1080p-hdr-vp9', width: 1920, height: 1080, bitrate: 6500000, codec: 'VP9', codecString: 'vp09.02.41.10.01.09.16.09.00', framerate: 60, hdr: true, dynamicRange: 'HDR10', bitDepth: 10, mimeType: 'video/webm; codecs="vp09.02.41.10.01.09.16.09.00"' },
    { id: '1080p-sdr-h264', width: 1920, height: 1080, bitrate: 5500000, codec: 'H264', codecString: 'avc1.640028', framerate: 60, hdr: false, dynamicRange: 'SDR', bitDepth: 8, mimeType: 'video/mp4; codecs="avc1.640028"' },
    { id: '720p-sdr-h264', width: 1280, height: 720, bitrate: 2800000, codec: 'H264', codecString: 'avc1.4d401f', framerate: 30, hdr: false, dynamicRange: 'SDR', bitDepth: 8, mimeType: 'video/mp4; codecs="avc1.4d401f"' }
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Scenario 1: 4K HDR
  it('Scenario: 4K HDR - selects 2160p HDR10 when display and decoder support 4K HDR', async () => {
    vi.spyOn(TVCapabilityEngine, 'getDisplayCapability').mockReturnValue(display4kHdr);
    vi.spyOn(TVCapabilityEngine, 'isRepresentationDecodable').mockResolvedValue({ supported: true, smooth: true, reason: 'Supported' });

    const controller = new TVModeController({ preferHDR: true, prefer4K: true, preferredResolution: 2160 });
    const result = await controller.setRepresentations(repsFullLadder);

    expect(result.selected?.id).toBe('2160p-hdr-hevc');
    expect(result.selected?.height).toBe(2160);
    expect(result.selected?.hdr).toBe(true);
  });

  // Scenario 2: 4K SDR
  it('Scenario: 4K SDR - selects 2160p SDR when HDR is disabled in profile', async () => {
    vi.spyOn(TVCapabilityEngine, 'getDisplayCapability').mockReturnValue(display4kHdr);
    vi.spyOn(TVCapabilityEngine, 'isRepresentationDecodable').mockResolvedValue({ supported: true, smooth: true, reason: 'Supported' });

    const controller = new TVModeController({ preferHDR: false, prefer4K: true, preferredResolution: 2160 });
    const result = await controller.setRepresentations(repsFullLadder);

    expect(result.selected?.id).toBe('2160p-sdr-av1');
    expect(result.selected?.height).toBe(2160);
    expect(result.selected?.hdr).toBe(false);
  });

  // Scenario 3: 1440p
  it('Scenario: 1440p - selects 1440p when user profile sets resolution cap to 1440', async () => {
    vi.spyOn(TVCapabilityEngine, 'getDisplayCapability').mockReturnValue(display4kHdr);
    vi.spyOn(TVCapabilityEngine, 'isRepresentationDecodable').mockResolvedValue({ supported: true, smooth: true, reason: 'Supported' });

    const controller = new TVModeController({ preferredResolution: 1440, preferHDR: true });
    const result = await controller.setRepresentations(repsFullLadder);

    expect(result.selected?.height).toBe(1440);
    expect(result.selected?.id).toBe('1440p-hdr-vp9');
  });

  // Scenario 4: 1080p
  it('Scenario: 1080p - selects 1080p when user profile sets resolution cap to 1080', async () => {
    vi.spyOn(TVCapabilityEngine, 'getDisplayCapability').mockReturnValue(display4kHdr);
    vi.spyOn(TVCapabilityEngine, 'isRepresentationDecodable').mockResolvedValue({ supported: true, smooth: true, reason: 'Supported' });

    const controller = new TVModeController({ preferredResolution: 1080, preferHDR: false });
    const result = await controller.setRepresentations(repsFullLadder);

    expect(result.selected?.height).toBe(1080);
    expect(result.selected?.id).toBe('1080p-sdr-h264');
  });

  // Scenario 5: HDR unavailable in stream
  it('Scenario: HDR unavailable in stream - selects 2160p SDR smoothly without errors', async () => {
    vi.spyOn(TVCapabilityEngine, 'getDisplayCapability').mockReturnValue(display4kHdr);
    vi.spyOn(TVCapabilityEngine, 'isRepresentationDecodable').mockResolvedValue({ supported: true, smooth: true, reason: 'Supported' });

    const sdrOnlyLadder = repsFullLadder.filter(r => !r.hdr);
    const controller = new TVModeController({ preferHDR: true, prefer4K: true, preferredResolution: 2160 });
    const result = await controller.setRepresentations(sdrOnlyLadder);

    expect(result.selected?.height).toBe(2160);
    expect(result.selected?.hdr).toBe(false);
  });

  // Scenario 6 & 17: 4K decoder unavailable
  it('Scenario: 4K decoder unavailable - falls back to 1440p or 1080p when browser cannot decode 2160p', async () => {
    vi.spyOn(TVCapabilityEngine, 'getDisplayCapability').mockReturnValue(display4kHdr);
    vi.spyOn(TVCapabilityEngine, 'isRepresentationDecodable').mockImplementation(async (_w, h) => {
      if (h >= 2160) {
        return { supported: false, smooth: false, reason: 'GPU cannot decode 4K' };
      }
      return { supported: true, smooth: true, reason: 'Supported' };
    });

    const controller = new TVModeController({ preferHDR: true, prefer4K: true, preferredResolution: 2160 });
    const result = await controller.setRepresentations(repsFullLadder);

    expect(result.selected?.height).toBe(1440);
    expect(result.fallbackOccurred).toBe(true);
  });

  // Scenario 7 & 8: HEVC unavailable, AV1 available
  it('Scenario: HEVC unavailable, AV1 available - switches to 4K AV1 when HEVC is unsupported', async () => {
    vi.spyOn(TVCapabilityEngine, 'getDisplayCapability').mockReturnValue(display4kHdr);
    vi.spyOn(TVCapabilityEngine, 'isRepresentationDecodable').mockImplementation(async (_w, _h, mime) => {
      if (mime.includes('hvc1')) {
        return { supported: false, smooth: false, reason: 'HEVC unsupported in browser' };
      }
      return { supported: true, smooth: true, reason: 'AV1 supported' };
    });

    const controller = new TVModeController({ preferHDR: true, prefer4K: true, preferredResolution: 2160 });
    const result = await controller.setRepresentations(repsFullLadder);

    expect(result.selected?.codec).toBe('AV1');
    expect(result.selected?.height).toBe(2160);
    expect(result.fallbackOccurred).toBe(true);
  });

  // Scenario 14: Display HDR unavailable
  it('Scenario: Display HDR unavailable - selects 4K SDR or highest SDR when display is SDR-only', async () => {
    vi.spyOn(TVCapabilityEngine, 'getDisplayCapability').mockReturnValue(display1080pSdr);
    vi.spyOn(TVCapabilityEngine, 'isRepresentationDecodable').mockResolvedValue({ supported: true, smooth: true, reason: 'Supported' });

    const controller = new TVModeController({ preferHDR: true, prefer4K: true, preferredResolution: 2160 });
    const result = await controller.setRepresentations(repsFullLadder);

    expect(result.selected?.hdr).toBe(false);
    expect(result.selected?.id).toBe('2160p-sdr-av1');
  });

  // Scenario 15: Service exposes only 1080p
  it('Scenario: Service exposes only 1080p - accurately selects 1080p and flags SERVICE_OFFER bottleneck', async () => {
    vi.spyOn(TVCapabilityEngine, 'getDisplayCapability').mockReturnValue(display4kHdr);
    vi.spyOn(TVCapabilityEngine, 'probeDecoderCapabilities').mockResolvedValue({
      supports2160p: true, supports1440p: true, supports1080p: true,
      supportsHEVC: true, supportsAV1: true, supportsVP9: true, supportsH264: true, supportsHDR10: true, profiles: []
    });
    vi.spyOn(TVCapabilityEngine, 'isRepresentationDecodable').mockResolvedValue({ supported: true, smooth: true, reason: 'Supported' });

    const reps1080pOnly = repsFullLadder.filter(r => r.height <= 1080);
    const controller = new TVModeController({ prefer4K: true, preferredResolution: 2160 });
    const result = await controller.setRepresentations(reps1080pOnly);

    expect(result.selected?.height).toBe(1080);

    // Run Service Analysis
    const analysis = await TVDiagnostics.analyzeServiceSession(reps1080pOnly, result.selected, display4kHdr);
    expect(analysis.bottleneck).toBe('SERVICE_OFFER');
    expect(analysis.serviceMaximumResolution).toBe('1080p');
  });

  // Scenario 16: Service exposes 2160p
  it('Scenario: Service exposes 2160p - verifies 2160p selection and confirms PLAYER_SELECTION', async () => {
    vi.spyOn(TVCapabilityEngine, 'getDisplayCapability').mockReturnValue(display4kHdr);
    vi.spyOn(TVCapabilityEngine, 'probeDecoderCapabilities').mockResolvedValue({
      supports2160p: true, supports1440p: true, supports1080p: true,
      supportsHEVC: true, supportsAV1: true, supportsVP9: true, supportsH264: true, supportsHDR10: true, profiles: []
    });
    vi.spyOn(TVCapabilityEngine, 'isRepresentationDecodable').mockResolvedValue({ supported: true, smooth: true, reason: 'Supported' });

    const controller = new TVModeController({ prefer4K: true, preferredResolution: 2160 });
    const result = await controller.setRepresentations(repsFullLadder);

    expect(result.selected?.height).toBe(2160);

    const analysis = await TVDiagnostics.analyzeServiceSession(repsFullLadder, result.selected, display4kHdr);
    expect(analysis.bottleneck).toBe('PLAYER_SELECTION');
    expect(analysis.serviceMaximumResolution).toBe('2160p');
  });
});
