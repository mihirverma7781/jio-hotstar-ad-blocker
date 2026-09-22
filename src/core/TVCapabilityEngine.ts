/**
 * TVCapabilityEngine
 * Probes browser and hardware media decoding capabilities and display parameters.
 * Uses navigator.mediaCapabilities.decodingInfo() without falsifying capabilities.
 */

import {
  DisplayCapability,
  DecoderCapabilityReport,
  CodecDecoderProfile,
  VideoCodec
} from '../types/tv_mode';

export class TVCapabilityEngine {
  private static cachedDisplay: DisplayCapability | null = null;
  private static cachedDecoderReport: DecoderCapabilityReport | null = null;

  /**
   * Probes the current display properties, pixel ratio, wide color gamut, and HDR queries.
   */
  public static getDisplayCapability(): DisplayCapability {
    if (this.cachedDisplay) {
      return this.cachedDisplay;
    }

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const screenWidth = typeof screen !== 'undefined' ? screen.width : 1920;
    const screenHeight = typeof screen !== 'undefined' ? screen.height : 1080;

    let colorGamut: 'srgb' | 'p3' | 'rec2020' = 'srgb';
    let displayHDR = false;

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        if (window.matchMedia('(color-gamut: rec2020)').matches) {
          colorGamut = 'rec2020';
        } else if (window.matchMedia('(color-gamut: p3)').matches) {
          colorGamut = 'p3';
        }

        // Standard W3C dynamic-range media queries
        displayHDR =
          window.matchMedia('(dynamic-range: high)').matches ||
          window.matchMedia('(video-dynamic-range: high)').matches ||
          window.matchMedia('(-webkit-video-dynamic-range: high)').matches;
      } catch (e) {
        // Fallback gracefully on query syntax error
      }
    }

    const fullscreenSupport =
      typeof document !== 'undefined' &&
      Boolean(
        document.fullscreenEnabled ||
        (document as any).webkitFullscreenEnabled
      );

    this.cachedDisplay = {
      width: screenWidth,
      height: screenHeight,
      devicePixelRatio: dpr,
      effectiveWidth: Math.round(screenWidth * dpr),
      effectiveHeight: Math.round(screenHeight * dpr),
      fullscreenSupport,
      colorGamut,
      displayHDR
    };

    return this.cachedDisplay;
  }

  /**
   * Tests decodability of common TV streaming profiles across H.264, HEVC, VP9, AV1.
   * Probes 1080p, 1440p, 2160p (4K), 8-bit, and 10-bit HDR.
   */
  public static async probeDecoderCapabilities(forceRefresh = false): Promise<DecoderCapabilityReport> {
    if (this.cachedDecoderReport && !forceRefresh) {
      return this.cachedDecoderReport;
    }

    const testConfigurations: Array<{
      codec: VideoCodec;
      codecString: string;
      resolution: number;
      framerate: number;
      bitDepth: 8 | 10;
      hdr: boolean;
      contentType: string;
    }> = [
      // H.264 (AVC)
      { codec: 'H264', codecString: 'avc1.640028', resolution: 1080, framerate: 60, bitDepth: 8, hdr: false, contentType: 'video/mp4; codecs="avc1.640028"' },
      { codec: 'H264', codecString: 'avc1.640033', resolution: 2160, framerate: 30, bitDepth: 8, hdr: false, contentType: 'video/mp4; codecs="avc1.640033"' },

      // VP9 Profile 0 (8-bit SDR) & Profile 2 (10-bit HDR10)
      { codec: 'VP9', codecString: 'vp09.00.41.08', resolution: 1080, framerate: 60, bitDepth: 8, hdr: false, contentType: 'video/webm; codecs="vp09.00.41.08"' },
      { codec: 'VP9', codecString: 'vp09.00.51.08', resolution: 2160, framerate: 60, bitDepth: 8, hdr: false, contentType: 'video/webm; codecs="vp09.00.51.08"' },
      { codec: 'VP9', codecString: 'vp09.02.51.10.01.09.16.09.00', resolution: 2160, framerate: 60, bitDepth: 10, hdr: true, contentType: 'video/webm; codecs="vp09.02.51.10.01.09.16.09.00"' },

      // AV1 Main Profile (8-bit and 10-bit)
      { codec: 'AV1', codecString: 'av01.0.08M.08', resolution: 1080, framerate: 60, bitDepth: 8, hdr: false, contentType: 'video/mp4; codecs="av01.0.08M.08"' },
      { codec: 'AV1', codecString: 'av01.0.12M.08', resolution: 2160, framerate: 60, bitDepth: 8, hdr: false, contentType: 'video/mp4; codecs="av01.0.12M.08"' },
      { codec: 'AV1', codecString: 'av01.0.12M.10.0.110.09.16.09.0', resolution: 2160, framerate: 60, bitDepth: 10, hdr: true, contentType: 'video/mp4; codecs="av01.0.12M.10.0.110.09.16.09.0"' },

      // HEVC (H.265) Main & Main 10 (Supported on macOS Safari & hardware-enabled Chrome on Mac/Win)
      { codec: 'HEVC', codecString: 'hvc1.1.6.L120.90', resolution: 1080, framerate: 60, bitDepth: 8, hdr: false, contentType: 'video/mp4; codecs="hvc1.1.6.L120.90"' },
      { codec: 'HEVC', codecString: 'hvc1.1.6.L150.90', resolution: 2160, framerate: 60, bitDepth: 8, hdr: false, contentType: 'video/mp4; codecs="hvc1.1.6.L150.90"' },
      { codec: 'HEVC', codecString: 'hvc1.2.4.L150.B0', resolution: 2160, framerate: 60, bitDepth: 10, hdr: true, contentType: 'video/mp4; codecs="hvc1.2.4.L150.B0"' }
    ];

    const profiles: CodecDecoderProfile[] = [];

    for (const cfg of testConfigurations) {
      let supported = false;
      let smooth = false;
      let powerEfficient = false;

      // Primary: navigator.mediaCapabilities.decodingInfo
      if (
        typeof navigator !== 'undefined' &&
        navigator.mediaCapabilities &&
        typeof navigator.mediaCapabilities.decodingInfo === 'function'
      ) {
        try {
          const width = cfg.resolution === 2160 ? 3840 : cfg.resolution === 1440 ? 2560 : 1920;
          const height = cfg.resolution;
          const bitrate = cfg.resolution === 2160 ? 18_000_000 : cfg.resolution === 1440 ? 10_000_000 : 5_000_000;

          const res = await navigator.mediaCapabilities.decodingInfo({
            type: 'media-source',
            video: {
              contentType: cfg.contentType,
              width,
              height,
              bitrate,
              framerate: cfg.framerate
            }
          });

          supported = res.supported;
          smooth = res.smooth;
          powerEfficient = res.powerEfficient;
        } catch {
          // Fall back to MediaSource.isTypeSupported
          supported = this.fallbackIsTypeSupported(cfg.contentType);
          smooth = supported;
        }
      } else {
        supported = this.fallbackIsTypeSupported(cfg.contentType);
        smooth = supported;
      }

      profiles.push({
        codec: cfg.codec,
        codecString: cfg.codecString,
        resolution: cfg.resolution,
        framerate: cfg.framerate,
        bitDepth: cfg.bitDepth,
        hdr: cfg.hdr,
        supported,
        smooth,
        powerEfficient
      });
    }

    const supports2160p = profiles.some(p => p.resolution === 2160 && p.supported);
    const supports1440p = supports2160p || profiles.some(p => p.resolution === 1440 && p.supported);
    const supports1080p = profiles.some(p => p.resolution === 1080 && p.supported);
    const supportsHEVC = profiles.some(p => p.codec === 'HEVC' && p.supported);
    const supportsAV1 = profiles.some(p => p.codec === 'AV1' && p.supported);
    const supportsVP9 = profiles.some(p => p.codec === 'VP9' && p.supported);
    const supportsH264 = profiles.some(p => p.codec === 'H264' && p.supported);
    const supportsHDR10 = profiles.some(p => p.hdr && p.supported);

    this.cachedDecoderReport = {
      supports2160p,
      supports1440p,
      supports1080p,
      supportsHEVC,
      supportsAV1,
      supportsVP9,
      supportsH264,
      supportsHDR10,
      profiles
    };

    return this.cachedDecoderReport;
  }

  /**
   * Safe fallback using HTMLMediaElement or MediaSource.isTypeSupported
   */
  private static fallbackIsTypeSupported(mime: string): boolean {
    if (typeof MediaSource !== 'undefined' && typeof MediaSource.isTypeSupported === 'function') {
      return MediaSource.isTypeSupported(mime);
    }
    if (typeof document !== 'undefined') {
      const v = document.createElement('video');
      const can = v.canPlayType(mime);
      return can === 'probably' || can === 'maybe';
    }
    return false;
  }

  /**
   * Checks whether a specific media representation is decodable by the browser
   */
  public static async isRepresentationDecodable(
    width: number,
    height: number,
    mimeType: string,
    framerate = 60,
    bitrate = 15_000_000
  ): Promise<{ supported: boolean; smooth: boolean; reason: string }> {
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaCapabilities &&
      typeof navigator.mediaCapabilities.decodingInfo === 'function'
    ) {
      try {
        const info = await navigator.mediaCapabilities.decodingInfo({
          type: 'media-source',
          video: {
            contentType: mimeType,
            width,
            height,
            bitrate,
            framerate
          }
        });

        if (!info.supported) {
          return { supported: false, smooth: false, reason: `Browser cannot decode format: ${mimeType}` };
        }
        return {
          supported: true,
          smooth: info.smooth,
          reason: info.smooth ? 'Hardware/smooth decode supported' : 'Decodable with potential frame drops'
        };
      } catch (err: any) {
        // Fallback check
        const supported = this.fallbackIsTypeSupported(mimeType);
        return {
          supported,
          smooth: supported,
          reason: supported ? 'MediaSource reports supported' : 'Unsupported mime/codec'
        };
      }
    }

    const supported = this.fallbackIsTypeSupported(mimeType);
    return { supported, smooth: supported, reason: supported ? 'Fallback supported' : 'Unsupported mime' };
  }

  /**
   * Clears in-memory capability cache
   */
  public static clearCache(): void {
    this.cachedDisplay = null;
    this.cachedDecoderReport = null;
  }
}
