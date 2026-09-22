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

  // 4. Intercept fetch for manifests
  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);
      try {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
        if (
          url.includes('.mpd') ||
          url.includes('.m3u8') ||
          url.includes('GetPlaybackResources') ||
          url.includes('playback.us-east-1.pv-cdn.net') ||
          url.includes('atv-ps')
        ) {
          const clone = response.clone();
          clone.text().then((text) => {
            if (text.includes('<MPD') || text.includes('urn:mpeg:dash')) {
              parseDashManifestText(text, url);
            } else if (text.includes('#EXTM3U')) {
              parseHlsManifestText(text, url);
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

  // 6. Inspect Player SDK instance
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
