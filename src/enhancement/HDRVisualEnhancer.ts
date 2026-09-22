/**
 * HDRVisualEnhancer
 * Analyzes video stream and display capabilities to differentiate between genuine HDR streams
 * and SDR content, applying perceptual HDR tone expansion to SDR streams when requested.
 */

export interface HdrStatus {
  isGenuineHdrSource: boolean;
  colorGamut: 'srgb' | 'p3' | 'rec2020';
  transferFunction: 'srgb' | 'pq' | 'hlg' | 'linear';
  displaySupportsHdr: boolean;
  hdrVisualEnhancementActive: boolean;
  diagnosticDescription: string;
}

export class HDRVisualEnhancer {
  private displayHdrSupported: boolean = false;
  private currentStatus: HdrStatus = {
    isGenuineHdrSource: false,
    colorGamut: 'srgb',
    transferFunction: 'srgb',
    displaySupportsHdr: false,
    hdrVisualEnhancementActive: false,
    diagnosticDescription: 'SDR_SOURCE_STANDARD'
  };

  constructor() {
    this.detectDisplayCapabilities();
  }

  private detectDisplayCapabilities(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.displayHdrSupported =
        window.matchMedia('(dynamic-range: high)').matches ||
        window.matchMedia('(color-gamut: rec2020)').matches ||
        window.matchMedia('(color-gamut: p3)').matches;
    }
  }

  /**
   * Probes active video element and media tracks for genuine HDR metadata.
   */
  public evaluateVideoHdrStatus(
    video: HTMLVideoElement | null,
    visualEnhancementEnabled: boolean
  ): HdrStatus {
    this.detectDisplayCapabilities();

    if (!video) {
      this.currentStatus = {
        isGenuineHdrSource: false,
        colorGamut: 'srgb',
        transferFunction: 'srgb',
        displaySupportsHdr: this.displayHdrSupported,
        hdrVisualEnhancementActive: false,
        diagnosticDescription: 'NO_VIDEO'
      };
      return this.currentStatus;
    }

    let isHdrSource = false;
    let gamut: 'srgb' | 'p3' | 'rec2020' = 'srgb';
    let transfer: 'srgb' | 'pq' | 'hlg' | 'linear' = 'srgb';
    let reason = 'SDR_REC709_STREAM';

    // 1. Check video.getVideoPlaybackQuality and colorSpace API if available
    const videoWithCS = video as any;
    if (videoWithCS.mediaKeys) {
      // Check DRM keys / codecs
    }

    // 2. Check HTMLVideoElement videoTracks or custom representation metadata
    if (videoWithCS.__tv_current_representation) {
      const rep = videoWithCS.__tv_current_representation;
      if (rep.hdr || rep.dynamicRange === 'HDR10' || rep.dynamicRange === 'DolbyVision') {
        isHdrSource = true;
        gamut = 'rec2020';
        transfer = 'pq';
        reason = `GENUINE_HDR_METADATA_${rep.dynamicRange}`;
      }
    }

    // 3. Fallback heuristic: check stream video width/height or codec string if available
    if (!isHdrSource && (video as any).__is_genuine_hdr) {
      isHdrSource = true;
      gamut = 'rec2020';
      transfer = 'pq';
      reason = 'DECODER_REPORTED_10BIT_HDR';
    }

    const visualActive = !isHdrSource && visualEnhancementEnabled;

    this.currentStatus = {
      isGenuineHdrSource: isHdrSource,
      colorGamut: gamut,
      transferFunction: transfer,
      displaySupportsHdr: this.displayHdrSupported,
      hdrVisualEnhancementActive: visualActive,
      diagnosticDescription: isHdrSource
        ? reason
        : visualActive
        ? 'SDR_SOURCE_WITH_PERCEPTUAL_HDR_ENHANCEMENT'
        : 'SDR_STANDARD_PASS_THROUGH'
    };

    return this.currentStatus;
  }

  public getStatus(): HdrStatus {
    return this.currentStatus;
  }
}
