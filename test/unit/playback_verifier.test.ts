import { describe, it, expect } from 'vitest';
import { PlaybackVerifier } from '../../src/core/PlaybackVerifier';

describe('PlaybackVerifier Unit Tests', () => {
  it('strictly verifies genuine 4K decoded video when videoWidth >= 3840 and videoHeight >= 2160', () => {
    const mockVideo = {
      videoWidth: 3840,
      videoHeight: 2160,
      getVideoPlaybackQuality: () => ({
        totalVideoFrames: 1200,
        droppedVideoFrames: 2,
        corruptedVideoFrames: 0,
        creationTime: 1000
      })
    } as unknown as HTMLVideoElement;

    const report = PlaybackVerifier.verifyPlayback(mockVideo);

    expect(report.isReal4K).toBe(true);
    expect(report.isRealUHDWidth).toBe(true);
    expect(report.isRealUHDHeight).toBe(true);
    expect(report.actualVideoWidth).toBe(3840);
    expect(report.actualVideoHeight).toBe(2160);
    expect(report.verificationPassed).toBe(true);
    expect(report.droppedFrames).toBe(2);
  });

  it('strictly rejects 1080p playback as 4K', () => {
    const mockVideo = {
      videoWidth: 1920,
      videoHeight: 1080
    } as unknown as HTMLVideoElement;

    const report = PlaybackVerifier.verifyPlayback(mockVideo);

    expect(report.isReal4K).toBe(false);
    expect(report.verificationPassed).toBe(false);
    expect(report.evidence).toContain('4K UHD Dimension Threshold Failed (1920x1080 < 3840x2160)');
  });

  it('rejects 1440p (QHD) playback as 4K', () => {
    const mockVideo = {
      videoWidth: 2560,
      videoHeight: 1440
    } as unknown as HTMLVideoElement;

    const report = PlaybackVerifier.verifyPlayback(mockVideo);

    expect(report.isReal4K).toBe(false);
    expect(report.verificationPassed).toBe(false);
  });

  it('verifies genuine HDR evidence based on 10-bit depth and PQ/HLG transfer characteristics', () => {
    const mockVideo = {
      videoWidth: 3840,
      videoHeight: 2160
    } as unknown as HTMLVideoElement;

    const hdrReport = PlaybackVerifier.verifyPlayback(mockVideo, {
      bitDepth: 10,
      colorPrimaries: 'rec2020',
      transferFunction: 'smpte2084',
      codec: 'hvc1.2.4.L150.B0'
    });

    expect(hdrReport.isReal4K).toBe(true);
    expect(hdrReport.isGenuineHDR).toBe(true);
    expect(hdrReport.bitDepth).toBe(10);
  });

  it('correctly classifies standard dynamic range (SDR) content even if 4K resolution is met', () => {
    const mockVideo = {
      videoWidth: 3840,
      videoHeight: 2160
    } as unknown as HTMLVideoElement;

    const sdrReport = PlaybackVerifier.verifyPlayback(mockVideo, {
      bitDepth: 8,
      colorPrimaries: 'bt709',
      transferFunction: 'sdr',
      codec: 'av01.0.12M.08'
    });

    expect(sdrReport.isReal4K).toBe(true);
    expect(sdrReport.isGenuineHDR).toBe(false);
    expect(sdrReport.bitDepth).toBe(8);
  });
});
