/**
 * Prime Video Page-Context Bridge (Runs in MAIN world)
 * Passively observes real MediaSource, SourceBuffers, manifest fetches, and player SDK objects.
 * Uses a narrow window.postMessage protocol to communicate with the extension content script.
 * DOES NOT alter DRM, licensing, or device authentication.
 */

import { PrimeObservedTrack, PrimeProbeEventPayload } from '../types/drm_research';

(function initPrimeBridge() {
  if (typeof window === 'undefined' || (window as any).__PRIME_BRIDGE_INSTALLED__) {
    return;
  }
  (window as any).__PRIME_BRIDGE_INSTALLED__ = true;

  const observedTracks: Map<string, PrimeObservedTrack> = new Map();
  let discoveredPlayerInstance: any = null;

  function broadcast(payload: PrimeProbeEventPayload) {
    try {
      window.postMessage({ source: 'PV_PAGE_BRIDGE', payload }, '*');
    } catch (e) {
      // Safe guard against detached frames
    }
  }

  // ─── Helper: Deep-search a parsed JSON object for known resolution keys ────────
  function deepSearchResolution(obj: any, depth = 0): string | undefined {
    if (!obj || typeof obj !== 'object' || depth > 8) return undefined;
    const resolutionKeys = [
      'MaxResolution', 'maxResolution', '4K', 'UHD',
      'VideoQuality', 'videoQuality', 'resolutions',
    ];
    for (const key of resolutionKeys) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (val !== null && val !== undefined) return String(val);
      }
    }
    for (const key of Object.keys(obj)) {
      const child = obj[key];
      if (child && typeof child === 'object') {
        const found = deepSearchResolution(child, depth + 1);
        if (found) return found;
      }
    }
    return undefined;
  }

  // ─── Helper: Deep-search for arrays that contain objects with width/height ────
  function deepSearchRepresentations(obj: any, depth = 0): any[] | undefined {
    if (!obj || typeof obj !== 'object' || depth > 8) return undefined;
    if (Array.isArray(obj)) {
      const hasWidthHeight = obj.some(
        (item: any) => item && typeof item === 'object' &&
          ('width' in item || 'height' in item)
      );
      if (hasWidthHeight) return obj;
    }
    for (const key of Object.keys(obj)) {
      const child = obj[key];
      if (child && typeof child === 'object') {
        const found = deepSearchRepresentations(child, depth + 1);
        if (found) return found;
      }
    }
    return undefined;
  }

  // ─── Helper: Extract deviceTypeIdentifier from a URL's query params ───────────
  function extractDeviceTypeFromUrl(url: string): string | undefined {
    try {
      const parsed = new URL(url);
      for (const key of ['deviceTypeID', 'deviceType', 'deviceTypeId', 'device_type']) {
        const val = parsed.searchParams.get(key);
        if (val) return val;
      }
    } catch (_) {}
    return undefined;
  }

  // ─── Helper: Extract deviceTypeIdentifier from request body text ──────────────
  function extractDeviceTypeFromBody(body: string): string | undefined {
    const match = body.match(/[Dd]evice[Tt]ype(?:I[Dd])?["\s:=]+([A-Za-z0-9_\-]+)/);
    return match ? match[1] : undefined;
  }

  // 1. Hook MediaSource.prototype.addSourceBuffer
  if (typeof window.MediaSource !== 'undefined' && window.MediaSource.prototype) {
    const originalAddSourceBuffer = window.MediaSource.prototype.addSourceBuffer;
    window.MediaSource.prototype.addSourceBuffer = function (mimeType: string): SourceBuffer {
      const sb = originalAddSourceBuffer.call(this, mimeType);
      try {
        broadcast({
          type: 'PV_MEDIA_PROBE_EVENT',
          action: 'SOURCEBUFFER_INIT',
          mimeType,
          codecString: mimeType
        });
      } catch (err) {}
      return sb;
    };
  }

  // ─── 1b. Hook SourceBuffer.prototype.appendBuffer for ISOBMFF box detection ───
  // Broadcasts SEGMENT_APPEND at most once every 5 seconds to avoid flooding.
  (function hookAppendBuffer() {
    if (typeof (window as any).SourceBuffer === 'undefined') return;
    const originalAppendBuffer = SourceBuffer.prototype.appendBuffer;
    let lastSegmentBroadcast = 0;

    SourceBuffer.prototype.appendBuffer = function (
      data: BufferSource
    ): void {
      try {
        const now = Date.now();
        if (now - lastSegmentBroadcast >= 5000) {
          let bytes: Uint8Array | null = null;
          if (data instanceof Uint8Array) {
            bytes = data;
          } else if (data instanceof ArrayBuffer) {
            bytes = new Uint8Array(data);
          } else if (ArrayBuffer.isView(data)) {
            bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          }

          if (bytes && bytes.length >= 4) {
            // Read 4-byte box type from bytes 4-7 (ISOBMFF: size[0-3] + type[4-7])
            // For the very first box the type is at offset 4; but for small buffers check offset 4 first
            let boxType = 'unknown';
            if (bytes.length >= 8) {
              const typeBytes = bytes.slice(4, 8);
              boxType = String.fromCharCode(typeBytes[0], typeBytes[1], typeBytes[2], typeBytes[3]);
            } else {
              // Signature at byte 0 for 4-byte check (ftyp/moov/moof without size prefix)
              const sig4 = (bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3]) >>> 0;
              const FTYP = 0x66747970;
              const MOOV = 0x6d6f6f76;
              const MOOF = 0x6d6f6f66;
              if (sig4 === FTYP) boxType = 'ftyp';
              else if (sig4 === MOOV) boxType = 'moov';
              else if (sig4 === MOOF) boxType = 'moof';
            }

            // Verify it's one of the known ISOBMFF boxes (type could be at offset 4)
            const knownBoxes: Record<string, number> = {
              ftyp: 0x66747970,
              moov: 0x6d6f6f76,
              moof: 0x6d6f6f66,
            };
            let resolvedBoxType = 'other';
            if (bytes.length >= 8) {
              const sig = (bytes[4] << 24 | bytes[5] << 16 | bytes[6] << 8 | bytes[7]) >>> 0;
              for (const [name, code] of Object.entries(knownBoxes)) {
                if (sig === code) { resolvedBoxType = name; break; }
              }
              // Also check at offset 0 for edge cases
              if (resolvedBoxType === 'other') {
                const sig0 = (bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3]) >>> 0;
                for (const [name, code] of Object.entries(knownBoxes)) {
                  if (sig0 === code) { resolvedBoxType = name; break; }
                }
              }
            }

            lastSegmentBroadcast = now;
            broadcast({
              type: 'PV_MEDIA_PROBE_EVENT',
              action: 'SEGMENT_APPEND',
              boxType: resolvedBoxType,
              byteLength: bytes.byteLength,
            });
          }
        }
      } catch (_) {}
      return originalAppendBuffer.call(this, data);
    };
  })();

  // 2. Parse DASH MPD text for video representations
  function parseDashManifestText(text: string, url: string) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'application/xml');
      const adaptationSets = doc.querySelectorAll('AdaptationSet');

      adaptationSets.forEach((set) => {
        const contentType = set.getAttribute('contentType') || '';
        const mimeType = set.getAttribute('mimeType') || '';
        if (contentType === 'video' || mimeType.includes('video')) {
          const reps = set.querySelectorAll('Representation');
          reps.forEach((rep) => {
            const id = rep.getAttribute('id') || `dash-${rep.getAttribute('bandwidth')}`;
            const width = parseInt(rep.getAttribute('width') || '0', 10);
            const height = parseInt(rep.getAttribute('height') || '0', 10);
            const bitrate = parseInt(rep.getAttribute('bandwidth') || '0', 10);
            const codec = rep.getAttribute('codecs') || mimeType;
            const framerate = parseFloat(rep.getAttribute('frameRate') || '0');

            // Check HDR signaling
            const supplemental = set.querySelector('SupplementalProperty[schemeIdUri*="cicp"], EssentialProperty[schemeIdUri*="cicp"]');
            const hdr = Boolean(supplemental || (codec && (codec.includes('hvc1.2') || codec.includes('vp09.02') || codec.includes('.10'))));

            if (width > 0 && height > 0) {
              observedTracks.set(id, {
                id,
                width,
                height,
                bitrate,
                codec,
                framerate,
                hdr,
                bitDepth: hdr ? 10 : 8,
                mimeType
              });
            }
          });
        }
      });

      if (observedTracks.size > 0) {
        broadcast({
          type: 'PV_MEDIA_PROBE_EVENT',
          action: 'MANIFEST_LOADED',
          manifestUrl: url,
          manifestType: 'DASH',
          observedRepresentations: Array.from(observedTracks.values())
        });
      }
    } catch (e) {
      // Manifest parse error
    }
  }

  // 3. Parse HLS M3U8 text for stream representations
  function parseHlsManifestText(text: string, url: string) {
    try {
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
          const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
          const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
          const codecMatch = line.match(/CODECS="([^"]+)"/i);
          const fpsMatch = line.match(/FRAME-RATE=([\d.]+)/i);
          const rangeMatch = line.match(/VIDEO-RANGE=(PQ|HLG)/i);

          if (resMatch) {
            const width = parseInt(resMatch[1], 10);
            const height = parseInt(resMatch[2], 10);
            const bitrate = bwMatch ? parseInt(bwMatch[1], 10) : 0;
            const codec = codecMatch ? codecMatch[1] : 'unknown';
            const framerate = fpsMatch ? parseFloat(fpsMatch[1]) : 30;
            const hdr = Boolean(rangeMatch);
            const id = `hls-${width}x${height}-${bitrate}`;

            observedTracks.set(id, {
              id,
              width,
              height,
              bitrate,
              codec,
              framerate,
              hdr,
              bitDepth: hdr ? 10 : 8
            });
          }
        }
      }

      if (observedTracks.size > 0) {
        broadcast({
          type: 'PV_MEDIA_PROBE_EVENT',
          action: 'MANIFEST_LOADED',
          manifestUrl: url,
          manifestType: 'HLS',
          observedRepresentations: Array.from(observedTracks.values())
        });
      }
    } catch (e) {}
  }

  // 4. Intercept fetch for manifests — also capture full GetPlaybackResources / atv-ps req+res
  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);
      try {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
        const isPlaybackResources =
          url.includes('GetPlaybackResources') || url.includes('atv-ps');
        const isManifest =
          url.includes('.mpd') ||
          url.includes('.m3u8') ||
          url.includes('playback.us-east-1.pv-cdn.net');

        if (isPlaybackResources || isManifest) {
          const clone = response.clone();

          // ── Always read full text (covers JSON, XML, and plain) ──────────────
          clone.text().then((text) => {
            // Standard manifest handling (unchanged)
            if (text.includes('<MPD') || text.includes('urn:mpeg:dash')) {
              parseDashManifestText(text, url);
            } else if (text.includes('#EXTM3U')) {
              parseHlsManifestText(text, url);
            }

            // ── NEW: Full req+res capture for GetPlaybackResources / atv-ps ───
            if (isPlaybackResources) {
              // Capture request body
              let rawBody = '';
              try {
                const init = args[1] as RequestInit | undefined;
                if (init?.body != null) {
                  rawBody = typeof init.body === 'string'
                    ? init.body
                    : JSON.stringify(init.body);
                } else if (args[0] instanceof Request && (args[0] as Request).bodyUsed === false) {
                  // Body already consumed by originalFetch; best-effort from init only
                }
              } catch (_) {}

              // Try JSON parse for deep analysis
              let parsedJson: any = null;
              try { parsedJson = JSON.parse(text); } catch (_) {}

              const maxRes = parsedJson ? deepSearchResolution(parsedJson) : undefined;
              const rawReps = parsedJson ? deepSearchRepresentations(parsedJson) : undefined;

              // Device type: from URL params, then from body text
              const deviceType =
                extractDeviceTypeFromUrl(url) ||
                (rawBody ? extractDeviceTypeFromBody(rawBody) : undefined) ||
                (text ? extractDeviceTypeFromBody(text) : undefined);

              broadcast({
                type: 'PV_MEDIA_PROBE_EVENT',
                action: 'PLAYBACK_RESOURCES_CAPTURED',
                requestUrl: url,
                requestBody: rawBody.slice(0, 2000),
                responseBody: text.slice(0, 4000),
                deviceTypeIdentifier: deviceType,
                maxResolutionFromResponse: maxRes,
                rawRepresentationsFromResponse: rawReps,
              });
            }
          }).catch(() => {});
        }
      } catch (err) {}
      return response;
    };
  }

  // 5. Intercept XMLHttpRequest for manifests
  if (typeof window.XMLHttpRequest !== 'undefined') {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: any[]) {
      (this as any).__url = typeof args[1] === 'string' ? args[1] : args[1]?.toString() || '';
      return (originalOpen as any).apply(this, args);
    };

    XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, ...args: any[]) {
      this.addEventListener('load', () => {
        try {
          const url = (this as any).__url || '';
          if (
            url.includes('.mpd') ||
            url.includes('.m3u8') ||
            url.includes('GetPlaybackResources') ||
            url.includes('atv-ps')
          ) {
            const text = this.responseText;
            if (text && (text.includes('<MPD') || text.includes('urn:mpeg:dash'))) {
              parseDashManifestText(text, url);
            } else if (text && text.includes('#EXTM3U')) {
              parseHlsManifestText(text, url);
            }
          }
        } catch (e) {}
      });
      return (originalSend as any).apply(this, args);
    };
  }

  // 6. Inspect Player SDK instance + Deep API Scanner
  function scanForPlayerInstance() {
    const candidates = [
      (window as any).atvwebplayersdk,
      (window as any).__player,
      (window as any).player,
      (window as any).atvPlayerInstance
    ];

    for (const inst of candidates) {
      if (inst && typeof inst === 'object') {
        discoveredPlayerInstance = inst;
        const hasTrackApi = typeof inst.setVideoTrack === 'function' ||
                            typeof inst.selectQuality === 'function' ||
                            typeof inst.setMaxResolution === 'function' ||
                            typeof inst.setQualityLevel === 'function';

        broadcast({
          type: 'PV_MEDIA_PROBE_EVENT',
          action: 'PLAYER_DETECTED',
          playerEngine: 'Amazon ATVWebPlayerSDK',
          hasTrackSelectionApi: hasTrackApi,
          selectionApiName: hasTrackApi ? 'setVideoTrack/selectQuality' : undefined
        });

        // ── NEW: Deep SDK API Scanner ──────────────────────────────────────────
        const apiKeywords = [
          'quality', 'resolution', 'track', 'bitrate', 'maxHeight', 'maxWidth',
          'setMax', 'forceQuality', 'representation', 'stream', 'codec', 'abr',
          'adaptation', 'bandwidth',
        ];

        function walkProps(obj: any, prefix: string, depth: number): string[] {
          if (!obj || typeof obj !== 'object' || depth > 3) return [];
          const found: string[] = [];
          let ownKeys: string[] = [];
          try { ownKeys = Object.getOwnPropertyNames(obj); } catch (_) {}
          for (const key of ownKeys) {
            const lower = key.toLowerCase();
            if (apiKeywords.some((kw) => lower.includes(kw))) {
              found.push(prefix ? `${prefix}.${key}` : key);
            }
            if (depth < 3) {
              let child: any;
              try { child = obj[key]; } catch (_) { continue; }
              if (child && typeof child === 'object' && !Array.isArray(child)) {
                found.push(...walkProps(child, prefix ? `${prefix}.${key}` : key, depth + 1));
              }
            }
          }
          return found;
        }

        const discoveredApis = walkProps(inst, '', 1);
        if (discoveredApis.length > 0) {
          broadcast({
            type: 'PV_MEDIA_PROBE_EVENT',
            action: 'SDK_API_DEEP_SCAN',
            discoveredApis,
          });
        }

        return;
      }
    }
  }

  // 7. Regular Playback Telemetry Samples
  setInterval(() => {
    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (video) {
      scanForPlayerInstance();

      broadcast({
        type: 'PV_MEDIA_PROBE_EVENT',
        action: 'PLAYBACK_SAMPLE',
        videoWidth: video.videoWidth || 0,
        videoHeight: video.videoHeight || 0,
        currentTime: video.currentTime || 0,
        observedRepresentations: Array.from(observedTracks.values())
      });
    }
  }, 1000);

  // 8. Listen for Quality Selection Commands from Extension Content Script
  window.addEventListener('message', (event) => {
    if (event.data?.target === 'PV_PAGE_BRIDGE') {
      const cmd = event.data.command;
      if (cmd === 'SELECT_TRACK' && discoveredPlayerInstance) {
        const trackId = event.data.trackId;
        if (typeof discoveredPlayerInstance.setVideoTrack === 'function') {
          discoveredPlayerInstance.setVideoTrack(trackId);
        } else if (typeof discoveredPlayerInstance.selectQuality === 'function') {
          discoveredPlayerInstance.selectQuality(trackId);
        } else if (typeof discoveredPlayerInstance.setMaxResolution === 'function') {
          discoveredPlayerInstance.setMaxResolution(3840, 2160);
        }
      }
    }
  });

  scanForPlayerInstance();
})();
