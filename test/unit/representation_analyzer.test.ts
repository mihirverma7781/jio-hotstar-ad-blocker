import { describe, it, expect } from 'vitest';
import { TVRepresentationAnalyzer } from '../../src/core/TVRepresentationAnalyzer';
import {
  SAMPLE_4K_HDR_HLS_MANIFEST,
  SAMPLE_4K_HDR_DASH_MANIFEST,
  SAMPLE_1080P_ONLY_HLS_MANIFEST
} from '../../src/lab/sample_manifests';

describe('TVRepresentationAnalyzer', () => {
  it('parses HLS master playlist with 4K HDR, AV1, VP9, and H.264 streams', () => {
    const reps = TVRepresentationAnalyzer.parseHlsMasterPlaylist(SAMPLE_4K_HDR_HLS_MANIFEST);

    expect(reps.length).toBe(5);

    // First representation: 4K HDR10 HEVC
    const rep4kHdr = reps[0];
    expect(rep4kHdr.height).toBe(2160);
    expect(rep4kHdr.width).toBe(3840);
    expect(rep4kHdr.hdr).toBe(true);
    expect(rep4kHdr.dynamicRange).toBe('HDR10');
    expect(rep4kHdr.codec).toBe('HEVC');
    expect(rep4kHdr.bitDepth).toBe(10);
    expect(rep4kHdr.bitrate).toBe(18500000);

    // Second representation: 4K SDR AV1
    const rep4kAv1 = reps[1];
    expect(rep4kAv1.height).toBe(2160);
    expect(rep4kAv1.hdr).toBe(false);
    expect(rep4kAv1.codec).toBe('AV1');

    // Third representation: 1440p HDR VP9
    const rep1440p = reps[2];
    expect(rep1440p.height).toBe(1440);
    expect(rep1440p.hdr).toBe(true);
    expect(rep1440p.codec).toBe('VP9');

    // Fourth representation: 1080p SDR H264
    const rep1080p = reps[3];
    expect(rep1080p.height).toBe(1080);
    expect(rep1080p.hdr).toBe(false);
    expect(rep1080p.codec).toBe('H264');
  });

  it('parses DASH MPD XML with 4K HDR representation metadata', () => {
    const reps = TVRepresentationAnalyzer.parseDashMpd(SAMPLE_4K_HDR_DASH_MANIFEST);

    expect(reps.length).toBeGreaterThanOrEqual(4);
    const rep4k = reps.find(r => r.height === 2160);
    expect(rep4k).toBeDefined();
    expect(rep4k?.width).toBe(3840);
    expect(rep4k?.framerate).toBe(60);
  });

  it('accurately parses 1080p-only manifest without manufacturing 4K', () => {
    const reps = TVRepresentationAnalyzer.parseHlsMasterPlaylist(SAMPLE_1080P_ONLY_HLS_MANIFEST);

    const has4k = reps.some(r => r.height >= 2160);
    expect(has4k).toBe(false);

    const maxResolution = Math.max(...reps.map(r => r.height));
    expect(maxResolution).toBe(1080);
  });
});
