import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrimeQualityController } from '../../src/prime/PrimeQualityController';
import { TVCapabilityEngine } from '../../src/core/TVCapabilityEngine';

describe('PrimeQualityController Unit Tests', () => {
  let controller: PrimeQualityController;

  beforeEach(() => {
    vi.restoreAllMocks();
    controller = new PrimeQualityController();
  });

  it('correctly reports UHD_NOT_DELIVERED_TO_WEB_SESSION when no 4K track is present in manifest', async () => {
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

    const mockVideo = {
      videoWidth: 1920,
      videoHeight: 1080
    } as unknown as HTMLVideoElement;

    vi.spyOn(controller.getAdapter(), 'getVideoElement').mockReturnValue(mockVideo);

    // Register typical desktop tracks (capped at 1080p)
    controller.getProbe().registerTrack({
      id: 'pv-1080p',
      width: 1920,
      height: 1080,
      bitrate: 5800000,
      codec: 'avc1.640028'
    });

    const result = await controller.evaluateAndVerify();

    expect(result.currentDecoded).toBe('1920 × 1080');
    expect(result.uhdRepresentation).toBe('NOT_FOUND');
    expect(result.finalStatus).toBe('UHD_NOT_DELIVERED_TO_WEB_SESSION');
    expect(result.playerUhdSelection).toBe('NOT_APPLICABLE');
    expect(result.exactReason).toContain('Amazon Playback Service (GetPlaybackResources) withholds 4K/UHD streams');
  });

  it('selects 4K track and verifies genuine 4K decoded video when 4K track IS present', async () => {
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

    // Mock video element that actually plays at 3840x2160
    const mockVideo = {
      videoWidth: 3840,
      videoHeight: 2160
    } as unknown as HTMLVideoElement;

    vi.spyOn(controller.getAdapter(), 'getVideoElement').mockReturnValue(mockVideo);
    const selectTrackSpy = vi.spyOn(controller.getAdapter(), 'selectTrack');

    // Register 4K track
    controller.getProbe().registerTrack({
      id: 'pv-4k-hdr',
      width: 3840,
      height: 2160,
      bitrate: 18500000,
      codec: 'hvc1.2.4.L150.B0',
      hdr: true,
      bitDepth: 10
    });

    const result = await controller.evaluateAndVerify();

    expect(selectTrackSpy).toHaveBeenCalledWith('pv-4k-hdr');
    expect(result.currentDecoded).toBe('3840 × 2160');
    expect(result.uhdRepresentation).toBe('FOUND');
    expect(result.playerUhdSelection).toBe('PASS');
    expect(result.finalStatus).toBe('2160p HDR ACTIVE');
  });

  it('reports PLAYER_REJECTED_UHD if 4K track exists but video dimensions remain at 1080p', async () => {
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

    // Mock video element whose decoded output remains at 1080p
    const mockVideo = {
      videoWidth: 1920,
      videoHeight: 1080
    } as unknown as HTMLVideoElement;

    vi.spyOn(controller.getAdapter(), 'getVideoElement').mockReturnValue(mockVideo);

    controller.getProbe().registerTrack({
      id: 'pv-4k-sdr',
      width: 3840,
      height: 2160,
      bitrate: 14000000,
      codec: 'av01.0.12M.08',
      hdr: false
    });

    const result = await controller.evaluateAndVerify();

    expect(result.uhdRepresentation).toBe('FOUND');
    expect(result.playerUhdSelection).toBe('FAIL');
    expect(result.finalStatus).toBe('PLAYER_REJECTED_UHD');
    expect(result.exactReason).toContain('video element decoded output remains at 1920x1080');
  });
});
