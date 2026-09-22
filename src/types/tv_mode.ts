/**
 * TV Mode — UHD/HDR Playback Emulator
 * Comprehensive TypeScript Interfaces and Types
 */

export type DynamicRangeType = 'SDR' | 'HDR10' | 'HLG' | 'DolbyVision';
export type AdaptationStrategy = 'tv-balanced' | 'tv-quality' | 'tv-stability';
export type QualityTier = '2160p' | '1440p' | '1080p' | '720p' | '480p' | '360p';
export type VideoCodec = 'HEVC' | 'AV1' | 'VP9' | 'H264' | 'unknown';

export interface TVModeProfile {
  name?: string;
  preferredResolution: number; // 2160, 1440, 1080, etc.
  preferredDynamicRange: 'HDR' | 'SDR' | 'AUTO';
  preferredCodecs: VideoCodec[];
  preferHDR: boolean;
  prefer4K: boolean;
  targetFramerate: number; // 60, 30
  initialBitrateStrategy: 'conservative' | 'aggressive' | 'moderate';
  adaptationStrategy: AdaptationStrategy;
}

export interface DisplayCapability {
  width: number;
  height: number;
  devicePixelRatio: number;
  effectiveWidth: number;
  effectiveHeight: number;
  fullscreenSupport: boolean;
  colorGamut: 'srgb' | 'p3' | 'rec2020';
  displayHDR: boolean;
  maxRefreshRate?: number;
}

export interface CodecDecoderProfile {
  codec: VideoCodec;
  codecString: string;
  resolution: number; // e.g. 2160, 1080
  framerate: number;  // 60, 30
  bitDepth: 8 | 10;
  hdr: boolean;
  supported: boolean;
  smooth: boolean;
  powerEfficient: boolean;
}

export interface DecoderCapabilityReport {
  supports2160p: boolean;
  supports1440p: boolean;
  supports1080p: boolean;
  supportsHEVC: boolean;
  supportsAV1: boolean;
  supportsVP9: boolean;
  supportsH264: boolean;
  supportsHDR10: boolean;
  profiles: CodecDecoderProfile[];
}

export interface HdrStatusReport {
  displayHDR: boolean;
  contentHDR: boolean;
  selectedHDR: boolean;
  format: DynamicRangeType;
  colorGamut: string;
  transferFunction?: string;
  reason: string;
}

export interface MediaRepresentation {
  id: string;
  width: number;
  height: number;
  bitrate: number; // in bps
  codec: VideoCodec;
  codecString: string;
  framerate: number;
  hdr: boolean;
  dynamicRange: DynamicRangeType;
  bitDepth: 8 | 10;
  mimeType: string;
  colorSpace?: string;
  isDecodable?: boolean;
  decodeReason?: string;
}

export interface ABRParameters {
  startupBufferTarget: number;    // seconds (default: 8)
  rebufferThreshold: number;      // seconds (default: 3)
  upgradeThreshold: number;       // seconds (default: 12)
  downgradeThreshold: number;     // seconds (default: 4)
  qualityHoldTime: number;        // ms (default: 10000)
  bandwidthSafetyFactor: number;  // ratio (default: 0.75)
}

export interface TVABRState {
  currentRepresentation: MediaRepresentation | null;
  currentBufferSeconds: number;
  bandwidthEstimateBps: number;
  state: 'startup' | 'steady' | 'degrading' | 'recovering';
  timeSinceLastSwitchMs: number;
  rebufferCount: number;
  qualitySwitchesCount: number;
  reasons: string[];
}

export interface QualitySelectionResult {
  selected: MediaRepresentation | null;
  priorityRank: number;
  reason: string;
  candidatesConsidered: number;
  fallbackOccurred: boolean;
  bottleneck?: BottleneckCategory;
}

export type BottleneckCategory =
  | 'SERVICE_OFFER'
  | 'PLAYER_SELECTION'
  | 'BROWSER_CAPABILITY'
  | 'CODEC'
  | 'HDR_CAPABILITY'
  | 'OUTPUT'
  | 'BANDWIDTH'
  | 'UNKNOWN';

export interface ServiceAnalysisReport {
  serviceMaximumResolution: string;
  serviceMaximumHDR: string;
  representationsObserved: MediaRepresentation[];
  currentResolution: string;
  currentBitrateBps: number;
  currentCodec: string;
  browserCapability: {
    canDecode4K: boolean;
    canDecodeHDR: boolean;
    supportedCodecs: VideoCodec[];
  };
  displayCapability: DisplayCapability;
  bottleneck: BottleneckCategory;
  bottleneckExplanation: string;
}

export interface TVPlaybackMetrics {
  sessionStartTime: number;
  firstFrameTimeMs: number | null;
  firstUhdFrameTimeMs: number | null;
  totalPlaybackDurationSec: number;
  timeSpentAtQualitySec: Record<string, number>;
  timeSpentHDRSec: number;
  timeSpentSDRSec: number;
  droppedFramesCount: number;
  totalDecodedFramesCount: number;
  rebufferEventsCount: number;
  totalRebufferDurationSec: number;
  qualitySwitchesCount: number;
  currentBandwidthEstimateBps: number;
}
