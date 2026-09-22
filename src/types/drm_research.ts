/**
 * DRM & 4K HDR Research Environment & Prime Video Probe Interfaces
 */

import { MediaRepresentation, VideoCodec, DynamicRangeType } from './tv_mode';

export type UHDRepresentationStatus = 'FOUND' | 'NOT_FOUND';
export type EMECheckStatus = 'PASS' | 'FAIL' | 'NOT_TESTED';
export type HDCPCheckStatus = 'PASS' | 'FAIL' | 'OUTPUT_RESTRICTED' | 'OUTPUT_DOWNSCALED' | 'NOT_AVAILABLE';
export type DecoderCheckStatus = 'PASS' | 'FAIL';
export type PlayerSelectionStatus = 'PASS' | 'FAIL' | 'NOT_APPLICABLE';

export type PrimePlaybackCeiling =
  | '2160p HDR ACTIVE'
  | 'UHD ACTIVE'
  | 'UHD_NOT_DELIVERED_TO_WEB_SESSION'
  | 'PLAYER_REJECTED_UHD'
  | 'CODEC_UNSUPPORTED'
  | 'EME_CONFIGURATION_REJECTED'
  | 'OUTPUT_RESTRICTED'
  | 'HDCP_RESTRICTED'
  | 'HDR_UNSUPPORTED'
  | 'NETWORK_LIMIT'
  | 'REAL_UHD_ACTIVE'
  | 'REAL_HDR_UHD_ACTIVE'
  | 'UHD_PRESENT_BUT_NOT_SELECTED'
  | 'UNKNOWN';

export interface PlaybackVerificationReport {
  isReal4K: boolean;
  isRealUHDHeight: boolean;
  isRealUHDWidth: boolean;
  actualVideoWidth: number;
  actualVideoHeight: number;
  isGenuineHDR: boolean;
  colorSpace: string;
  transferFunction: string;
  bitDepth: 8 | 10;
  totalFrames: number;
  droppedFrames: number;
  droppedFramesRatio: number;
  verificationPassed: boolean;
  evidence: string[];
}

export interface PrimeObservedTrack {
  id: string;
  width: number;
  height: number;
  bitrate: number;
  codec: string;
  framerate?: number;
  hdr?: boolean;
  bitDepth?: 8 | 10;
  colorMetadata?: string;
  mimeType?: string;
}

export interface PrimeProbeEventPayload {
  type: 'PV_MEDIA_PROBE_EVENT';
  action:
    | 'MANIFEST_LOADED'
    | 'SOURCEBUFFER_INIT'
    | 'PLAYER_DETECTED'
    | 'PLAYBACK_SAMPLE'
    | 'PLAYBACK_RESOURCES_CAPTURED'
    | 'SDK_API_DEEP_SCAN'
    | 'SEGMENT_APPEND';
  manifestUrl?: string;
  manifestType?: 'DASH' | 'HLS' | 'SMOOTH' | 'UNKNOWN';
  observedRepresentations?: PrimeObservedTrack[];
  activeTrack?: PrimeObservedTrack;
  mimeType?: string;
  codecString?: string;
  playerEngine?: string;
  hasTrackSelectionApi?: boolean;
  selectionApiName?: string;
  currentTime?: number;
  videoWidth?: number;
  videoHeight?: number;
  // PLAYBACK_RESOURCES_CAPTURED fields
  requestUrl?: string;
  requestBody?: string;
  responseBody?: string;
  deviceTypeIdentifier?: string;
  maxResolutionFromResponse?: string;
  rawRepresentationsFromResponse?: any[];
  // SDK_API_DEEP_SCAN fields
  discoveredApis?: string[];
  // SEGMENT_APPEND fields
  boxType?: string;
  byteLength?: number;
}

export interface PrimeDebugPanelData {
  currentDecoded: string;        // e.g. "1920 × 1080"
  currentCodec: string;          // e.g. "H.264 (avc1.640028)"
  currentBitrate: string;        // e.g. "5.8 Mbps"
  currentHDR: string;            // e.g. "SDR (BT.709)"
  representationsObserved: string[]; // ["1080p", "720p", "480p"]
  uhdRepresentation: UHDRepresentationStatus;     // FOUND / NOT FOUND
  uhdHdrRepresentation: UHDRepresentationStatus;  // FOUND / NOT FOUND
  chromeDecoder: DecoderCheckStatus;             // PASS / FAIL
  eme: EMECheckStatus;                           // PASS / FAIL
  output: HDCPCheckStatus;                       // PASS / FAIL
  playerUhdSelection: PlayerSelectionStatus;     // PASS / FAIL / NOT APPLICABLE
  finalStatus: string;                           // "UHD_NOT_DELIVERED_TO_WEB_SESSION" or "2160p HDR"
  maxObservedRepresentation?: string;
  exactReason?: string;
  /** ABR controller tier: 'startup' | 'stable' | 'recovering' | 'degraded' */
  abrTier?: string;
  /** Last 20 ABR decisions from PrimeTVAbrController */
  abrDecisionLog?: any[];
  /** Evidence captured from GetPlaybackResources / SDK discovery */
  playbackResourcesInfo?: {
    deviceTypeIdentifier?: string;
    maxResolutionFromResponse?: string;
    discoveredSdkApis?: string[];
  };
}

