/**
 * TVRepresentationAnalyzer
 * Parses DASH MPD and HLS M3U8 manifests directly exposed to the player.
 * Extracts authentic video representations without fabricating non-existent tiers.
 */

import {
  DynamicRangeType,
  MediaRepresentation,
  VideoCodec
} from '../types/tv_mode';
import { TVHdrEngine } from './TVHdrEngine';

export class TVRepresentationAnalyzer {
  /**
   * Identifies the codec family from a codec MIME string (e.g. avc1.640028 -> H264)
   */
  public static mapCodecStringToFamily(codecStr: string): VideoCodec {
    const s = (codecStr || '').toLowerCase();
    if (s.startsWith('hvc') || s.startsWith('hev') || s.startsWith('dvh')) {
      return 'HEVC';
    }
    if (s.startsWith('av01') || s.startsWith('dav1')) {
      return 'AV1';
    }
    if (s.startsWith('vp09') || s.startsWith('vp9')) {
      return 'VP9';
    }
    if (s.startsWith('avc') || s.startsWith('mp4v')) {
      return 'H264';
    }
    return 'unknown';
  }

  /**
   * Parses an HLS Master Playlist (M3U8 string) for video stream representations.
   */
  public static parseHlsMasterPlaylist(m3u8Content: string): MediaRepresentation[] {
    const lines = m3u8Content.split(/\r?\n/);
    const representations: MediaRepresentation[] = [];

    let currentStreamInf: Record<string, string> | null = null;
    let index = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        currentStreamInf = this.parseTagAttributes(line.substring('#EXT-X-STREAM-INF:'.length));
      } else if (currentStreamInf && line && !line.startsWith('#')) {
        index++;
        const bandwidth = parseInt(currentStreamInf['BANDWIDTH'] || '0', 10);
        const resolutionStr = currentStreamInf['RESOLUTION'] || '';
        const codecsStr = currentStreamInf['CODECS'] || '';
        const frameRateStr = currentStreamInf['FRAME-RATE'] || '30';
        const videoRangeStr = (currentStreamInf['VIDEO-RANGE'] || 'SDR').toUpperCase();

        let width = 0;
        let height = 0;
        if (resolutionStr.includes('x')) {
          const parts = resolutionStr.split('x');
          width = parseInt(parts[0], 10);
          height = parseInt(parts[1], 10);
        }

        const framerate = parseFloat(frameRateStr) || 30;
        const codec = this.mapCodecStringToFamily(codecsStr);

        let dynamicRange: DynamicRangeType = 'SDR';
        let hdr = false;
        let bitDepth: 8 | 10 = 8;

        if (videoRangeStr === 'PQ') {
          dynamicRange = 'HDR10';
          hdr = true;
          bitDepth = 10;
        } else if (videoRangeStr === 'HLG') {
          dynamicRange = 'HLG';
          hdr = true;
          bitDepth = 10;
        } else {
          const detected = TVHdrEngine.detectDynamicRangeFromMetadata(codecsStr);
          hdr = detected.hdr;
          dynamicRange = detected.dynamicRange;
          if (hdr) bitDepth = 10;
        }

        const mimeType = codecsStr ? `video/mp4; codecs="${codecsStr}"` : 'video/mp4';

        representations.push({
          id: `hls-${index}-${height}p-${Math.round(bandwidth / 1000)}k`,
          width: width || (height ? Math.round(height * (16 / 9)) : 1920),
          height: height || 1080,
          bitrate: bandwidth,
          codec,
          codecString: codecsStr,
          framerate,
          hdr,
          dynamicRange,
          bitDepth,
          mimeType
        });

        currentStreamInf = null;
      }
    }

    return this.sortAndDeduplicate(representations);
  }

  /**
   * Parses DASH MPD XML string for video Representation elements.
   */
  public static parseDashMpd(mpdXml: string): MediaRepresentation[] {
    const representations: MediaRepresentation[] = [];

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(mpdXml, 'application/xml');

      // Check parsererror
      if (doc.querySelector('parsererror')) {
        return this.parseDashMpdRegexFallback(mpdXml);
      }

      const adaptationSets = doc.querySelectorAll('AdaptationSet');

      adaptationSets.forEach((adSet, adIdx) => {
        const mimeType = adSet.getAttribute('mimeType') || '';
        const contentType = adSet.getAttribute('contentType') || '';

        // Only process video adaptation sets
        if (
          contentType === 'video' ||
          mimeType.startsWith('video/') ||
          adSet.querySelector('Representation[width]')
        ) {
          const adCodecs = adSet.getAttribute('codecs') || '';

          // Check for HDR EssentialProperty / SupplementalProperty
          let isHdrSet = false;
          let hdrFormat: DynamicRangeType = 'SDR';
          const properties = adSet.querySelectorAll('EssentialProperty, SupplementalProperty');
          properties.forEach(prop => {
            const scheme = prop.getAttribute('schemeIdUri') || '';
            const val = prop.getAttribute('value') || '';
            if (scheme.includes('colour-information') || scheme.includes('transfer-characteristics')) {
              if (val.includes('16') || val.includes('smpte2084')) {
                isHdrSet = true;
                hdrFormat = 'HDR10';
              } else if (val.includes('18') || val.includes('arib-std-b67')) {
                isHdrSet = true;
                hdrFormat = 'HLG';
              }
            }
          });

          const reps = adSet.querySelectorAll('Representation');
          reps.forEach((rep, repIdx) => {
            const id = rep.getAttribute('id') || `dash-${adIdx}-${repIdx}`;
            const bandwidth = parseInt(rep.getAttribute('bandwidth') || '0', 10);
            const width = parseInt(rep.getAttribute('width') || '0', 10);
            const height = parseInt(rep.getAttribute('height') || '0', 10);
            const codecsStr = rep.getAttribute('codecs') || adCodecs;
            const frameRateStr = rep.getAttribute('frameRate') || '30';
            const framerate = this.parseDashFrameRate(frameRateStr);

            const codec = this.mapCodecStringToFamily(codecsStr);
            const detected = TVHdrEngine.detectDynamicRangeFromMetadata(codecsStr);

            const hdr = isHdrSet || detected.hdr;
            const dynamicRange = isHdrSet ? hdrFormat : detected.dynamicRange;
            const bitDepth: 8 | 10 = hdr ? 10 : 8;
            const repMime = rep.getAttribute('mimeType') || mimeType || 'video/mp4';
            const fullMime = codecsStr ? `${repMime}; codecs="${codecsStr}"` : repMime;

            representations.push({
              id,
              width: width || (height ? Math.round(height * (16 / 9)) : 1920),
              height: height || 1080,
              bitrate: bandwidth,
              codec,
              codecString: codecsStr,
              framerate,
              hdr,
              dynamicRange,
              bitDepth,
              mimeType: fullMime
            });
          });
        }
      });
    } catch {
      return this.parseDashMpdRegexFallback(mpdXml);
    }

    return this.sortAndDeduplicate(representations);
  }

  /**
   * Lightweight regex fallback parser for DASH MPDs in non-DOM environments
   */
  private static parseDashMpdRegexFallback(xml: string): MediaRepresentation[] {
    const representations: MediaRepresentation[] = [];
    const repRegex = /<Representation\b([^>]+)>/gi;
    let match: RegExpExecArray | null;
    let idx = 0;

    while ((match = repRegex.exec(xml)) !== null) {
      idx++;
      const attrsStr = match[1];
      const getAttr = (name: string): string => {
        const m = new RegExp(`\\b${name}="([^"]+)"`, 'i').exec(attrsStr);
        return m ? m[1] : '';
      };

      const id = getAttr('id') || `dash-rep-${idx}`;
      const bandwidth = parseInt(getAttr('bandwidth') || '0', 10);
      const width = parseInt(getAttr('width') || '0', 10);
      const height = parseInt(getAttr('height') || '0', 10);
      const codecsStr = getAttr('codecs');
      const frameRate = parseFloat(getAttr('frameRate')) || 30;

      if (width > 0 || height > 0 || bandwidth > 0) {
        const codec = this.mapCodecStringToFamily(codecsStr);
        const detected = TVHdrEngine.detectDynamicRangeFromMetadata(codecsStr);
        const fullMime = `video/mp4; codecs="${codecsStr || 'avc1'}"`;

        representations.push({
          id,
          width: width || (height ? Math.round(height * (16 / 9)) : 1920),
          height: height || 1080,
          bitrate: bandwidth,
          codec,
          codecString: codecsStr,
          framerate: frameRate,
          hdr: detected.hdr,
          dynamicRange: detected.dynamicRange,
          bitDepth: detected.hdr ? 10 : 8,
          mimeType: fullMime
        });
      }
    }

    return this.sortAndDeduplicate(representations);
  }

  /**
   * Parses key-value attribute lists in HLS tags (e.g. BANDWIDTH=5000000,RESOLUTION=1920x1080)
   */
  private static parseTagAttributes(attrLine: string): Record<string, string> {
    const result: Record<string, string> = {};
    const regex = /([A-Z0-9-]+)=(?:"([^"]*)"|([^,]*))/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(attrLine)) !== null) {
      const key = match[1];
      const val = match[2] !== undefined ? match[2] : match[3];
      result[key] = val.trim();
    }

    return result;
  }

  private static parseDashFrameRate(str: string): number {
    if (!str) return 30;
    if (str.includes('/')) {
      const [num, den] = str.split('/');
      const n = parseFloat(num);
      const d = parseFloat(den);
      return d ? Math.round((n / d) * 100) / 100 : 30;
    }
    return parseFloat(str) || 30;
  }

  private static sortAndDeduplicate(reps: MediaRepresentation[]): MediaRepresentation[] {
    // Sort highest resolution first, then highest bitrate, then HDR first
    return reps.sort((a, b) => {
      if (b.height !== a.height) return b.height - a.height;
      if (b.hdr !== a.hdr) return b.hdr ? 1 : -1;
      return b.bitrate - a.bitrate;
    });
  }
}
