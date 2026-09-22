/**
 * TVQualitySelector
 * Selects the optimal media representation based on TV priority hierarchy
 * and authentic browser/display capabilities.
 */

import {
  DisplayCapability,
  MediaRepresentation,
  QualitySelectionResult,
  TVModeProfile
} from '../types/tv_mode';
import { TVCapabilityEngine } from './TVCapabilityEngine';

export class TVQualitySelector {
  /**
   * Evaluates and selects the highest ranked representation capable of being decoded smoothly.
   */
  public static async selectBestRepresentation(
    availableRepresentations: MediaRepresentation[],
    profile: TVModeProfile,
    displayOverride?: DisplayCapability
  ): Promise<QualitySelectionResult> {
    if (!availableRepresentations || availableRepresentations.length === 0) {
      return {
        selected: null,
        priorityRank: -1,
        reason: 'No representations available in media stream.',
        candidatesConsidered: 0,
        fallbackOccurred: false,
        bottleneck: 'SERVICE_OFFER'
      };
    }

    const display = displayOverride || TVCapabilityEngine.getDisplayCapability();
    const decoderReport = await TVCapabilityEngine.probeDecoderCapabilities();

    // Group and sort candidates according to TV Mode Priority
    const rankedCandidates = this.rankRepresentations(availableRepresentations, profile, display);

    let candidatesChecked = 0;

    for (let i = 0; i < rankedCandidates.length; i++) {
      candidatesChecked++;
      const rep = rankedCandidates[i];

      // 1. Decoder capability verification
      const decodability = await TVCapabilityEngine.isRepresentationDecodable(
        rep.width,
        rep.height,
        rep.mimeType,
        rep.framerate,
        rep.bitrate
      );

      if (!decodability.supported) {
        continue;
      }

      // 2. HDR Capability check
      if (rep.hdr && !display.displayHDR && profile.preferHDR) {
        // Display cannot render HDR, continue to next candidate unless no SDR available
        if (rankedCandidates.some(c => !c.hdr && c.height >= rep.height)) {
          continue;
        }
      }

      // 3. Codec preference matching
      if (profile.preferredCodecs && profile.preferredCodecs.length > 0) {
        const codecIndex = profile.preferredCodecs.indexOf(rep.codec);
        // If rep codec is not preferred and an alternative exists at same resolution, prioritize preferred
        if (codecIndex === -1 && rankedCandidates.some(c => c.height === rep.height && profile.preferredCodecs.includes(c.codec))) {
          continue;
        }
      }

      // Candidate verified!
      const fallbackOccurred = i > 0;
      let reason = `Selected ${rep.height}p ${rep.dynamicRange} (${rep.codec} @ ${Math.round(rep.bitrate / 1000)} kbps).`;
      if (fallbackOccurred) {
        reason += ` Fallback from higher tier due to browser/display capability limits.`;
      }

      return {
        selected: rep,
        priorityRank: i + 1,
        reason,
        candidatesConsidered: candidatesChecked,
        fallbackOccurred
      };
    }

    // Ultimate fallback to first available if all strict capability checks failed
    const fallbackRep = availableRepresentations[availableRepresentations.length - 1] || null;
    return {
      selected: fallbackRep,
      priorityRank: rankedCandidates.length + 1,
      reason: 'Strict capability checks exhausted; using baseline fallback stream.',
      candidatesConsidered: candidatesChecked,
      fallbackOccurred: true,
      bottleneck: 'BROWSER_CAPABILITY'
    };
  }

  /**
   * Ranks representations according to TV Mode priority hierarchy:
   * 1. 2160p HDR
   * 2. 2160p SDR
   * 3. 1440p HDR
   * 4. 1440p SDR
   * 5. 1080p HDR
   * 6. 1080p SDR
   * 7. Lower tiers (<1080p)
   */
  public static rankRepresentations(
    reps: MediaRepresentation[],
    profile: TVModeProfile,
    display: DisplayCapability
  ): MediaRepresentation[] {
    return [...reps].sort((a, b) => {
      // Respect max user preferred resolution ceiling
      const aAbovePref = a.height > profile.preferredResolution ? 1 : 0;
      const bAbovePref = b.height > profile.preferredResolution ? 1 : 0;
      if (aAbovePref !== bAbovePref) {
        return aAbovePref - bAbovePref;
      }

      // Resolution hierarchy
      const aTier = Math.min(a.height, profile.preferredResolution);
      const bTier = Math.min(b.height, profile.preferredResolution);
      if (bTier !== aTier) {
        return bTier - aTier; // Higher resolution first
      }

      // HDR hierarchy (prioritize HDR if preferHDR is true AND display is HDR capable; otherwise prioritize SDR if preferHDR is false)
      if (profile.preferHDR && display.displayHDR && profile.preferredDynamicRange !== 'SDR') {
        if (a.hdr !== b.hdr) return a.hdr ? -1 : 1;
      } else if (!profile.preferHDR || profile.preferredDynamicRange === 'SDR' || !display.displayHDR) {
        if (a.hdr !== b.hdr) return a.hdr ? 1 : -1; // SDR first
      }

      // Codec priority hierarchy
      if (profile.preferredCodecs && profile.preferredCodecs.length > 0) {
        const aIdx = profile.preferredCodecs.indexOf(a.codec);
        const bIdx = profile.preferredCodecs.indexOf(b.codec);
        const aScore = aIdx === -1 ? 999 : aIdx;
        const bScore = bIdx === -1 ? 999 : bIdx;
        if (aScore !== bScore) {
          return aScore - bScore;
        }
      }

      // Framerate priority (60fps over 30fps)
      if (b.framerate !== a.framerate) {
        return b.framerate - a.framerate;
      }

      // Bitrate (higher bitrate within same resolution tier for maximum fidelity)
      return b.bitrate - a.bitrate;
    });
  }
}
