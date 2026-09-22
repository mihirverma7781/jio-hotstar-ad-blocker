import { describe, it, expect, beforeEach } from 'vitest';
import { PrimeRepresentationProbe } from '../../src/prime/PrimeRepresentationProbe';
import { PrimeObservedTrack } from '../../src/types/drm_research';

describe('PrimeRepresentationProbe Unit Tests', () => {
  let probe: PrimeRepresentationProbe;

  beforeEach(() => {
    probe = new PrimeRepresentationProbe();
  });

  it('correctly reports UHD_REPRESENTATION: NOT_FOUND when session only receives up to 1080p', () => {
    // Typical Amazon Prime Video desktop browser manifest representations
    const desktopTracks: PrimeObservedTrack[] = [
      { id: 'track-1080p', width: 1920, height: 1080, bitrate: 5800000, codec: 'avc1.640028', framerate: 30, hdr: false },
      { id: 'track-720p', width: 1280, height: 720, bitrate: 2800000, codec: 'avc1.4d401f', framerate: 30, hdr: false },
      { id: 'track-480p', width: 854, height: 480, bitrate: 1200000, codec: 'avc1.4d401e', framerate: 30, hdr: false }
    ];

    for (const t of desktopTracks) {
      probe.registerTrack(t);
    }

    expect(probe.getUhdRepresentationStatus()).toBe('NOT_FOUND');
    expect(probe.getHdrUhdRepresentationStatus()).toBe('NOT_FOUND');
    expect(probe.getMaxObservedRepresentation()?.height).toBe(1080);
    expect(probe.getObservedLadderSummary()).toEqual(['1080p', '720p', '480p']);
  });

  it('correctly reports UHD_REPRESENTATION: FOUND when 4K track is delivered in session', () => {
    const uhdTracks: PrimeObservedTrack[] = [
      { id: 'track-4k-hdr', width: 3840, height: 2160, bitrate: 18500000, codec: 'hvc1.2.4.L150.B0', framerate: 60, hdr: true, bitDepth: 10 },
      { id: 'track-1080p', width: 1920, height: 1080, bitrate: 5500000, codec: 'avc1.640028', framerate: 30, hdr: false }
    ];

    for (const t of uhdTracks) {
      probe.registerTrack(t);
    }

    expect(probe.getUhdRepresentationStatus()).toBe('FOUND');
    expect(probe.getHdrUhdRepresentationStatus()).toBe('FOUND');
    expect(probe.getMaxObservedRepresentation()?.height).toBe(2160);
    expect(probe.getObservedLadderSummary()).toEqual(['2160p HDR', '1080p']);
  });

  it('handles bridge postMessage payload processing correctly', () => {
    probe.processBridgePayload({
      type: 'PV_MEDIA_PROBE_EVENT',
      action: 'MANIFEST_LOADED',
      manifestUrl: 'https://playback.us-east-1.pv-cdn.net/manifest.mpd',
      manifestType: 'DASH',
      observedRepresentations: [
        { id: 'rep-1', width: 1920, height: 1080, bitrate: 6000000, codec: 'vp09.00.41.08', framerate: 30, hdr: false }
      ]
    });

    expect(probe.getLastManifestUrl()).toContain('pv-cdn.net');
    expect(probe.getMaxObservedRepresentation()?.id).toBe('rep-1');
    expect(probe.getUhdRepresentationStatus()).toBe('NOT_FOUND');
  });
});
