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
    function deepSearchResolution(obj, depth = 0) {
      if (!obj || typeof obj !== "object" || depth > 8) return void 0;
      const resolutionKeys = [
        "MaxResolution",
        "maxResolution",
        "4K",
        "UHD",
        "VideoQuality",
        "videoQuality",
        "resolutions"
      ];
      for (const key of resolutionKeys) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const val = obj[key];
          if (val !== null && val !== void 0) return String(val);
        }
      }
      for (const key of Object.keys(obj)) {
        const child = obj[key];
        if (child && typeof child === "object") {
          const found = deepSearchResolution(child, depth + 1);
          if (found) return found;
        }
      }
      return void 0;
    }
    function deepSearchRepresentations(obj, depth = 0) {
      if (!obj || typeof obj !== "object" || depth > 8) return void 0;
      if (Array.isArray(obj)) {
        const hasWidthHeight = obj.some(
          (item) => item && typeof item === "object" && ("width" in item || "height" in item)
        );
        if (hasWidthHeight) return obj;
      }
      for (const key of Object.keys(obj)) {
        const child = obj[key];
        if (child && typeof child === "object") {
          const found = deepSearchRepresentations(child, depth + 1);
          if (found) return found;
        }
      }
      return void 0;
    }
    function extractDeviceTypeFromUrl(url) {
      try {
        const parsed = new URL(url);
        for (const key of ["deviceTypeID", "deviceType", "deviceTypeId", "device_type"]) {
          const val = parsed.searchParams.get(key);
          if (val) return val;
        }
      } catch (_) {
      }
      return void 0;
    }
    function extractDeviceTypeFromBody(body) {
      const match = body.match(/[Dd]evice[Tt]ype(?:I[Dd])?["\s:=]+([A-Za-z0-9_\-]+)/);
      return match ? match[1] : void 0;
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
    (function hookAppendBuffer() {
      if (typeof window.SourceBuffer === "undefined") return;
      const originalAppendBuffer = SourceBuffer.prototype.appendBuffer;
      let lastSegmentBroadcast = 0;
      SourceBuffer.prototype.appendBuffer = function(data) {
        try {
          const now = Date.now();
          if (now - lastSegmentBroadcast >= 5e3) {
            let bytes = null;
            if (data instanceof Uint8Array) {
              bytes = data;
            } else if (data instanceof ArrayBuffer) {
              bytes = new Uint8Array(data);
            } else if (ArrayBuffer.isView(data)) {
              bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
            }
            if (bytes && bytes.length >= 4) {
              let boxType = "unknown";
              if (bytes.length >= 8) {
                const typeBytes = bytes.slice(4, 8);
                boxType = String.fromCharCode(typeBytes[0], typeBytes[1], typeBytes[2], typeBytes[3]);
              } else {
                const sig4 = (bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3]) >>> 0;
                const FTYP = 1718909296;
                const MOOV = 1836019574;
                const MOOF = 1836019558;
                if (sig4 === FTYP) boxType = "ftyp";
                else if (sig4 === MOOV) boxType = "moov";
                else if (sig4 === MOOF) boxType = "moof";
              }
              const knownBoxes = {
                ftyp: 1718909296,
                moov: 1836019574,
                moof: 1836019558
              };
              let resolvedBoxType = "other";
              if (bytes.length >= 8) {
                const sig = (bytes[4] << 24 | bytes[5] << 16 | bytes[6] << 8 | bytes[7]) >>> 0;
                for (const [name, code] of Object.entries(knownBoxes)) {
                  if (sig === code) {
                    resolvedBoxType = name;
                    break;
                  }
                }
                if (resolvedBoxType === "other") {
                  const sig0 = (bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3]) >>> 0;
                  for (const [name, code] of Object.entries(knownBoxes)) {
                    if (sig0 === code) {
                      resolvedBoxType = name;
                      break;
                    }
                  }
                }
              }
              lastSegmentBroadcast = now;
              broadcast({
                type: "PV_MEDIA_PROBE_EVENT",
                action: "SEGMENT_APPEND",
                boxType: resolvedBoxType,
                byteLength: bytes.byteLength
              });
            }
          }
        } catch (_) {
        }
        return originalAppendBuffer.call(this, data);
      };
    })();
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
          const isPlaybackResources = url.includes("GetPlaybackResources") || url.includes("atv-ps");
          const isManifest = url.includes(".mpd") || url.includes(".m3u8") || url.includes("playback.us-east-1.pv-cdn.net");
          if (isPlaybackResources || isManifest) {
            const clone = response.clone();
            clone.text().then((text) => {
              if (text.includes("<MPD") || text.includes("urn:mpeg:dash")) {
                parseDashManifestText(text, url);
              } else if (text.includes("#EXTM3U")) {
                parseHlsManifestText(text, url);
              }
              if (isPlaybackResources) {
                let rawBody = "";
                try {
                  const init = args[1];
                  if (init?.body != null) {
                    rawBody = typeof init.body === "string" ? init.body : JSON.stringify(init.body);
                  } else if (args[0] instanceof Request && args[0].bodyUsed === false) {
                  }
                } catch (_) {
                }
                let parsedJson = null;
                try {
                  parsedJson = JSON.parse(text);
                } catch (_) {
                }
                const maxRes = parsedJson ? deepSearchResolution(parsedJson) : void 0;
                const rawReps = parsedJson ? deepSearchRepresentations(parsedJson) : void 0;
                const deviceType = extractDeviceTypeFromUrl(url) || (rawBody ? extractDeviceTypeFromBody(rawBody) : void 0) || (text ? extractDeviceTypeFromBody(text) : void 0);
                broadcast({
                  type: "PV_MEDIA_PROBE_EVENT",
                  action: "PLAYBACK_RESOURCES_CAPTURED",
                  requestUrl: url,
                  requestBody: rawBody.slice(0, 2e3),
                  responseBody: text.slice(0, 4e3),
                  deviceTypeIdentifier: deviceType,
                  maxResolutionFromResponse: maxRes,
                  rawRepresentationsFromResponse: rawReps
                });
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
          let walkProps2 = function(obj, prefix, depth) {
            if (!obj || typeof obj !== "object" || depth > 3) return [];
            const found = [];
            let ownKeys = [];
            try {
              ownKeys = Object.getOwnPropertyNames(obj);
            } catch (_) {
            }
            for (const key of ownKeys) {
              const lower = key.toLowerCase();
              if (apiKeywords.some((kw) => lower.includes(kw))) {
                found.push(prefix ? `${prefix}.${key}` : key);
              }
              if (depth < 3) {
                let child;
                try {
                  child = obj[key];
                } catch (_) {
                  continue;
                }
                if (child && typeof child === "object" && !Array.isArray(child)) {
                  found.push(...walkProps2(child, prefix ? `${prefix}.${key}` : key, depth + 1));
                }
              }
            }
            return found;
          };
          var walkProps = walkProps2;
          discoveredPlayerInstance = inst;
          const hasTrackApi = typeof inst.setVideoTrack === "function" || typeof inst.selectQuality === "function" || typeof inst.setMaxResolution === "function" || typeof inst.setQualityLevel === "function";
          broadcast({
            type: "PV_MEDIA_PROBE_EVENT",
            action: "PLAYER_DETECTED",
            playerEngine: "Amazon ATVWebPlayerSDK",
            hasTrackSelectionApi: hasTrackApi,
            selectionApiName: hasTrackApi ? "setVideoTrack/selectQuality" : void 0
          });
          const apiKeywords = [
            "quality",
            "resolution",
            "track",
            "bitrate",
            "maxHeight",
            "maxWidth",
            "setMax",
            "forceQuality",
            "representation",
            "stream",
            "codec",
            "abr",
            "adaptation",
            "bandwidth"
          ];
          const discoveredApis = walkProps2(inst, "", 1);
          if (discoveredApis.length > 0) {
            broadcast({
              type: "PV_MEDIA_PROBE_EVENT",
              action: "SDK_API_DEEP_SCAN",
              discoveredApis
            });
          }
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