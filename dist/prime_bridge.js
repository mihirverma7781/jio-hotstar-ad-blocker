"use strict";
(() => {
  // src/prime/prime_bridge.ts
  (function initPrimeBridge() {
    if (typeof window === "undefined" || window.__PRIME_BRIDGE_INSTALLED__) {
      return;
    }
    window.__PRIME_BRIDGE_INSTALLED__ = true;
    const observedTracks = /* @__PURE__ */ new Map();
    let discoveredPlayerInstance = null;
    function broadcast(payload) {
      try {
        window.postMessage({ source: "PV_PAGE_BRIDGE", payload }, "*");
      } catch (e) {
      }
    }
    if (typeof window.MediaSource !== "undefined" && window.MediaSource.prototype) {
      const originalAddSourceBuffer = window.MediaSource.prototype.addSourceBuffer;
      window.MediaSource.prototype.addSourceBuffer = function(mimeType) {
        const sb = originalAddSourceBuffer.call(this, mimeType);
        try {
          broadcast({
            type: "PV_MEDIA_PROBE_EVENT",
            action: "SOURCEBUFFER_INIT",
            mimeType,
            codecString: mimeType
          });
        } catch (err) {
        }
        return sb;
      };
    }
    function parseDashManifestText(text, url) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "application/xml");
        const adaptationSets = doc.querySelectorAll("AdaptationSet");
        adaptationSets.forEach((set) => {
          const contentType = set.getAttribute("contentType") || "";
          const mimeType = set.getAttribute("mimeType") || "";
          if (contentType === "video" || mimeType.includes("video")) {
            const reps = set.querySelectorAll("Representation");
            reps.forEach((rep) => {
              const id = rep.getAttribute("id") || `dash-${rep.getAttribute("bandwidth")}`;
              const width = parseInt(rep.getAttribute("width") || "0", 10);
              const height = parseInt(rep.getAttribute("height") || "0", 10);
              const bitrate = parseInt(rep.getAttribute("bandwidth") || "0", 10);
              const codec = rep.getAttribute("codecs") || mimeType;
              const framerate = parseFloat(rep.getAttribute("frameRate") || "0");
              const supplemental = set.querySelector('SupplementalProperty[schemeIdUri*="cicp"], EssentialProperty[schemeIdUri*="cicp"]');
              const hdr = Boolean(supplemental || codec && (codec.includes("hvc1.2") || codec.includes("vp09.02") || codec.includes(".10")));
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
            type: "PV_MEDIA_PROBE_EVENT",
            action: "MANIFEST_LOADED",
            manifestUrl: url,
            manifestType: "DASH",
            observedRepresentations: Array.from(observedTracks.values())
          });
        }
      } catch (e) {
      }
    }
    function parseHlsManifestText(text, url) {
      try {
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("#EXT-X-STREAM-INF:")) {
            const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
            const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
            const codecMatch = line.match(/CODECS="([^"]+)"/i);
            const fpsMatch = line.match(/FRAME-RATE=([\d.]+)/i);
            const rangeMatch = line.match(/VIDEO-RANGE=(PQ|HLG)/i);
            if (resMatch) {
              const width = parseInt(resMatch[1], 10);
              const height = parseInt(resMatch[2], 10);
              const bitrate = bwMatch ? parseInt(bwMatch[1], 10) : 0;
              const codec = codecMatch ? codecMatch[1] : "unknown";
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
            type: "PV_MEDIA_PROBE_EVENT",
            action: "MANIFEST_LOADED",
            manifestUrl: url,
            manifestType: "HLS",
            observedRepresentations: Array.from(observedTracks.values())
          });
        }
      } catch (e) {
      }
    }
    if (typeof window.fetch === "function") {
      const originalFetch = window.fetch;
      window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        try {
          const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
          if (url.includes(".mpd") || url.includes(".m3u8") || url.includes("GetPlaybackResources") || url.includes("playback.us-east-1.pv-cdn.net") || url.includes("atv-ps")) {
            const clone = response.clone();
            clone.text().then((text) => {
              if (text.includes("<MPD") || text.includes("urn:mpeg:dash")) {
                parseDashManifestText(text, url);
              } else if (text.includes("#EXTM3U")) {
                parseHlsManifestText(text, url);
              }
            }).catch(() => {
            });
          }
        } catch (err) {
        }
        return response;
      };
    }
    if (typeof window.XMLHttpRequest !== "undefined") {
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(...args) {
        this.__url = typeof args[1] === "string" ? args[1] : args[1]?.toString() || "";
        return originalOpen.apply(this, args);
      };
      XMLHttpRequest.prototype.send = function(...args) {
        this.addEventListener("load", () => {
          try {
            const url = this.__url || "";
            if (url.includes(".mpd") || url.includes(".m3u8") || url.includes("GetPlaybackResources") || url.includes("atv-ps")) {
              const text = this.responseText;
              if (text && (text.includes("<MPD") || text.includes("urn:mpeg:dash"))) {
                parseDashManifestText(text, url);
              } else if (text && text.includes("#EXTM3U")) {
                parseHlsManifestText(text, url);
              }
            }
          } catch (e) {
          }
        });
        return originalSend.apply(this, args);
      };
    }
    function scanForPlayerInstance() {
      const candidates = [
        window.atvwebplayersdk,
        window.__player,
        window.player,
        window.atvPlayerInstance
      ];
      for (const inst of candidates) {
        if (inst && typeof inst === "object") {
          discoveredPlayerInstance = inst;
          const hasTrackApi = typeof inst.setVideoTrack === "function" || typeof inst.selectQuality === "function" || typeof inst.setMaxResolution === "function" || typeof inst.setQualityLevel === "function";
          broadcast({
            type: "PV_MEDIA_PROBE_EVENT",
            action: "PLAYER_DETECTED",
            playerEngine: "Amazon ATVWebPlayerSDK",
            hasTrackSelectionApi: hasTrackApi,
            selectionApiName: hasTrackApi ? "setVideoTrack/selectQuality" : void 0
          });
          return;
        }
      }
    }
    setInterval(() => {
      const video = document.querySelector("video");
      if (video) {
        scanForPlayerInstance();
        broadcast({
          type: "PV_MEDIA_PROBE_EVENT",
          action: "PLAYBACK_SAMPLE",
          videoWidth: video.videoWidth || 0,
          videoHeight: video.videoHeight || 0,
          currentTime: video.currentTime || 0,
          observedRepresentations: Array.from(observedTracks.values())
        });
      }
    }, 1e3);
    window.addEventListener("message", (event) => {
      if (event.data?.target === "PV_PAGE_BRIDGE") {
        const cmd = event.data.command;
        if (cmd === "SELECT_TRACK" && discoveredPlayerInstance) {
          const trackId = event.data.trackId;
          if (typeof discoveredPlayerInstance.setVideoTrack === "function") {
            discoveredPlayerInstance.setVideoTrack(trackId);
          } else if (typeof discoveredPlayerInstance.selectQuality === "function") {
            discoveredPlayerInstance.selectQuality(trackId);
          } else if (typeof discoveredPlayerInstance.setMaxResolution === "function") {
            discoveredPlayerInstance.setMaxResolution(3840, 2160);
          }
        }
      }
    });
    scanForPlayerInstance();
  })();
})();
//# sourceMappingURL=prime_bridge.js.map