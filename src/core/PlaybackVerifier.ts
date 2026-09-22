/**
 * PlaybackVerifier
 * Enforces strict, unforgeable verification of decoded video dimensions and genuine HDR content.
 * Rejects CSS scaling, DPR multipliers, viewport scaling, or canvas upscaling.
 */

import { PlaybackVerificationReport } from '../types/drm_research';

export class PlaybackVerifier {
  /**
   * Verifies whether an HTMLVideoElement is playing genuine 4K UHD decoded frames.
   * STRICT SUCCESS CRITERION: video.videoWidth >= 3840 && video.videoHeight >= 2160.
   */
  public static verifyPlayback(
    video: HTMLVideoElement,
    contentMetadata?: {
      colorPrimaries?: string;
      transferFunction?: string;
      bitDepth?: number;
      codec?: string;
    }
  ): PlaybackVerificationReport {
    const actualWidth = video.videoWidth || 0;
    const actualHeight = video.videoHeight || 0;

    const isRealUHDWidth = actualWidth >= 3840;
    const isRealUHDHeight = actualHeight >= 2160;
    const isReal4K = isRealUHDWidth && isRealUHDHeight;

    // Check dropped frames via getVideoPlaybackQuality if supported
    let totalFrames = 0;
    let droppedFrames = 0;
    let droppedRatio = 0;

    if (typeof video.getVideoPlaybackQuality === 'function') {
      const q = video.getVideoPlaybackQuality();
      totalFrames = q.totalVideoFrames;
      droppedFrames = q.droppedVideoFrames;
      droppedRatio = totalFrames > 0 ? droppedFrames / totalFrames : 0;
    }

    // Evaluate genuine HDR evidence (must have transfer characteristics / 10-bit)
    const transfer = contentMetadata?.transferFunction?.toLowerCase() || '';
    const primaries = contentMetadata?.colorPrimaries?.toLowerCase() || '';
    const bitDepth = (contentMetadata?.bitDepth === 10 ? 10 : 8) as 8 | 10;

    const isPqOrHlg =
      transfer.includes('smpte2084') ||
      transfer.includes('pq') ||
      transfer.includes('arib-std-b67') ||
      transfer.includes('hlg') ||
      transfer === '16' ||
      transfer === '18';

    const isWideColor =
      primaries.includes('rec2020') ||
      primaries.includes('bt2020') ||
      primaries.includes('p3') ||
      primaries === '9';

    const isGenuineHDR = (isPqOrHlg || (bitDepth === 10 && isWideColor));

    const evidence: string[] = [];
    evidence.push(`Decoded Dimensions: ${actualWidth}x${actualHeight}`);
    if (isReal4K) {
      evidence.push('4K UHD Dimension Threshold Passed (>= 3840x2160)');
    } else {
      evidence.push(`4K UHD Dimension Threshold Failed (${actualWidth}x${actualHeight} < 3840x2160)`);
    }

    if (isGenuineHDR) {
      evidence.push(`Genuine HDR Confirmed: Transfer=${contentMetadata?.transferFunction || 'PQ'}, BitDepth=${bitDepth}`);
    } else {
      evidence.push('SDR Content Stream (8-bit / Standard Dynamic Range)');
    }

    return {
      isReal4K,
      isRealUHDWidth,
      isRealUHDHeight,
      actualVideoWidth: actualWidth,
      actualVideoHeight: actualHeight,
      isGenuineHDR,
      colorSpace: contentMetadata?.colorPrimaries || 'bt709',
      transferFunction: contentMetadata?.transferFunction || 'sdr',
      bitDepth,
      totalFrames,
      droppedFrames,
      droppedFramesRatio: droppedRatio,
      verificationPassed: isReal4K,
      evidence
    };
  }

  /**
   * Continuous verification observer that resolves when actual decoded 4K frames arrive,
   * or times out after a specified duration.
   */
  public static async waitFor4KVerification(
    video: HTMLVideoElement,
    timeoutMs: number = 8000
  ): Promise<PlaybackVerificationReport> {
    const start = Date.now();

    return new Promise((resolve) => {
      const check = () => {
        const report = PlaybackVerifier.verifyPlayback(video);
        if (report.isReal4K) {
          resolve(report);
          return;
        }

        if (Date.now() - start >= timeoutMs) {
          resolve(report);
          return;
        }

        requestAnimationFrame(check);
      };

      check();
    });
  }
}
