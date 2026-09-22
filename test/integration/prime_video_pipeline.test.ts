import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TVTestLab, TV_PRESET_PROFILES } from '../../src/lab/TVTestLab';
import { PrimeQualityController } from '../../src/prime/PrimeQualityController';
import { PlaybackVerifier } from '../../src/core/PlaybackVerifier';
import { TVCapabilityEngine } from '../../src/core/TVCapabilityEngine';

describe('Prime Video Real 4K Inspection & Control Experiment Pipeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // PHASE 13: CONTROL EXPERIMENT
  it('Phase 13 Control Experiment: achieves real 3840x2160 and genuine HDR10 on authorized test media', async () => {
    vi.spyOn(TVCapabilityEngine, 'getDisplayCapability').mockReturnValue({
      width: 3840,
      height: 2160,
      devicePixelRatio: 2,
      effectiveWidth: 3840,
      effectiveHeight: 2160,
      fullscreenSupport: true,
      colorGamut: 'rec2020',
      displayHDR: true
    });

    vi.spyOn(TVCapabilityEngine, 'isRepresentationDecodable').mockResolvedValue({
      supported: true,
      smooth: true,
      reason: 'Supported'
    });

    const lab = new TVTestLab();
    await lab.loadSampleManifest('4k-hdr-dash');
    await lab.applyProfile('tv-4k-hdr');

    // Simulate video element receiving real 4K decoded frames in local test lab
    const mockReal4kVideo = {
      videoWidth: 3840,
      videoHeight: 2160,
      getVideoPlaybackQuality: () => ({
        totalVideoFrames: 3600,
        droppedVideoFrames: 4,
        corruptedVideoFrames: 0,
        creationTime: 1000
      })
    } as unknown as HTMLVideoElement;

    const report = lab.verifyControlExperiment(mockReal4kVideo);

    expect(report.isReal4K).toBe(true);
    expect(report.actualVideoWidth).toBe(3840);
    expect(report.actualVideoHeight).toBe(2160);
    expect(report.isGenuineHDR).toBe(true);
    expect(report.verificationPassed).toBe(true);
    expect(report.evidence).toContain('4K UHD Dimension Threshold Passed (>= 3840x2160)');
  });

  // PHASES 1, 2, 8, 9, 11: PRIME VIDEO WEB PIPELINE INSPECTION
  it('Phase 2 & 9: Conclusively proves UHD_NOT_DELIVERED_TO_WEB_SESSION when Prime Video desktop manifest is capped at 1080p', async () => {
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

    const controller = new PrimeQualityController();

    // Mock real Prime Video video element playing at 1080p
    const primeVideoElement = {
      videoWidth: 1920,
      videoHeight: 1080
    } as unknown as HTMLVideoElement;

    vi.spyOn(controller.getAdapter(), 'getVideoElement').mockReturnValue(primeVideoElement);

    // Feed observed Prime Video desktop manifest representations
    controller.getProbe().processBridgePayload({
      type: 'PV_MEDIA_PROBE_EVENT',
      action: 'MANIFEST_LOADED',
      manifestUrl: 'https://atv-ps.amazon.com/cdp/catalog/GetPlaybackResources',
      manifestType: 'DASH',
      observedRepresentations: [
        { id: 'pv-video-1080p', width: 1920, height: 1080, bitrate: 5800000, codec: 'avc1.640028', framerate: 30, hdr: false },
        { id: 'pv-video-720p', width: 1280, height: 720, bitrate: 2800000, codec: 'avc1.4d401f', framerate: 30, hdr: false },
        { id: 'pv-video-480p', width: 854, height: 480, bitrate: 1200000, codec: 'avc1.4d401e', framerate: 30, hdr: false }
      ]
    });

    const panelData = await controller.evaluateAndVerify();

    // Verification guarantees
    expect(panelData.currentDecoded).toBe('1920 × 1080');
    expect(panelData.uhdRepresentation).toBe('NOT_FOUND');
    expect(panelData.uhdHdrRepresentation).toBe('NOT_FOUND');
    expect(panelData.representationsObserved).toEqual(['1080p', '720p', '480p']);
    expect(panelData.finalStatus).toBe('UHD_NOT_DELIVERED_TO_WEB_SESSION');
    expect(panelData.playerUhdSelection).toBe('NOT_APPLICABLE');

    // Strict verifier confirms 1080p is NOT 4K
    const verifyReport = PlaybackVerifier.verifyPlayback(primeVideoElement);
    expect(verifyReport.isReal4K).toBe(false);
    expect(verifyReport.verificationPassed).toBe(false);
  });
});
