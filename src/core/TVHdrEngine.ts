/**
 * TVHdrEngine
 * Validates HDR capabilities across display, media content, and active decoding.
 * Strict rule: Never infer HDR without verifiable evidence from decoder capability and manifest tags.
 */

import {
  DisplayCapability,
  DynamicRangeType,
  HdrStatusReport,
  MediaRepresentation
} from '../types/tv_mode';
import { TVCapabilityEngine } from './TVCapabilityEngine';

export class TVHdrEngine {
  /**
   * Assesses HDR status by comparing display capabilities, content representations, and the active stream.
   */
  public static evaluateHdr(
    contentRepresentations: MediaRepresentation[],
    activeRepresentation: MediaRepresentation | null,
    displayOverride?: DisplayCapability
  ): HdrStatusReport {
    const display = displayOverride || TVCapabilityEngine.getDisplayCapability();

    // 1. DISPLAY_HDR: Physical or OS display capability
    const displayHDR = display.displayHDR;

    // 2. CONTENT_HDR: Does the stream offer legitimate HDR representations?
    const hdrRepresentations = contentRepresentations.filter(r => r.hdr);
    const contentHDR = hdrRepresentations.length > 0;

    // Detect format from representations (HDR10, HLG, Dolby Vision)
    let format: DynamicRangeType = 'SDR';
    if (contentHDR) {
      if (hdrRepresentations.some(r => r.dynamicRange === 'DolbyVision')) {
        format = 'DolbyVision';
      } else if (hdrRepresentations.some(r => r.dynamicRange === 'HLG')) {
        format = 'HLG';
      } else {
        format = 'HDR10';
      }
    }

    // 3. SELECTED_HDR: Is the currently active/selected representation HDR?
    const selectedHDR = Boolean(activeRepresentation && activeRepresentation.hdr);

    // Formulate verifiable reason
    let reason = 'Standard Dynamic Range (SDR) playback.';
    if (selectedHDR && displayHDR) {
      reason = `Active ${format} playback verified on HDR-capable display (${display.colorGamut}).`;
    } else if (contentHDR && !displayHDR) {
      reason = `Content offers ${format}, but display does not report High Dynamic Range support (fallback to SDR).`;
    } else if (contentHDR && displayHDR && !selectedHDR) {
      reason = `Content offers ${format} and display supports HDR, but player selected SDR (e.g. bandwidth or codec constraint).`;
    } else if (!contentHDR) {
      reason = 'No High Dynamic Range representations exposed by this media stream.';
    }

    return {
      displayHDR,
      contentHDR,
      selectedHDR,
      format: selectedHDR ? (activeRepresentation?.dynamicRange || format) : (contentHDR ? format : 'SDR'),
      colorGamut: display.colorGamut,
      transferFunction: selectedHDR ? (format === 'HLG' ? 'arib-std-b67' : 'smpte2084') : 'bt709',
      reason
    };
  }

  /**
   * Inspects a representation's codec string and metadata to determine dynamic range format.
   */
  public static detectDynamicRangeFromMetadata(
    codecString: string,
    colorSpace?: string,
    bitDepth?: number
  ): { hdr: boolean; dynamicRange: DynamicRangeType } {
    const lowerCodec = (codecString || '').toLowerCase();
    const lowerColor = (colorSpace || '').toLowerCase();

    // Dolby Vision (dvh1, dvhe, dav1)
    if (lowerCodec.startsWith('dvh') || lowerCodec.startsWith('dav1')) {
      return { hdr: true, dynamicRange: 'DolbyVision' };
    }

    // HDR10: HEVC Main 10 (hvc1.2 or hev1.2) or VP9 Profile 2 (vp09.02) or AV1 10-bit
    const is10Bit =
      bitDepth === 10 ||
      lowerCodec.includes('.10.') ||
      lowerCodec.includes('.02.') ||
      lowerCodec.startsWith('hvc1.2') ||
      lowerCodec.startsWith('hev1.2');

    const hasHdrColorSpace =
      lowerColor.includes('smpte2084') ||
      lowerColor.includes('rec2020') ||
      lowerColor.includes('bt2020') ||
      lowerColor.includes('pq');

    const hasHlgColorSpace = lowerColor.includes('arib-std-b67') || lowerColor.includes('hlg');

    if (hasHlgColorSpace) {
      return { hdr: true, dynamicRange: 'HLG' };
    }

    if (is10Bit && hasHdrColorSpace) {
      return { hdr: true, dynamicRange: 'HDR10' };
    }

    // VP9 profile 2 with explicit PQ transfer characteristics (.16.)
    if (lowerCodec.startsWith('vp09.02') && lowerCodec.includes('.16.')) {
      return { hdr: true, dynamicRange: 'HDR10' };
    }

    // AV1 with SMPTE 2084 transfer (.16.)
    if (lowerCodec.startsWith('av01') && lowerCodec.includes('.16.')) {
      return { hdr: true, dynamicRange: 'HDR10' };
    }

    return { hdr: false, dynamicRange: 'SDR' };
  }
}
