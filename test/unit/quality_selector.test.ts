import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TVQualitySelector } from '../../src/core/TVQualitySelector';
import { TVCapabilityEngine } from '../../src/core/TVCapabilityEngine';
import { DisplayCapability, MediaRepresentation, TVModeProfile } from '../../src/types/tv_mode';

describe('TVQualitySelector', () => {
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

  const sampleLadder: MediaRepresentation[] = [
    { id: '4k-hdr', width: 3840, height: 2160, bitrate: 18000000, codec: 'HEVC', codecString: 'hvc1', framerate: 60, hdr: true, dynamicRange: 'HDR10', bitDepth: 10, mimeType: 'video/mp4; codecs="hvc1"' },
    { id: '4k-sdr', width: 3840, height: 2160, bitrate: 14000000, codec: 'AV1', codecString: 'av01', framerate: 60, hdr: false, dynamicRange: 'SDR', bitDepth: 8, mimeType: 'video/mp4; codecs="av01"' },
    { id: '1440p-hdr', width: 2560, height: 1440, bitrate: 10000000, codec: 'VP9', codecString: 'vp09.02', framerate: 60, hdr: true, dynamicRange: 'HDR10', bitDepth: 10, mimeType: 'video/webm; codecs="vp09.02"' },
    { id: '1440p-sdr', width: 2560, height: 1440, bitrate: 8500000, codec: 'VP9', codecString: 'vp09.00', framerate: 60, hdr: false, dynamicRange: 'SDR', bitDepth: 8, mimeType: 'video/webm; codecs="vp09.00"' },
    { id: '1080p-hdr', width: 1920, height: 1080, bitrate: 6500000, codec: 'VP9', codecString: 'vp09.02', framerate: 60, hdr: true, dynamicRange: 'HDR10', bitDepth: 10, mimeType: 'video/webm; codecs="vp09.02"' },
    { id: '1080p-sdr', width: 1920, height: 1080, bitrate: 5000000, codec: 'H264', codecString: 'avc1', framerate: 60, hdr: false, dynamicRange: 'SDR', bitDepth: 8, mimeType: 'video/mp4; codecs="avc1"' }
  ];

  const defaultProfile: TVModeProfile = {
    preferredResolution: 2160,
    preferredDynamicRange: 'HDR',
    preferredCodecs: ['HEVC', 'AV1', 'VP9', 'H264'],
    preferHDR: true,
    prefer4K: true,
    targetFramerate: 60,
    initialBitrateStrategy: 'conservative',
    adaptationStrategy: 'tv-quality'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('ranks 2160p HDR > 2160p SDR > 1440p HDR > 1440p SDR > 1080p HDR > 1080p SDR', () => {
    const ranked = TVQualitySelector.rankRepresentations(sampleLadder, defaultProfile, mockDisplayHdr);
    expect(ranked[0].id).toBe('4k-hdr');
    expect(ranked[1].id).toBe('4k-sdr');
    expect(ranked[2].id).toBe('1440p-hdr');
    expect(ranked[3].id).toBe('1440p-sdr');
    expect(ranked[4].id).toBe('1080p-hdr');
    expect(ranked[5].id).toBe('1080p-sdr');
  });

  it('selects 2160p HDR when browser and display fully support it', async () => {
    vi.spyOn(TVCapabilityEngine, 'isRepresentationDecodable').mockResolvedValue({
      supported: true,
      smooth: true,
      reason: 'Hardware supported'
    });

    const result = await TVQualitySelector.selectBestRepresentation(sampleLadder, defaultProfile, mockDisplayHdr);
    expect(result.selected?.id).toBe('4k-hdr');
    expect(result.fallbackOccurred).toBe(false);
  });

  it('falls back to 4K SDR or 1440p when HEVC 4K HDR cannot be decoded', async () => {
    vi.spyOn(TVCapabilityEngine, 'isRepresentationDecodable').mockImplementation(async (_w, h, mime) => {
      if (mime.includes('hvc1')) {
        return { supported: false, smooth: false, reason: 'HEVC unsupported' };
      }
      return { supported: true, smooth: true, reason: 'Supported' };
    });

    const result = await TVQualitySelector.selectBestRepresentation(sampleLadder, defaultProfile, mockDisplayHdr);
    expect(result.selected?.id).toBe('4k-sdr');
    expect(result.selected?.codec).toBe('AV1');
    expect(result.fallbackOccurred).toBe(true);
  });

  it('respects user preferred resolution ceiling (e.g. 1080p cap)', () => {
    const profile1080p: TVModeProfile = {
      ...defaultProfile,
      preferredResolution: 1080
    };

    const ranked = TVQualitySelector.rankRepresentations(sampleLadder, profile1080p, mockDisplayHdr);
    expect(ranked[0].height).toBeLessThanOrEqual(1080);
    expect(ranked[0].id).toBe('1080p-hdr');
  });
});
