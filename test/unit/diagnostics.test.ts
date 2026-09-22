import { describe, it, expect, vi } from 'vitest';
import { TVDiagnostics } from '../../src/core/TVDiagnostics';
import { TVCapabilityEngine } from '../../src/core/TVCapabilityEngine';
import { DisplayCapability, MediaRepresentation } from '../../src/types/tv_mode';

describe('TVDiagnostics - Service Analysis Bottlenecks', () => {
  const mockDisplayHdr: DisplayCapability = {
    width: 3840,
    height: 2160,
    devicePixelRatio: 2,
    effectiveWidth: 3840,
    effectiveHeight: 2160,
    fullscreenSupport: true,
    colorGamut: 'rec2020',
    displayHDR: true
  };

  const mockDisplaySdr: DisplayCapability = {
    width: 1920,
    height: 1080,
    devicePixelRatio: 1,
    effectiveWidth: 1920,
    effectiveHeight: 1080,
    fullscreenSupport: true,
    colorGamut: 'srgb',
    displayHDR: false
  };

  const rep1080p: MediaRepresentation = {
    id: '1080p', width: 1920, height: 1080, bitrate: 5000000, codec: 'H264', codecString: 'avc1', framerate: 30, hdr: false, dynamicRange: 'SDR', bitDepth: 8, mimeType: 'video/mp4'
  };

  const rep4kHdr: MediaRepresentation = {
    id: '4k-hdr', width: 3840, height: 2160, bitrate: 18000000, codec: 'HEVC', codecString: 'hvc1', framerate: 60, hdr: true, dynamicRange: 'HDR10', bitDepth: 10, mimeType: 'video/mp4'
  };

  it('classifies SERVICE_OFFER when stream exposes max 1080p to the browser', async () => {
    vi.spyOn(TVCapabilityEngine, 'probeDecoderCapabilities').mockResolvedValue({
      supports2160p: true,
      supports1440p: true,
      supports1080p: true,
      supportsHEVC: true,
      supportsAV1: true,
      supportsVP9: true,
      supportsH264: true,
      supportsHDR10: true,
      profiles: []
    });

    const report = await TVDiagnostics.analyzeServiceSession([rep1080p], rep1080p, mockDisplayHdr);

    expect(report.bottleneck).toBe('SERVICE_OFFER');
    expect(report.bottleneckExplanation).toContain('The streaming service only offered up to 1080p');
  });

  it('classifies BROWSER_CAPABILITY when service offers 4K but browser cannot decode 2160p', async () => {
    vi.spyOn(TVCapabilityEngine, 'probeDecoderCapabilities').mockResolvedValue({
      supports2160p: false,
      supports1440p: true,
      supports1080p: true,
      supportsHEVC: false,
      supportsAV1: true,
      supportsVP9: true,
      supportsH264: true,
      supportsHDR10: false,
      profiles: []
    });

    const report = await TVDiagnostics.analyzeServiceSession([rep4kHdr, rep1080p], rep1080p, mockDisplayHdr);

    expect(report.bottleneck).toBe('BROWSER_CAPABILITY');
    expect(report.bottleneckExplanation).toContain('cannot decode 2160p smoothly');
  });

  it('classifies HDR_CAPABILITY when stream has HDR10 but display is SDR', async () => {
    vi.spyOn(TVCapabilityEngine, 'probeDecoderCapabilities').mockResolvedValue({
      supports2160p: true,
      supports1440p: true,
      supports1080p: true,
      supportsHEVC: true,
      supportsAV1: true,
      supportsVP9: true,
      supportsH264: true,
      supportsHDR10: true,
      profiles: []
    });

    const report = await TVDiagnostics.analyzeServiceSession([rep4kHdr, rep1080p], rep1080p, mockDisplaySdr);

    expect(report.bottleneck).toBe('HDR_CAPABILITY');
    expect(report.bottleneckExplanation).toContain('Standard Dynamic Range (SDR) only');
  });

  it('classifies PLAYER_SELECTION when optimal 4K HDR playback is running', async () => {
    vi.spyOn(TVCapabilityEngine, 'probeDecoderCapabilities').mockResolvedValue({
      supports2160p: true,
      supports1440p: true,
      supports1080p: true,
      supportsHEVC: true,
      supportsAV1: true,
      supportsVP9: true,
      supportsH264: true,
      supportsHDR10: true,
      profiles: []
    });

    const report = await TVDiagnostics.analyzeServiceSession([rep4kHdr, rep1080p], rep4kHdr, mockDisplayHdr);

    expect(report.bottleneck).toBe('PLAYER_SELECTION');
    expect(report.bottleneckExplanation).toContain('Optimal TV mode playback achieved');
  });
});
