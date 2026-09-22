import { describe, it, expect } from 'vitest';
import { TVHdrEngine } from '../../src/core/TVHdrEngine';
import { DisplayCapability, MediaRepresentation } from '../../src/types/tv_mode';

describe('TVHdrEngine', () => {
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

  const mockHdrRep: MediaRepresentation = {
    id: 'rep-4k-hdr',
    width: 3840,
    height: 2160,
    bitrate: 18000000,
    codec: 'HEVC',
    codecString: 'hvc1.2.4.L150.B0',
    framerate: 60,
    hdr: true,
    dynamicRange: 'HDR10',
    bitDepth: 10,
    mimeType: 'video/mp4; codecs="hvc1.2.4.L150.B0"'
  };

  const mockSdrRep: MediaRepresentation = {
    id: 'rep-1080p-sdr',
    width: 1920,
    height: 1080,
    bitrate: 5500000,
    codec: 'H264',
    codecString: 'avc1.640028',
    framerate: 60,
    hdr: false,
    dynamicRange: 'SDR',
    bitDepth: 8,
    mimeType: 'video/mp4; codecs="avc1.640028"'
  };

  it('correctly reports displayHDR=true, contentHDR=true, selectedHDR=true when playing HDR on HDR display', () => {
    const report = TVHdrEngine.evaluateHdr([mockHdrRep, mockSdrRep], mockHdrRep, mockDisplayHdr);

    expect(report.displayHDR).toBe(true);
    expect(report.contentHDR).toBe(true);
    expect(report.selectedHDR).toBe(true);
    expect(report.format).toBe('HDR10');
  });

  it('correctly reports fallback when content offers HDR but display is SDR only', () => {
    const report = TVHdrEngine.evaluateHdr([mockHdrRep, mockSdrRep], mockSdrRep, mockDisplaySdr);

    expect(report.displayHDR).toBe(false);
    expect(report.contentHDR).toBe(true);
    expect(report.selectedHDR).toBe(false);
    expect(report.reason).toContain('fallback to SDR');
  });

  it('never infers HDR when stream has SDR representations only', () => {
    const report = TVHdrEngine.evaluateHdr([mockSdrRep], mockSdrRep, mockDisplayHdr);

    expect(report.contentHDR).toBe(false);
    expect(report.selectedHDR).toBe(false);
    expect(report.format).toBe('SDR');
  });
});
