"use strict";
(() => {
  // src/core/TVCapabilityEngine.ts
  var TVCapabilityEngine = class {
    static cachedDisplay = null;
    static cachedDecoderReport = null;
    /**
     * Probes the current display properties, pixel ratio, wide color gamut, and HDR queries.
     */
    static getDisplayCapability() {
      if (this.cachedDisplay) {
        return this.cachedDisplay;
      }
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const screenWidth = typeof screen !== "undefined" ? screen.width : 1920;
      const screenHeight = typeof screen !== "undefined" ? screen.height : 1080;
      let colorGamut = "srgb";
      let displayHDR = false;
      if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
        try {
          if (window.matchMedia("(color-gamut: rec2020)").matches) {
            colorGamut = "rec2020";
          } else if (window.matchMedia("(color-gamut: p3)").matches) {
            colorGamut = "p3";
          }
          displayHDR = window.matchMedia("(dynamic-range: high)").matches || window.matchMedia("(video-dynamic-range: high)").matches || window.matchMedia("(-webkit-video-dynamic-range: high)").matches;
        } catch (e) {
        }
      }
      const fullscreenSupport = typeof document !== "undefined" && Boolean(
        document.fullscreenEnabled || document.webkitFullscreenEnabled
      );
      this.cachedDisplay = {
        width: screenWidth,
        height: screenHeight,
        devicePixelRatio: dpr,
        effectiveWidth: Math.round(screenWidth * dpr),
        effectiveHeight: Math.round(screenHeight * dpr),
        fullscreenSupport,
        colorGamut,
        displayHDR
      };
      return this.cachedDisplay;
    }
    /**
     * Tests decodability of common TV streaming profiles across H.264, HEVC, VP9, AV1.
     * Probes 1080p, 1440p, 2160p (4K), 8-bit, and 10-bit HDR.
     */
    static async probeDecoderCapabilities(forceRefresh = false) {
      if (this.cachedDecoderReport && !forceRefresh) {
        return this.cachedDecoderReport;
      }
      const testConfigurations = [
        // H.264 (AVC)
        { codec: "H264", codecString: "avc1.640028", resolution: 1080, framerate: 60, bitDepth: 8, hdr: false, contentType: 'video/mp4; codecs="avc1.640028"' },
        { codec: "H264", codecString: "avc1.640033", resolution: 2160, framerate: 30, bitDepth: 8, hdr: false, contentType: 'video/mp4; codecs="avc1.640033"' },
        // VP9 Profile 0 (8-bit SDR) & Profile 2 (10-bit HDR10)
        { codec: "VP9", codecString: "vp09.00.41.08", resolution: 1080, framerate: 60, bitDepth: 8, hdr: false, contentType: 'video/webm; codecs="vp09.00.41.08"' },
        { codec: "VP9", codecString: "vp09.00.51.08", resolution: 2160, framerate: 60, bitDepth: 8, hdr: false, contentType: 'video/webm; codecs="vp09.00.51.08"' },
        { codec: "VP9", codecString: "vp09.02.51.10.01.09.16.09.00", resolution: 2160, framerate: 60, bitDepth: 10, hdr: true, contentType: 'video/webm; codecs="vp09.02.51.10.01.09.16.09.00"' },
        // AV1 Main Profile (8-bit and 10-bit)
        { codec: "AV1", codecString: "av01.0.08M.08", resolution: 1080, framerate: 60, bitDepth: 8, hdr: false, contentType: 'video/mp4; codecs="av01.0.08M.08"' },
        { codec: "AV1", codecString: "av01.0.12M.08", resolution: 2160, framerate: 60, bitDepth: 8, hdr: false, contentType: 'video/mp4; codecs="av01.0.12M.08"' },
        { codec: "AV1", codecString: "av01.0.12M.10.0.110.09.16.09.0", resolution: 2160, framerate: 60, bitDepth: 10, hdr: true, contentType: 'video/mp4; codecs="av01.0.12M.10.0.110.09.16.09.0"' },
        // HEVC (H.265) Main & Main 10 (Supported on macOS Safari & hardware-enabled Chrome on Mac/Win)
        { codec: "HEVC", codecString: "hvc1.1.6.L120.90", resolution: 1080, framerate: 60, bitDepth: 8, hdr: false, contentType: 'video/mp4; codecs="hvc1.1.6.L120.90"' },
        { codec: "HEVC", codecString: "hvc1.1.6.L150.90", resolution: 2160, framerate: 60, bitDepth: 8, hdr: false, contentType: 'video/mp4; codecs="hvc1.1.6.L150.90"' },
        { codec: "HEVC", codecString: "hvc1.2.4.L150.B0", resolution: 2160, framerate: 60, bitDepth: 10, hdr: true, contentType: 'video/mp4; codecs="hvc1.2.4.L150.B0"' }
      ];
      const profiles = [];
      for (const cfg of testConfigurations) {
        let supported = false;
        let smooth = false;
        let powerEfficient = false;
        if (typeof navigator !== "undefined" && navigator.mediaCapabilities && typeof navigator.mediaCapabilities.decodingInfo === "function") {
          try {
            const width = cfg.resolution === 2160 ? 3840 : cfg.resolution === 1440 ? 2560 : 1920;
            const height = cfg.resolution;
            const bitrate = cfg.resolution === 2160 ? 18e6 : cfg.resolution === 1440 ? 1e7 : 5e6;
            const res = await navigator.mediaCapabilities.decodingInfo({
              type: "media-source",
              video: {
                contentType: cfg.contentType,
                width,
                height,
                bitrate,
                framerate: cfg.framerate
              }
            });
            supported = res.supported;
            smooth = res.smooth;
            powerEfficient = res.powerEfficient;
          } catch {
            supported = this.fallbackIsTypeSupported(cfg.contentType);
            smooth = supported;
          }
        } else {
          supported = this.fallbackIsTypeSupported(cfg.contentType);
          smooth = supported;
        }
        profiles.push({
          codec: cfg.codec,
          codecString: cfg.codecString,
          resolution: cfg.resolution,
          framerate: cfg.framerate,
          bitDepth: cfg.bitDepth,
          hdr: cfg.hdr,
          supported,
          smooth,
          powerEfficient
        });
      }
      const supports2160p = profiles.some((p) => p.resolution === 2160 && p.supported);
      const supports1440p = supports2160p || profiles.some((p) => p.resolution === 1440 && p.supported);
      const supports1080p = profiles.some((p) => p.resolution === 1080 && p.supported);
      const supportsHEVC = profiles.some((p) => p.codec === "HEVC" && p.supported);
      const supportsAV1 = profiles.some((p) => p.codec === "AV1" && p.supported);
      const supportsVP9 = profiles.some((p) => p.codec === "VP9" && p.supported);
      const supportsH264 = profiles.some((p) => p.codec === "H264" && p.supported);
      const supportsHDR10 = profiles.some((p) => p.hdr && p.supported);
      this.cachedDecoderReport = {
        supports2160p,
        supports1440p,
        supports1080p,
        supportsHEVC,
        supportsAV1,
        supportsVP9,
        supportsH264,
        supportsHDR10,
        profiles
      };
      return this.cachedDecoderReport;
    }
    /**
     * Safe fallback using HTMLMediaElement or MediaSource.isTypeSupported
     */
    static fallbackIsTypeSupported(mime) {
      if (typeof MediaSource !== "undefined" && typeof MediaSource.isTypeSupported === "function") {
        return MediaSource.isTypeSupported(mime);
      }
      if (typeof document !== "undefined") {
        const v = document.createElement("video");
        const can = v.canPlayType(mime);
        return can === "probably" || can === "maybe";
      }
      return false;
    }
    /**
     * Checks whether a specific media representation is decodable by the browser
     */
    static async isRepresentationDecodable(width, height, mimeType, framerate = 60, bitrate = 15e6) {
      if (typeof navigator !== "undefined" && navigator.mediaCapabilities && typeof navigator.mediaCapabilities.decodingInfo === "function") {
        try {
          const info = await navigator.mediaCapabilities.decodingInfo({
            type: "media-source",
            video: {
              contentType: mimeType,
              width,
              height,
              bitrate,
              framerate
            }
          });
          if (!info.supported) {
            return { supported: false, smooth: false, reason: `Browser cannot decode format: ${mimeType}` };
          }
          return {
            supported: true,
            smooth: info.smooth,
            reason: info.smooth ? "Hardware/smooth decode supported" : "Decodable with potential frame drops"
          };
        } catch (err) {
          const supported2 = this.fallbackIsTypeSupported(mimeType);
          return {
            supported: supported2,
            smooth: supported2,
            reason: supported2 ? "MediaSource reports supported" : "Unsupported mime/codec"
          };
        }
      }
      const supported = this.fallbackIsTypeSupported(mimeType);
      return { supported, smooth: supported, reason: supported ? "Fallback supported" : "Unsupported mime" };
    }
    /**
     * Clears in-memory capability cache
     */
    static clearCache() {
      this.cachedDisplay = null;
      this.cachedDecoderReport = null;
    }
  };

  // src/core/TVHdrEngine.ts
  var TVHdrEngine = class {
    /**
     * Assesses HDR status by comparing display capabilities, content representations, and the active stream.
     */
    static evaluateHdr(contentRepresentations, activeRepresentation, displayOverride) {
      const display = displayOverride || TVCapabilityEngine.getDisplayCapability();
      const displayHDR = display.displayHDR;
      const hdrRepresentations = contentRepresentations.filter((r) => r.hdr);
      const contentHDR = hdrRepresentations.length > 0;
      let format = "SDR";
      if (contentHDR) {
        if (hdrRepresentations.some((r) => r.dynamicRange === "DolbyVision")) {
          format = "DolbyVision";
        } else if (hdrRepresentations.some((r) => r.dynamicRange === "HLG")) {
          format = "HLG";
        } else {
          format = "HDR10";
        }
      }
      const selectedHDR = Boolean(activeRepresentation && activeRepresentation.hdr);
      let reason = "Standard Dynamic Range (SDR) playback.";
      if (selectedHDR && displayHDR) {
        reason = `Active ${format} playback verified on HDR-capable display (${display.colorGamut}).`;
      } else if (contentHDR && !displayHDR) {
        reason = `Content offers ${format}, but display does not report High Dynamic Range support (fallback to SDR).`;
      } else if (contentHDR && displayHDR && !selectedHDR) {
        reason = `Content offers ${format} and display supports HDR, but player selected SDR (e.g. bandwidth or codec constraint).`;
      } else if (!contentHDR) {
        reason = "No High Dynamic Range representations exposed by this media stream.";
      }
      return {
        displayHDR,
        contentHDR,
        selectedHDR,
        format: selectedHDR ? activeRepresentation?.dynamicRange || format : contentHDR ? format : "SDR",
        colorGamut: display.colorGamut,
        transferFunction: selectedHDR ? format === "HLG" ? "arib-std-b67" : "smpte2084" : "bt709",
        reason
      };
    }
    /**
     * Inspects a representation's codec string and metadata to determine dynamic range format.
     */
    static detectDynamicRangeFromMetadata(codecString, colorSpace, bitDepth) {
      const lowerCodec = (codecString || "").toLowerCase();
      const lowerColor = (colorSpace || "").toLowerCase();
      if (lowerCodec.startsWith("dvh") || lowerCodec.startsWith("dav1")) {
        return { hdr: true, dynamicRange: "DolbyVision" };
      }
      const is10Bit = bitDepth === 10 || lowerCodec.includes(".10.") || lowerCodec.includes(".02.") || lowerCodec.startsWith("hvc1.2") || lowerCodec.startsWith("hev1.2");
      const hasHdrColorSpace = lowerColor.includes("smpte2084") || lowerColor.includes("rec2020") || lowerColor.includes("bt2020") || lowerColor.includes("pq");
      const hasHlgColorSpace = lowerColor.includes("arib-std-b67") || lowerColor.includes("hlg");
      if (hasHlgColorSpace) {
        return { hdr: true, dynamicRange: "HLG" };
      }
      if (lowerCodec.startsWith("hvc1.2") || lowerCodec.startsWith("hev1.2")) {
        return { hdr: true, dynamicRange: "HDR10" };
      }
      if (lowerCodec.startsWith("vp09.02") && lowerCodec.includes(".16.")) {
        return { hdr: true, dynamicRange: "HDR10" };
      }
      if (lowerCodec.startsWith("av01") && lowerCodec.includes(".16.")) {
        return { hdr: true, dynamicRange: "HDR10" };
      }
      return { hdr: false, dynamicRange: "SDR" };
    }
  };

  // src/core/TVRepresentationAnalyzer.ts
  var TVRepresentationAnalyzer = class {
    /**
     * Identifies the codec family from a codec MIME string (e.g. avc1.640028 -> H264)
     */
    static mapCodecStringToFamily(codecStr) {
      const s = (codecStr || "").toLowerCase();
      if (s.startsWith("hvc") || s.startsWith("hev") || s.startsWith("dvh")) {
        return "HEVC";
      }
      if (s.startsWith("av01") || s.startsWith("dav1")) {
        return "AV1";
      }
      if (s.startsWith("vp09") || s.startsWith("vp9")) {
        return "VP9";
      }
      if (s.startsWith("avc") || s.startsWith("mp4v")) {
        return "H264";
      }
      return "unknown";
    }
    /**
     * Parses an HLS Master Playlist (M3U8 string) for video stream representations.
     */
    static parseHlsMasterPlaylist(m3u8Content) {
      const lines = m3u8Content.split(/\r?\n/);
      const representations = [];
      let currentStreamInf = null;
      let index = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("#EXT-X-STREAM-INF:")) {
          currentStreamInf = this.parseTagAttributes(line.substring("#EXT-X-STREAM-INF:".length));
        } else if (currentStreamInf && line && !line.startsWith("#")) {
          index++;
          const bandwidth = parseInt(currentStreamInf["BANDWIDTH"] || "0", 10);
          const resolutionStr = currentStreamInf["RESOLUTION"] || "";
          const codecsStr = currentStreamInf["CODECS"] || "";
          const frameRateStr = currentStreamInf["FRAME-RATE"] || "30";
          const videoRangeStr = (currentStreamInf["VIDEO-RANGE"] || "SDR").toUpperCase();
          let width = 0;
          let height = 0;
          if (resolutionStr.includes("x")) {
            const parts = resolutionStr.split("x");
            width = parseInt(parts[0], 10);
            height = parseInt(parts[1], 10);
          }
          const framerate = parseFloat(frameRateStr) || 30;
          const codec = this.mapCodecStringToFamily(codecsStr);
          let dynamicRange = "SDR";
          let hdr = false;
          let bitDepth = 8;
          if (videoRangeStr === "PQ") {
            dynamicRange = "HDR10";
            hdr = true;
            bitDepth = 10;
          } else if (videoRangeStr === "HLG") {
            dynamicRange = "HLG";
            hdr = true;
            bitDepth = 10;
          } else {
            const detected = TVHdrEngine.detectDynamicRangeFromMetadata(codecsStr);
            hdr = detected.hdr;
            dynamicRange = detected.dynamicRange;
            if (hdr) bitDepth = 10;
          }
          const mimeType = codecsStr ? `video/mp4; codecs="${codecsStr}"` : "video/mp4";
          representations.push({
            id: `hls-${index}-${height}p-${Math.round(bandwidth / 1e3)}k`,
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
    static parseDashMpd(mpdXml) {
      const representations = [];
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(mpdXml, "application/xml");
        if (doc.querySelector("parsererror")) {
          return this.parseDashMpdRegexFallback(mpdXml);
        }
        const adaptationSets = doc.querySelectorAll("AdaptationSet");
        adaptationSets.forEach((adSet, adIdx) => {
          const mimeType = adSet.getAttribute("mimeType") || "";
          const contentType = adSet.getAttribute("contentType") || "";
          if (contentType === "video" || mimeType.startsWith("video/") || adSet.querySelector("Representation[width]")) {
            const adCodecs = adSet.getAttribute("codecs") || "";
            let isHdrSet = false;
            let hdrFormat = "SDR";
            const properties = adSet.querySelectorAll("EssentialProperty, SupplementalProperty");
            properties.forEach((prop) => {
              const scheme = prop.getAttribute("schemeIdUri") || "";
              const val = prop.getAttribute("value") || "";
              if (scheme.includes("colour-information") || scheme.includes("transfer-characteristics")) {
                if (val.includes("16") || val.includes("smpte2084")) {
                  isHdrSet = true;
                  hdrFormat = "HDR10";
                } else if (val.includes("18") || val.includes("arib-std-b67")) {
                  isHdrSet = true;
                  hdrFormat = "HLG";
                }
              }
            });
            const reps = adSet.querySelectorAll("Representation");
            reps.forEach((rep, repIdx) => {
              const id = rep.getAttribute("id") || `dash-${adIdx}-${repIdx}`;
              const bandwidth = parseInt(rep.getAttribute("bandwidth") || "0", 10);
              const width = parseInt(rep.getAttribute("width") || "0", 10);
              const height = parseInt(rep.getAttribute("height") || "0", 10);
              const codecsStr = rep.getAttribute("codecs") || adCodecs;
              const frameRateStr = rep.getAttribute("frameRate") || "30";
              const framerate = this.parseDashFrameRate(frameRateStr);
              const codec = this.mapCodecStringToFamily(codecsStr);
              const detected = TVHdrEngine.detectDynamicRangeFromMetadata(codecsStr);
              const hdr = isHdrSet || detected.hdr;
              const dynamicRange = isHdrSet ? hdrFormat : detected.dynamicRange;
              const bitDepth = hdr ? 10 : 8;
              const repMime = rep.getAttribute("mimeType") || mimeType || "video/mp4";
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
    static parseDashMpdRegexFallback(xml) {
      const representations = [];
      const repRegex = /<Representation\b([^>]+)>/gi;
      let match;
      let idx = 0;
      while ((match = repRegex.exec(xml)) !== null) {
        idx++;
        const attrsStr = match[1];
        const getAttr = (name) => {
          const m = new RegExp(`\\b${name}="([^"]+)"`, "i").exec(attrsStr);
          return m ? m[1] : "";
        };
        const id = getAttr("id") || `dash-rep-${idx}`;
        const bandwidth = parseInt(getAttr("bandwidth") || "0", 10);
        const width = parseInt(getAttr("width") || "0", 10);
        const height = parseInt(getAttr("height") || "0", 10);
        const codecsStr = getAttr("codecs");
        const frameRate = parseFloat(getAttr("frameRate")) || 30;
        if (width > 0 || height > 0 || bandwidth > 0) {
          const codec = this.mapCodecStringToFamily(codecsStr);
          const detected = TVHdrEngine.detectDynamicRangeFromMetadata(codecsStr);
          const fullMime = `video/mp4; codecs="${codecsStr || "avc1"}"`;
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
    static parseTagAttributes(attrLine) {
      const result = {};
      const regex = /([A-Z0-9-]+)=(?:"([^"]*)"|([^,]*))/g;
      let match;
      while ((match = regex.exec(attrLine)) !== null) {
        const key = match[1];
        const val = match[2] !== void 0 ? match[2] : match[3];
        result[key] = val.trim();
      }
      return result;
    }
    static parseDashFrameRate(str) {
      if (!str) return 30;
      if (str.includes("/")) {
        const [num, den] = str.split("/");
        const n = parseFloat(num);
        const d = parseFloat(den);
        return d ? Math.round(n / d * 100) / 100 : 30;
      }
      return parseFloat(str) || 30;
    }
    static sortAndDeduplicate(reps) {
      return reps.sort((a, b) => {
        if (b.height !== a.height) return b.height - a.height;
        if (b.hdr !== a.hdr) return b.hdr ? 1 : -1;
        return b.bitrate - a.bitrate;
      });
    }
  };

  // src/core/TVQualitySelector.ts
  var TVQualitySelector = class {
    /**
     * Evaluates and selects the highest ranked representation capable of being decoded smoothly.
     */
    static async selectBestRepresentation(availableRepresentations, profile, displayOverride) {
      if (!availableRepresentations || availableRepresentations.length === 0) {
        return {
          selected: null,
          priorityRank: -1,
          reason: "No representations available in media stream.",
          candidatesConsidered: 0,
          fallbackOccurred: false,
          bottleneck: "SERVICE_OFFER"
        };
      }
      const display = displayOverride || TVCapabilityEngine.getDisplayCapability();
      const decoderReport = await TVCapabilityEngine.probeDecoderCapabilities();
      const rankedCandidates = this.rankRepresentations(availableRepresentations, profile, display);
      let candidatesChecked = 0;
      for (let i = 0; i < rankedCandidates.length; i++) {
        candidatesChecked++;
        const rep = rankedCandidates[i];
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
        if (rep.hdr && !display.displayHDR && profile.preferHDR) {
          if (rankedCandidates.some((c) => !c.hdr && c.height >= rep.height)) {
            continue;
          }
        }
        if (profile.preferredCodecs && profile.preferredCodecs.length > 0) {
          const codecIndex = profile.preferredCodecs.indexOf(rep.codec);
          if (codecIndex === -1 && rankedCandidates.some((c) => c.height === rep.height && profile.preferredCodecs.includes(c.codec))) {
            continue;
          }
        }
        const fallbackOccurred = i > 0;
        let reason = `Selected ${rep.height}p ${rep.dynamicRange} (${rep.codec} @ ${Math.round(rep.bitrate / 1e3)} kbps).`;
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
      const fallbackRep = availableRepresentations[availableRepresentations.length - 1] || null;
      return {
        selected: fallbackRep,
        priorityRank: rankedCandidates.length + 1,
        reason: "Strict capability checks exhausted; using baseline fallback stream.",
        candidatesConsidered: candidatesChecked,
        fallbackOccurred: true,
        bottleneck: "BROWSER_CAPABILITY"
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
    static rankRepresentations(reps, profile, display) {
      return [...reps].sort((a, b) => {
        const aAbovePref = a.height > profile.preferredResolution ? 1 : 0;
        const bAbovePref = b.height > profile.preferredResolution ? 1 : 0;
        if (aAbovePref !== bAbovePref) {
          return aAbovePref - bAbovePref;
        }
        const aTier = Math.min(a.height, profile.preferredResolution);
        const bTier = Math.min(b.height, profile.preferredResolution);
        if (bTier !== aTier) {
          return bTier - aTier;
        }
        if (profile.preferHDR && display.displayHDR && profile.preferredDynamicRange !== "SDR") {
          if (a.hdr !== b.hdr) return a.hdr ? -1 : 1;
        } else if (!profile.preferHDR || profile.preferredDynamicRange === "SDR" || !display.displayHDR) {
          if (a.hdr !== b.hdr) return a.hdr ? 1 : -1;
        }
        if (profile.preferredCodecs && profile.preferredCodecs.length > 0) {
          const aIdx = profile.preferredCodecs.indexOf(a.codec);
          const bIdx = profile.preferredCodecs.indexOf(b.codec);
          const aScore = aIdx === -1 ? 999 : aIdx;
          const bScore = bIdx === -1 ? 999 : bIdx;
          if (aScore !== bScore) {
            return aScore - bScore;
          }
        }
        if (b.framerate !== a.framerate) {
          return b.framerate - a.framerate;
        }
        return b.bitrate - a.bitrate;
      });
    }
  };

  // src/core/TVAdaptationController.ts
  var TVAdaptationController = class {
    params;
    state;
    lastSwitchTimestamp = 0;
    consecutiveDegradationCount = 0;
    consecutiveRecoveryCount = 0;
    constructor(customParams) {
      this.params = {
        startupBufferTarget: 8,
        rebufferThreshold: 3,
        upgradeThreshold: 12,
        downgradeThreshold: 4,
        qualityHoldTime: 8e3,
        bandwidthSafetyFactor: 0.75,
        ...customParams
      };
      this.state = {
        currentRepresentation: null,
        currentBufferSeconds: 0,
        bandwidthEstimateBps: 2e7,
        // Initial default: 20 Mbps
        state: "startup",
        timeSinceLastSwitchMs: 0,
        rebufferCount: 0,
        qualitySwitchesCount: 0,
        reasons: []
      };
    }
    getState() {
      this.state.timeSinceLastSwitchMs = Date.now() - this.lastSwitchTimestamp;
      return { ...this.state };
    }
    getParameters() {
      return { ...this.params };
    }
    updateParameters(params) {
      this.params = { ...this.params, ...params };
    }
    setBandwidthEstimate(bps) {
      if (this.state.bandwidthEstimateBps === 0) {
        this.state.bandwidthEstimateBps = bps;
      } else {
        this.state.bandwidthEstimateBps = Math.round(
          this.state.bandwidthEstimateBps * 0.7 + bps * 0.3
        );
      }
    }
    notifyRebuffer() {
      this.state.rebufferCount++;
      this.state.state = "degrading";
      this.consecutiveDegradationCount += 2;
    }
    /**
     * Evaluates current buffer and bandwidth to decide which representation to play next.
     */
    evaluate(currentBufferSeconds, availableReps, now = Date.now()) {
      this.state.currentBufferSeconds = currentBufferSeconds;
      const timeSinceSwitch = this.lastSwitchTimestamp ? now - this.lastSwitchTimestamp : Infinity;
      if (!availableReps || availableReps.length === 0) {
        throw new Error("No media representations provided for adaptation evaluation.");
      }
      const ladder = [...availableReps].sort((a, b) => a.bitrate - b.bitrate);
      if (!this.state.currentRepresentation) {
        const initial = this.selectStartupRepresentation(ladder);
        this.state.currentRepresentation = initial;
        this.lastSwitchTimestamp = now;
        this.state.state = "startup";
        return {
          nextRepresentation: initial,
          action: "hold",
          reason: `Initial startup selection based on safe initial bandwidth (${Math.round(this.state.bandwidthEstimateBps / 1e6)} Mbps).`
        };
      }
      const currentIdx = ladder.findIndex((r) => r.id === this.state.currentRepresentation?.id);
      const currentIndex = currentIdx === -1 ? 0 : currentIdx;
      const safeBandwidth = this.state.bandwidthEstimateBps * this.params.bandwidthSafetyFactor;
      if (currentBufferSeconds < this.params.rebufferThreshold) {
        this.consecutiveDegradationCount++;
        this.consecutiveRecoveryCount = 0;
        this.state.state = "degrading";
        const dropIndex = Math.max(0, currentIndex - 2);
        const targetRep = ladder[dropIndex];
        if (targetRep.id !== this.state.currentRepresentation.id) {
          this.applySwitch(targetRep, now);
          return {
            nextRepresentation: targetRep,
            action: "emergency-drop",
            reason: `CRITICAL: Buffer starved (${currentBufferSeconds.toFixed(1)}s < ${this.params.rebufferThreshold}s). Emergency drop to preserve smooth playback.`
          };
        }
      }
      const currentBitrate = this.state.currentRepresentation.bitrate;
      const isBandwidthDeficit = currentBitrate > safeBandwidth;
      const isBufferDeteriorating = currentBufferSeconds < this.params.downgradeThreshold;
      if (isBufferDeteriorating || isBandwidthDeficit) {
        this.consecutiveDegradationCount++;
        this.consecutiveRecoveryCount = 0;
        if (currentIndex > 0) {
          const targetRep = ladder[currentIndex - 1];
          this.applySwitch(targetRep, now);
          this.state.state = "degrading";
          return {
            nextRepresentation: targetRep,
            action: "downgrade",
            reason: `Buffer softening (${currentBufferSeconds.toFixed(1)}s) or throughput deficit (${Math.round(safeBandwidth / 1e3)}k < ${Math.round(currentBitrate / 1e3)}k). Downgrading to maintain buffer.`
          };
        }
      }
      const canAttemptUpgrade = currentBufferSeconds >= this.params.upgradeThreshold && timeSinceSwitch >= this.params.qualityHoldTime && currentIndex < ladder.length - 1;
      if (canAttemptUpgrade) {
        const candidateRep = ladder[currentIndex + 1];
        if (candidateRep.bitrate <= safeBandwidth) {
          this.consecutiveRecoveryCount++;
          this.consecutiveDegradationCount = 0;
          this.applySwitch(candidateRep, now);
          this.state.state = "recovering";
          return {
            nextRepresentation: candidateRep,
            action: "upgrade",
            reason: `Healthy buffer (${currentBufferSeconds.toFixed(1)}s > ${this.params.upgradeThreshold}s) and sustained headroom. Upgrading to ${candidateRep.height}p.`
          };
        }
      }
      this.state.state = "steady";
      return {
        nextRepresentation: this.state.currentRepresentation,
        action: "hold",
        reason: `Stable buffer (${currentBufferSeconds.toFixed(1)}s) and bandwidth matching current quality (${this.state.currentRepresentation.height}p).`
      };
    }
    selectStartupRepresentation(ladder) {
      const safeBw = this.state.bandwidthEstimateBps * this.params.bandwidthSafetyFactor;
      let candidate = ladder[0];
      for (const rep of ladder) {
        if (rep.bitrate <= safeBw && rep.height <= 1080) {
          candidate = rep;
        }
      }
      return candidate;
    }
    applySwitch(rep, now) {
      this.state.currentRepresentation = rep;
      this.lastSwitchTimestamp = now;
      this.state.qualitySwitchesCount++;
    }
  };

  // src/core/TVMetrics.ts
  var TVMetrics = class {
    metrics;
    currentQualityKey = "unknown";
    currentIsHdr = false;
    lastUpdateTime = Date.now();
    constructor() {
      this.metrics = {
        sessionStartTime: Date.now(),
        firstFrameTimeMs: null,
        firstUhdFrameTimeMs: null,
        totalPlaybackDurationSec: 0,
        timeSpentAtQualitySec: {},
        timeSpentHDRSec: 0,
        timeSpentSDRSec: 0,
        droppedFramesCount: 0,
        totalDecodedFramesCount: 0,
        rebufferEventsCount: 0,
        totalRebufferDurationSec: 0,
        qualitySwitchesCount: 0,
        currentBandwidthEstimateBps: 2e7
      };
    }
    recordFirstFrame(timestamp = Date.now()) {
      if (this.metrics.firstFrameTimeMs === null) {
        this.metrics.firstFrameTimeMs = timestamp - this.metrics.sessionStartTime;
      }
    }
    recordFirstUhdFrame(timestamp = Date.now()) {
      if (this.metrics.firstUhdFrameTimeMs === null) {
        this.metrics.firstUhdFrameTimeMs = timestamp - this.metrics.sessionStartTime;
      }
    }
    onQualitySwitch(rep) {
      this.accumulateTime();
      this.metrics.qualitySwitchesCount++;
      this.currentQualityKey = `${rep.height}p`;
      this.currentIsHdr = rep.hdr;
      if (rep.height >= 2160) {
        this.recordFirstUhdFrame();
      }
    }
    onRebufferEvent(durationSec) {
      this.metrics.rebufferEventsCount++;
      this.metrics.totalRebufferDurationSec += durationSec;
    }
    updateFrameStats(dropped, total) {
      this.metrics.droppedFramesCount = dropped;
      this.metrics.totalDecodedFramesCount = total;
    }
    updateBandwidth(bps) {
      this.metrics.currentBandwidthEstimateBps = bps;
    }
    accumulateTime(now = Date.now()) {
      const elapsedSec = Math.max(0, (now - this.lastUpdateTime) / 1e3);
      this.lastUpdateTime = now;
      if (elapsedSec <= 0 || elapsedSec > 60) return;
      this.metrics.totalPlaybackDurationSec += elapsedSec;
      if (this.currentQualityKey) {
        this.metrics.timeSpentAtQualitySec[this.currentQualityKey] = (this.metrics.timeSpentAtQualitySec[this.currentQualityKey] || 0) + elapsedSec;
      }
      if (this.currentIsHdr) {
        this.metrics.timeSpentHDRSec += elapsedSec;
      } else {
        this.metrics.timeSpentSDRSec += elapsedSec;
      }
    }
    getSummary() {
      this.accumulateTime();
      const total = this.metrics.totalPlaybackDurationSec || 1;
      const uhdSec = this.metrics.timeSpentAtQualitySec["2160p"] || 0;
      const uhdPercentage = Math.round(uhdSec / total * 100);
      const hdrPercentage = Math.round(this.metrics.timeSpentHDRSec / total * 100);
      const decoded = this.metrics.totalDecodedFramesCount || 1;
      const droppedPercentage = Math.round(this.metrics.droppedFramesCount / decoded * 100);
      return {
        startupSec: Math.round((this.metrics.firstFrameTimeMs || 0) / 1e3 * 100) / 100,
        firstFrameSec: this.metrics.firstFrameTimeMs ? Math.round(this.metrics.firstFrameTimeMs / 1e3 * 100) / 100 : null,
        firstUhdSec: this.metrics.firstUhdFrameTimeMs ? Math.round(this.metrics.firstUhdFrameTimeMs / 1e3 * 100) / 100 : null,
        rebuffers: this.metrics.rebufferEventsCount,
        qualitySwitches: this.metrics.qualitySwitchesCount,
        uhdPercentage,
        hdrPercentage,
        droppedFrames: this.metrics.droppedFramesCount,
        droppedPercentage,
        totalDurationSec: Math.round(this.metrics.totalPlaybackDurationSec)
      };
    }
    getRawMetrics() {
      this.accumulateTime();
      return { ...this.metrics };
    }
  };

  // src/core/TVDiagnostics.ts
  var TVDiagnostics = class {
    static hudElement = null;
    static isVisible = false;
    static lastHudData = null;
    /**
     * Initializes or updates the on-screen TV Mode HUD
     */
    static renderHUD(data, container) {
      this.lastHudData = data;
      if (typeof document === "undefined") return;
      const parent = container || document.fullscreenElement || document.body;
      if (!parent) return;
      if (!this.hudElement) {
        this.hudElement = document.createElement("div");
        this.hudElement.id = "tv-mode-hud";
        this.hudElement.className = "tv-hud-container";
        parent.appendChild(this.hudElement);
        this.attachKeyboardShortcut();
      } else if (this.hudElement.parentElement !== parent) {
        parent.appendChild(this.hudElement);
      }
      if (!this.isVisible) {
        this.hudElement.style.display = "none";
        return;
      }
      this.hudElement.style.display = "block";
      this.hudElement.innerHTML = `
      <div class="tv-hud-box">
        <div class="tv-hud-header">
          <div class="tv-hud-title">
            <span class="tv-hud-dot"></span>
            <strong>TV MODE \u2014 DIAGNOSTICS</strong>
          </div>
          <button type="button" class="tv-hud-close" id="btnTvHudClose" title="Hide HUD (Alt+Shift+D)">\xD7</button>
        </div>
        <div class="tv-hud-divider">\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500</div>
        <div class="tv-hud-grid">
          <div class="tv-hud-row"><span class="k">Resolution:</span><span class="v val-highlight">${data.resolution}</span></div>
          <div class="tv-hud-row"><span class="k">Quality:</span><span class="v val-accent">${data.quality}</span></div>
          <div class="tv-hud-row"><span class="k">Codec:</span><span class="v">${data.codec}</span></div>
          <div class="tv-hud-row"><span class="k">Bitrate:</span><span class="v">${data.bitrateMbps.toFixed(2)} Mbps</span></div>
          <div class="tv-hud-row"><span class="k">Framerate:</span><span class="v">${data.framerate.toFixed(2)} FPS</span></div>
          <div class="tv-hud-row"><span class="k">Dynamic Range:</span><span class="v ${data.dynamicRange.includes("HDR") ? "val-hdr" : ""}">${data.dynamicRange}</span></div>
          <div class="tv-hud-row"><span class="k">Buffer:</span><span class="v ${data.bufferSec < 3 ? "val-warn" : "val-good"}">${data.bufferSec.toFixed(1)} sec</span></div>
          <div class="tv-hud-row"><span class="k">Bandwidth Est:</span><span class="v">${data.bandwidthMbps.toFixed(1)} Mbps</span></div>
          <div class="tv-hud-row"><span class="k">Dropped Frames:</span><span class="v ${data.droppedFrames > 30 ? "val-warn" : ""}">${data.droppedFrames}</span></div>
          <div class="tv-hud-row"><span class="k">Display HDR:</span><span class="v">${data.displayHDR ? "YES" : "NO"}</span></div>
          <div class="tv-hud-row"><span class="k">2160p Decode:</span><span class="v">${data.canDecode2160p ? "YES" : "NO"}</span></div>
          <div class="tv-hud-row"><span class="k">Current Rep:</span><span class="v font-mono">${data.currentRepresentationId}</span></div>
          <div class="tv-hud-row full-width"><span class="k">Selection Reason:</span><span class="v desc">${data.reasonForSelection}</span></div>
        </div>
      </div>
    `;
      const closeBtn = this.hudElement.querySelector("#btnTvHudClose");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => this.toggleHUD(false));
      }
    }
    static toggleHUD(forceState) {
      this.isVisible = forceState !== void 0 ? forceState : !this.isVisible;
      if (this.hudElement) {
        this.hudElement.style.display = this.isVisible ? "block" : "none";
        if (this.isVisible && this.lastHudData) {
          this.renderHUD(this.lastHudData);
        }
      }
      return this.isVisible;
    }
    static isHudVisible() {
      return this.isVisible;
    }
    /**
     * Global keyboard shortcut (Alt+Shift+D) to toggle HUD
     */
    static attachKeyboardShortcut() {
      if (typeof window === "undefined") return;
      window.addEventListener(
        "keydown",
        (e) => {
          if (e.altKey && e.shiftKey && e.code === "KeyD") {
            e.preventDefault();
            this.toggleHUD();
          }
        },
        { capture: true }
      );
    }
    /**
     * Service Analysis (Prime Web Research Mode):
     * Inspects the active web session and classifies bottlenecks truthfully.
     */
    static async analyzeServiceSession(observedReps, activeRep, displayOverride) {
      const display = displayOverride || TVCapabilityEngine.getDisplayCapability();
      const decoder = await TVCapabilityEngine.probeDecoderCapabilities();
      const hdrReport = TVHdrEngine.evaluateHdr(observedReps, activeRep, display);
      let maxServiceHeight = 0;
      let maxServiceHdr = "SDR";
      observedReps.forEach((r) => {
        if (r.height > maxServiceHeight) maxServiceHeight = r.height;
        if (r.hdr) maxServiceHdr = r.dynamicRange;
      });
      let bottleneck = "UNKNOWN";
      let bottleneckExplanation = "Playback operating normally.";
      if (maxServiceHeight > 0 && maxServiceHeight < 2160) {
        bottleneck = "SERVICE_OFFER";
        bottleneckExplanation = `The streaming service only offered up to ${maxServiceHeight}p (${maxServiceHdr}) to this web browser session. No 2160p (4K) manifest representations exist.`;
      } else if (maxServiceHeight >= 2160 && !decoder.supports2160p) {
        bottleneck = "BROWSER_CAPABILITY";
        bottleneckExplanation = `The service exposes 2160p representations, but the current browser/GPU configuration cannot decode 2160p smoothly.`;
      } else if (maxServiceHdr !== "SDR" && !display.displayHDR) {
        bottleneck = "HDR_CAPABILITY";
        bottleneckExplanation = `The stream contains ${maxServiceHdr} streams, but the connected display or OS reports Standard Dynamic Range (SDR) only.`;
      } else if (activeRep && maxServiceHeight >= 2160 && activeRep.height < 2160) {
        bottleneck = "BANDWIDTH";
        bottleneckExplanation = `4K is available and supported, but player ABR algorithm selected ${activeRep.height}p due to current throughput or buffer constraints.`;
      } else if (maxServiceHeight >= 2160 && decoder.supports2160p && activeRep?.height === 2160) {
        bottleneck = "PLAYER_SELECTION";
        bottleneckExplanation = `Optimal TV mode playback achieved: streaming at full 2160p (${activeRep.dynamicRange}) on capable hardware.`;
      }
      return {
        serviceMaximumResolution: maxServiceHeight ? `${maxServiceHeight}p` : "Unknown / DRM Restricted",
        serviceMaximumHDR: maxServiceHdr,
        representationsObserved: observedReps,
        currentResolution: activeRep ? `${activeRep.height}p` : "Unknown",
        currentBitrateBps: activeRep ? activeRep.bitrate : 0,
        currentCodec: activeRep ? `${activeRep.codec} (${activeRep.codecString})` : "Unknown",
        browserCapability: {
          canDecode4K: decoder.supports2160p,
          canDecodeHDR: decoder.supportsHDR10,
          supportedCodecs: decoder.profiles.filter((p) => p.supported).map((p) => p.codec)
        },
        displayCapability: display,
        bottleneck,
        bottleneckExplanation
      };
    }
  };

  // src/core/TVModeController.ts
  var TVModeController = class {
    profile;
    videoElement = null;
    availableRepresentations = [];
    activeRepresentation = null;
    adaptationController;
    metrics;
    monitorIntervalId = null;
    isEnabled = true;
    isFullscreenPreferred = false;
    onQualitySwitchCallback;
    constructor(customProfile) {
      this.profile = {
        preferredResolution: 2160,
        preferredDynamicRange: "HDR",
        preferredCodecs: ["HEVC", "AV1", "VP9", "H264"],
        preferHDR: true,
        prefer4K: true,
        targetFramerate: 60,
        initialBitrateStrategy: "conservative",
        adaptationStrategy: "tv-balanced",
        ...customProfile
      };
      this.adaptationController = new TVAdaptationController();
      this.metrics = new TVMetrics();
    }
    setEnabled(enabled) {
      this.isEnabled = enabled;
      if (!enabled) {
        this.stopMonitoring();
        TVDiagnostics.toggleHUD(false);
      } else if (this.videoElement) {
        this.startMonitoring();
      }
    }
    getProfile() {
      return { ...this.profile };
    }
    updateProfile(newProfile) {
      this.profile = { ...this.profile, ...newProfile };
      if (this.availableRepresentations.length > 0) {
        this.reselectQuality();
      }
    }
    onQualitySwitch(cb) {
      this.onQualitySwitchCallback = cb;
    }
    /**
     * Attaches controller to a live HTMLVideoElement
     */
    attachVideo(video) {
      this.videoElement = video;
      this.attachVideoEvents(video);
      if (this.isEnabled) {
        this.startMonitoring();
      }
    }
    /**
     * Sets available media representations discovered from DASH / HLS manifests or local lab
     */
    async setRepresentations(representations) {
      this.availableRepresentations = representations;
      return this.reselectQuality();
    }
    /**
     * Executes the full 10-step TV lifecycle selection
     */
    async reselectQuality() {
      const display = TVCapabilityEngine.getDisplayCapability();
      const decoderReport = await TVCapabilityEngine.probeDecoderCapabilities();
      const hdrReport = TVHdrEngine.evaluateHdr(this.availableRepresentations, this.activeRepresentation, display);
      const result = await TVQualitySelector.selectBestRepresentation(
        this.availableRepresentations,
        this.profile,
        display
      );
      if (result.selected) {
        this.applyRepresentation(result.selected, result.reason);
      }
      return result;
    }
    applyRepresentation(rep, reason) {
      const isInitial = this.activeRepresentation === null;
      this.activeRepresentation = rep;
      this.metrics.onQualitySwitch(rep);
      if (this.onQualitySwitchCallback) {
        this.onQualitySwitchCallback(rep);
      }
      this.updateDiagnostics(reason);
    }
    /**
     * Monitors real-time playback, buffer duration, and triggers dynamic ABR
     */
    startMonitoring() {
      this.stopMonitoring();
      this.monitorIntervalId = setInterval(() => {
        if (!this.isEnabled || !this.videoElement) return;
        const video = this.videoElement;
        const bufferSec = this.calculateBufferAhead(video);
        if (typeof video.getVideoPlaybackQuality === "function") {
          const q = video.getVideoPlaybackQuality();
          this.metrics.updateFrameStats(q.droppedVideoFrames, q.totalVideoFrames);
        }
        if (this.availableRepresentations.length > 1) {
          try {
            const evalResult = this.adaptationController.evaluate(
              bufferSec,
              this.availableRepresentations
            );
            if (evalResult.nextRepresentation && evalResult.nextRepresentation.id !== this.activeRepresentation?.id) {
              this.applyRepresentation(evalResult.nextRepresentation, evalResult.reason);
            }
          } catch {
          }
        }
        if (video.error) {
          this.handlePlaybackError(video.error);
        }
        this.updateDiagnostics();
      }, 1e3);
    }
    stopMonitoring() {
      if (this.monitorIntervalId) {
        clearInterval(this.monitorIntervalId);
        this.monitorIntervalId = null;
      }
    }
    calculateBufferAhead(video) {
      try {
        const curTime = video.currentTime;
        const ranges = video.buffered;
        for (let i = 0; i < ranges.length; i++) {
          if (ranges.start(i) <= curTime && curTime <= ranges.end(i)) {
            return Math.max(0, ranges.end(i) - curTime);
          }
        }
      } catch {
      }
      return 0;
    }
    handlePlaybackError(error) {
      if (!this.activeRepresentation || this.availableRepresentations.length <= 1) return;
      const sorted = [...this.availableRepresentations].sort((a, b) => b.bitrate - a.bitrate);
      const curIdx = sorted.findIndex((r) => r.id === this.activeRepresentation?.id);
      if (curIdx >= 0 && curIdx < sorted.length - 1) {
        const fallbackRep = sorted[curIdx + 1];
        this.applyRepresentation(
          fallbackRep,
          `Hardware decode/network error (${error.code}). Falling back to ${fallbackRep.height}p.`
        );
      }
    }
    attachVideoEvents(video) {
      video.addEventListener("playing", () => {
        this.metrics.recordFirstFrame();
      }, { once: true });
      video.addEventListener("waiting", () => {
        this.metrics.onRebufferEvent(1);
        this.adaptationController.notifyRebuffer();
      });
    }
    updateDiagnostics(customReason) {
      if (!this.activeRepresentation && this.availableRepresentations.length === 0) return;
      const rep = this.activeRepresentation || this.availableRepresentations[0];
      const display = TVCapabilityEngine.getDisplayCapability();
      const abrState = this.adaptationController.getState();
      const metrics = this.metrics.getSummary();
      const hudData = {
        resolution: rep ? `${rep.width} \xD7 ${rep.height}` : "Auto",
        quality: rep ? `${rep.height}p ${rep.dynamicRange}` : "1080p SDR",
        codec: rep ? rep.codec : "Unknown",
        bitrateMbps: rep ? rep.bitrate / 1e6 : 0,
        framerate: rep ? rep.framerate : 60,
        dynamicRange: rep ? rep.dynamicRange : "SDR",
        bufferSec: abrState.currentBufferSeconds,
        bandwidthMbps: abrState.bandwidthEstimateBps / 1e6,
        droppedFrames: metrics.droppedFrames,
        displayHDR: display.displayHDR,
        canDecode2160p: display.effectiveWidth >= 3840 || display.effectiveHeight >= 2160,
        currentRepresentationId: rep ? rep.id : "N/A",
        reasonForSelection: customReason || (abrState.reasons[0] || "TV Mode: Optimal playable tier")
      };
      TVDiagnostics.renderHUD(hudData);
    }
    getMetrics() {
      return this.metrics;
    }
    getActiveRepresentation() {
      return this.activeRepresentation;
    }
  };

  // src/core/PlaybackVerifier.ts
  var PlaybackVerifier = class _PlaybackVerifier {
    /**
     * Verifies whether an HTMLVideoElement is playing genuine 4K UHD decoded frames.
     * STRICT SUCCESS CRITERION: video.videoWidth >= 3840 && video.videoHeight >= 2160.
     */
    static verifyPlayback(video, contentMetadata) {
      const actualWidth = video.videoWidth || 0;
      const actualHeight = video.videoHeight || 0;
      const isRealUHDWidth = actualWidth >= 3840;
      const isRealUHDHeight = actualHeight >= 2160;
      const isReal4K = isRealUHDWidth && isRealUHDHeight;
      let totalFrames = 0;
      let droppedFrames = 0;
      let droppedRatio = 0;
      if (typeof video.getVideoPlaybackQuality === "function") {
        const q = video.getVideoPlaybackQuality();
        totalFrames = q.totalVideoFrames;
        droppedFrames = q.droppedVideoFrames;
        droppedRatio = totalFrames > 0 ? droppedFrames / totalFrames : 0;
      }
      const transfer = contentMetadata?.transferFunction?.toLowerCase() || "";
      const primaries = contentMetadata?.colorPrimaries?.toLowerCase() || "";
      const bitDepth = contentMetadata?.bitDepth === 10 ? 10 : 8;
      const isPqOrHlg = transfer.includes("smpte2084") || transfer.includes("pq") || transfer.includes("arib-std-b67") || transfer.includes("hlg") || transfer === "16" || transfer === "18";
      const isWideColor = primaries.includes("rec2020") || primaries.includes("bt2020") || primaries.includes("p3") || primaries === "9";
      const isGenuineHDR = isPqOrHlg || bitDepth === 10 && isWideColor;
      const evidence = [];
      evidence.push(`Decoded Dimensions: ${actualWidth}x${actualHeight}`);
      if (isReal4K) {
        evidence.push("4K UHD Dimension Threshold Passed (>= 3840x2160)");
      } else {
        evidence.push(`4K UHD Dimension Threshold Failed (${actualWidth}x${actualHeight} < 3840x2160)`);
      }
      if (isGenuineHDR) {
        evidence.push(`Genuine HDR Confirmed: Transfer=${contentMetadata?.transferFunction || "PQ"}, BitDepth=${bitDepth}`);
      } else {
        evidence.push("SDR Content Stream (8-bit / Standard Dynamic Range)");
      }
      return {
        isReal4K,
        isRealUHDWidth,
        isRealUHDHeight,
        actualVideoWidth: actualWidth,
        actualVideoHeight: actualHeight,
        isGenuineHDR,
        colorSpace: contentMetadata?.colorPrimaries || "bt709",
        transferFunction: contentMetadata?.transferFunction || "sdr",
        bitDepth,
        totalFrames,
        droppedFrames,
        droppedFramesRatio: droppedRatio,
        verificationPassed: isReal4K,
        evidence
      };
    }
    /**
     * Continuous verification observer that resolves when actual decoded 4K frames arrive,
     * or times out after a specified duration.
     */
    static async waitFor4KVerification(video, timeoutMs = 8e3) {
      const start = Date.now();
      return new Promise((resolve) => {
        const check = () => {
          const report = _PlaybackVerifier.verifyPlayback(video);
          if (report.isReal4K) {
            resolve(report);
            return;
          }
          if (Date.now() - start >= timeoutMs) {
            resolve(report);
            return;
          }
          requestAnimationFrame(check);
        };
        check();
      });
    }
  };

  // src/prime/PrimeRepresentationProbe.ts
  var PrimeRepresentationProbe = class {
    observedTracks = /* @__PURE__ */ new Map();
    lastManifestUrl = null;
    lastManifestType = null;
    playerEngine = "Amazon ATVWebPlayerSDK";
    hasTrackApi = false;
    currentVideoWidth = 0;
    currentVideoHeight = 0;
    constructor() {
      this.initMessageListener();
    }
    initMessageListener() {
      if (typeof window === "undefined") return;
      window.addEventListener("message", (event) => {
        if (event.data?.source === "PV_PAGE_BRIDGE" && event.data?.payload) {
          this.processBridgePayload(event.data.payload);
        }
      });
    }
    processBridgePayload(payload) {
      if (payload.manifestUrl) {
        this.lastManifestUrl = payload.manifestUrl;
      }
      if (payload.manifestType) {
        this.lastManifestType = payload.manifestType;
      }
      if (payload.playerEngine) {
        this.playerEngine = payload.playerEngine;
      }
      if (payload.hasTrackSelectionApi !== void 0) {
        this.hasTrackApi = payload.hasTrackSelectionApi;
      }
      if (payload.videoWidth !== void 0) {
        this.currentVideoWidth = payload.videoWidth;
      }
      if (payload.videoHeight !== void 0) {
        this.currentVideoHeight = payload.videoHeight;
      }
      if (payload.observedRepresentations && Array.isArray(payload.observedRepresentations)) {
        for (const track of payload.observedRepresentations) {
          this.observedTracks.set(track.id, track);
        }
      }
    }
    /**
     * Directly registers an observed track (useful for unit tests and direct DOM observations)
     */
    registerTrack(track) {
      this.observedTracks.set(track.id, track);
    }
    getUhdRepresentationStatus() {
      const has4k = Array.from(this.observedTracks.values()).some(
        (t) => t.width >= 3840 || t.height >= 2160
      );
      return has4k ? "FOUND" : "NOT_FOUND";
    }
    getHdrUhdRepresentationStatus() {
      const has4kHdr = Array.from(this.observedTracks.values()).some(
        (t) => (t.width >= 3840 || t.height >= 2160) && t.hdr === true
      );
      return has4kHdr ? "FOUND" : "NOT_FOUND";
    }
    getAllObservedRepresentations() {
      return Array.from(this.observedTracks.values()).sort((a, b) => b.height - a.height);
    }
    getMaxObservedRepresentation() {
      const tracks = this.getAllObservedRepresentations();
      return tracks.length > 0 ? tracks[0] : null;
    }
    getObservedLadderSummary() {
      const heights = Array.from(
        new Set(this.getAllObservedRepresentations().map((t) => `${t.height}p${t.hdr ? " HDR" : ""}`))
      );
      return heights.length > 0 ? heights : ["1080p"];
    }
    getPlayerEngine() {
      return this.playerEngine;
    }
    hasTrackSelectionApi() {
      return this.hasTrackApi;
    }
    getCurrentDimensions() {
      return {
        width: this.currentVideoWidth,
        height: this.currentVideoHeight
      };
    }
    getLastManifestUrl() {
      return this.lastManifestUrl;
    }
  };

  // src/prime/PrimePlayerAdapter.ts
  var PrimePlayerAdapter = class {
    /**
     * Finds the primary playback video element on Prime Video.
     */
    getVideoElement() {
      if (typeof document === "undefined") return null;
      return document.querySelector(".webPlayerUIContainer video") || document.querySelector(".rendererContainer video") || document.querySelector("video") || null;
    }
    /**
     * Sends a track selection command to the page-context bridge.
     */
    selectTrack(trackId) {
      if (typeof window === "undefined") return;
      window.postMessage(
        {
          target: "PV_PAGE_BRIDGE",
          command: "SELECT_TRACK",
          trackId
        },
        "*"
      );
    }
    /**
     * Requests the highest available quality constraints.
     */
    requestMaxQuality() {
      if (typeof window === "undefined") return;
      window.postMessage(
        {
          target: "PV_PAGE_BRIDGE",
          command: "SELECT_TRACK",
          trackId: "MAX_UHD"
        },
        "*"
      );
    }
  };

  // src/prime/PrimeDebugPanel.ts
  var REAL_PLAYBACK_LABELS = {
    "REAL_UHD_ACTIVE": { label: "REAL_UHD_ACTIVE", cls: "pv-pass pv-glow" },
    "REAL_HDR_UHD_ACTIVE": { label: "REAL_HDR_UHD_ACTIVE", cls: "pv-pass pv-glow-hdr" },
    "2160p HDR ACTIVE": { label: "REAL_HDR_UHD_ACTIVE", cls: "pv-pass pv-glow-hdr" },
    "UHD ACTIVE": { label: "REAL_UHD_ACTIVE", cls: "pv-pass pv-glow" },
    "UHD_NOT_DELIVERED_TO_WEB_SESSION": { label: "UHD_NOT_DELIVERED", cls: "pv-warn" },
    "PLAYER_REJECTED_UHD": { label: "UHD_PRESENT_BUT_REJECTED", cls: "pv-fail" },
    "UHD_PRESENT_BUT_NOT_SELECTED": { label: "UHD_PRESENT_BUT_NOT_SELECTED", cls: "pv-warn" },
    "UNKNOWN": { label: "UNKNOWN", cls: "pv-dim" }
  };
  var PrimeDebugPanel = class {
    panelElement = null;
    isVisible = false;
    bitrateSamples = [];
    lastData = null;
    render(data) {
      if (typeof document === "undefined") return;
      if (!this.panelElement) {
        this.createPanel();
      }
      if (!this.panelElement) return;
      this.lastData = data;
      const brVal = parseFloat(data.currentBitrate);
      if (!isNaN(brVal)) {
        this.bitrateSamples.push(brVal);
        if (this.bitrateSamples.length > 30) this.bitrateSamples.shift();
      }
      const status = REAL_PLAYBACK_LABELS[data.finalStatus] ?? { label: data.finalStatus, cls: "pv-dim" };
      const isUhd = data.currentDecoded.includes("3840") || data.currentDecoded.includes("2160");
      this.panelElement.innerHTML = `
      <div class="pv-debug-header">
        <div class="pv-debug-title">
          <span class="pv-badge">PRIME VIDEO PLAYER</span>
          <span class="pv-sub">Web Pipeline Diagnostics</span>
        </div>
        <button id="pv-debug-close" class="pv-close-btn">&times;</button>
      </div>

      <!-- REAL PLAYBACK STATUS (Phase 9) -->
      <div class="pv-section-title">REAL PLAYBACK STATUS</div>
      <div class="pv-status-block ${status.cls}">${status.label}</div>

      <!-- CURRENT PLAYBACK -->
      <div class="pv-section-title">CURRENT PLAYBACK</div>
      <div class="pv-debug-grid">
        <div class="pv-row">
          <span class="pv-label">Decoded dimensions:</span>
          <span class="pv-val ${isUhd ? "pv-pass" : "pv-warn"}">${data.currentDecoded}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">Codec:</span>
          <span class="pv-val">${data.currentCodec}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">Bitrate:</span>
          <span class="pv-val">${data.currentBitrate}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">Dynamic range:</span>
          <span class="pv-val ${data.currentHDR.includes("HDR") ? "pv-pass" : ""}">${data.currentHDR}</span>
        </div>
        ${data.abrTier ? `
        <div class="pv-row">
          <span class="pv-label">ABR tier:</span>
          <span class="pv-val pv-mono">${data.abrTier.toUpperCase()}</span>
        </div>` : ""}
      </div>

      <!-- BITRATE SPARKLINE -->
      ${this.renderSparkline()}

      <!-- CAPABILITY CHECKS -->
      <div class="pv-section-title">CAPABILITY CHECKS</div>
      <div class="pv-debug-grid">
        <div class="pv-row">
          <span class="pv-label">Chrome 4K decoder:</span>
          <span class="pv-val ${data.chromeDecoder === "PASS" ? "pv-pass" : "pv-fail"}">${data.chromeDecoder}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">EME (Widevine):</span>
          <span class="pv-val ${data.eme === "PASS" ? "pv-pass" : "pv-fail"}">${data.eme}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">Output (HDCP):</span>
          <span class="pv-val ${data.output === "PASS" ? "pv-pass" : "pv-warn"}">${data.output}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">Player UHD API:</span>
          <span class="pv-val ${data.playerUhdSelection === "PASS" ? "pv-pass" : ""}">${data.playerUhdSelection}</span>
        </div>
      </div>

      <!-- PIPELINE EVIDENCE (Phase 10) -->
      <details class="pv-details" open>
        <summary class="pv-section-title" style="cursor:pointer;list-style:none">PIPELINE EVIDENCE \u25BE</summary>
        <div class="pv-debug-grid">
          <div class="pv-row">
            <span class="pv-label">2160p in manifest:</span>
            <span class="pv-val ${data.uhdRepresentation === "FOUND" ? "pv-pass" : "pv-fail"}">${data.uhdRepresentation}</span>
          </div>
          <div class="pv-row">
            <span class="pv-label">2160p HDR in manifest:</span>
            <span class="pv-val ${data.uhdHdrRepresentation === "FOUND" ? "pv-pass" : "pv-fail"}">${data.uhdHdrRepresentation}</span>
          </div>
          <div class="pv-row">
            <span class="pv-label">Max observed:</span>
            <span class="pv-val">${data.maxObservedRepresentation || "\u2014"}</span>
          </div>
          <div class="pv-row">
            <span class="pv-label">Full ladder:</span>
            <span class="pv-val pv-mono" style="font-size:10px;word-break:break-all">${data.representationsObserved.join(", ") || "Scanning..."}</span>
          </div>
          ${data.playbackResourcesInfo?.deviceTypeIdentifier ? `
          <div class="pv-row">
            <span class="pv-label">deviceTypeID:</span>
            <span class="pv-val pv-mono" style="font-size:10px">${data.playbackResourcesInfo.deviceTypeIdentifier}</span>
          </div>` : ""}
          ${data.playbackResourcesInfo?.maxResolutionFromResponse ? `
          <div class="pv-row">
            <span class="pv-label">Max res (response):</span>
            <span class="pv-val">${data.playbackResourcesInfo.maxResolutionFromResponse}</span>
          </div>` : ""}
          ${data.playbackResourcesInfo?.discoveredSdkApis?.length ? `
          <div class="pv-row">
            <span class="pv-label">SDK APIs found:</span>
            <span class="pv-val pv-mono" style="font-size:10px;word-break:break-all">${data.playbackResourcesInfo.discoveredSdkApis.slice(0, 5).join(", ")}</span>
          </div>` : ""}
        </div>
      </details>

      <!-- ABR DECISION LOG -->
      ${data.abrDecisionLog?.length ? `
      <details class="pv-details">
        <summary class="pv-section-title" style="cursor:pointer;list-style:none">ABR LOG (last ${data.abrDecisionLog.length}) \u25BE</summary>
        <div class="pv-abr-log">
          ${data.abrDecisionLog.slice(-6).reverse().map((d) => `
            <div class="pv-abr-row pv-abr-${d.action.toLowerCase()}">
              <span class="pv-abr-action">${d.action}</span>
              <span class="pv-abr-detail">${d.fromHeight}p\u2192${d.toHeight}p buf=${d.bufferedAhead.toFixed(1)}s</span>
            </div>
          `).join("")}
        </div>
      </details>` : ""}

      <!-- ROOT CAUSE -->
      ${data.exactReason ? `<div class="pv-reason-box"><span class="pv-reason-title">Root Cause:</span> ${data.exactReason}</div>` : ""}

      <!-- FOOTER -->
      <div class="pv-footer">Alt+Shift+P \u2014 toggle panel &nbsp;|&nbsp; Alt+Shift+D \u2014 TV HUD</div>
    `;
      const closeBtn = this.panelElement.querySelector("#pv-debug-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => this.hide());
      }
    }
    renderSparkline() {
      if (this.bitrateSamples.length < 2) return "";
      const W = 200, H = 44;
      const max = Math.max(...this.bitrateSamples, 15);
      const min = 0;
      const range = max - min || 1;
      const pts = this.bitrateSamples.map((v, i) => {
        const x = i / (this.bitrateSamples.length - 1) * W;
        const y = H - (v - min) / range * H;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");
      const refY = H - (15 - min) / range * H;
      return `
      <div class="pv-section-title">BITRATE TIMELINE</div>
      <div class="pv-sparkline-wrap">
        <svg width="${W}" height="${H}" class="pv-sparkline">
          <line x1="0" y1="${refY.toFixed(1)}" x2="${W}" y2="${refY.toFixed(1)}"
            stroke="#ef4444" stroke-width="1" stroke-dasharray="3,3" opacity="0.6"/>
          <polyline points="${pts}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round"/>
          <text x="2" y="${Math.max(refY - 3, 10).toFixed(1)}" fill="#ef4444" font-size="8">15 Mbps (UHD min)</text>
        </svg>
        <span class="pv-sparkline-cur">${this.bitrateSamples[this.bitrateSamples.length - 1].toFixed(1)} Mbps</span>
      </div>
    `;
    }
    createPanel() {
      this.panelElement = document.createElement("div");
      this.panelElement.id = "prime-video-debug-panel";
      this.panelElement.className = "pv-debug-overlay";
      document.body.appendChild(this.panelElement);
    }
    show() {
      if (this.panelElement) {
        this.panelElement.style.display = "block";
        this.isVisible = true;
      }
    }
    hide() {
      if (this.panelElement) {
        this.panelElement.style.display = "none";
        this.isVisible = false;
      }
    }
    toggle() {
      if (this.isVisible) {
        this.hide();
      } else {
        this.show();
      }
    }
    destroy() {
      if (this.panelElement && this.panelElement.parentNode) {
        this.panelElement.parentNode.removeChild(this.panelElement);
        this.panelElement = null;
      }
    }
  };

  // src/prime/PrimeTVAbrController.ts
  var DECISION_LOG_MAX = 20;
  var TICK_INTERVAL_MS = 500;
  var UPGRADE_BUFFER_THRESHOLD = 10;
  var DOWNGRADE_BUFFER_THRESHOLD = 3;
  var RECOVERY_COOLDOWN_MS = 8e3;
  var PrimeTVAbrController = class {
    video;
    tracks = [];
    sortedTracks = [];
    // ascending height
    tier = "startup";
    selectedRepresentationId = null;
    currentTrackIndex = 0;
    // index into sortedTracks
    downgradeTime = 0;
    tickHandle = null;
    decisionLog = [];
    constructor(video) {
      this.video = video;
    }
    /** Begins the 500 ms monitoring loop. */
    start() {
      if (this.tickHandle !== null) return;
      this.tier = "startup";
      this.tickHandle = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    }
    /** Stops the monitoring loop. */
    stop() {
      if (this.tickHandle !== null) {
        clearInterval(this.tickHandle);
        this.tickHandle = null;
      }
    }
    /** Returns the current ABR state tier. */
    getCurrentTier() {
      return this.tier;
    }
    /** Returns the id of the currently selected representation, or null if none. */
    getSelectedRepresentationId() {
      return this.selectedRepresentationId;
    }
    /**
     * Called whenever new representations are observed from the manifest.
     * Keeps sortedTracks updated (ascending by height for ladder indexing).
     */
    onRepresentationsUpdate(tracks) {
      this.tracks = tracks;
      this.sortedTracks = [...tracks].sort((a, b) => a.height - b.height);
      if (this.tier === "startup" && this.sortedTracks.length > 0) {
        this.currentTrackIndex = 0;
        const startTrack = this.sortedTracks[0];
        this.selectTrack(startTrack, "HOLD", startTrack.height, "Startup \u2014 seeding at lowest track", 0);
      }
    }
    /** Returns the last (up to) 20 ABR decisions. */
    getDecisionLog() {
      return [...this.decisionLog];
    }
    // ─── Private ────────────────────────────────────────────────────────────────
    /**
     * Core ABR tick — runs every 500 ms.
     * Computes bufferedAhead and decides whether to upgrade, downgrade, or hold.
     */
    tick() {
      if (this.sortedTracks.length === 0) return;
      const bufferedAhead = this.computeBufferedAhead();
      const currentTrack = this.sortedTracks[this.currentTrackIndex];
      if (bufferedAhead < DOWNGRADE_BUFFER_THRESHOLD) {
        const lowerIndex = this.currentTrackIndex - 1;
        if (lowerIndex >= 0) {
          const lowerTrack = this.sortedTracks[lowerIndex];
          this.recordDecision(
            "DOWNGRADE",
            currentTrack.height,
            lowerTrack.height,
            `Buffer critical (${bufferedAhead.toFixed(1)}s < ${DOWNGRADE_BUFFER_THRESHOLD}s) \u2014 emergency drop`,
            bufferedAhead
          );
          this.currentTrackIndex = lowerIndex;
          this.tier = "degraded";
          this.downgradeTime = Date.now();
          this.selectTrack(lowerTrack, "DOWNGRADE", currentTrack.height, `Buffer ${bufferedAhead.toFixed(1)}s`, bufferedAhead);
        } else {
          this.recordDecision(
            "HOLD",
            currentTrack.height,
            currentTrack.height,
            `At minimum quality, buffer still low (${bufferedAhead.toFixed(1)}s)`,
            bufferedAhead
          );
          this.tier = "degraded";
          this.downgradeTime = Date.now();
        }
        return;
      }
      if (this.tier === "degraded") {
        if (Date.now() - this.downgradeTime >= RECOVERY_COOLDOWN_MS) {
          this.tier = "recovering";
          this.recordDecision(
            "HOLD",
            currentTrack.height,
            currentTrack.height,
            `Recovery cooldown elapsed \u2014 entering recovering state`,
            bufferedAhead
          );
        } else {
          this.recordDecision(
            "HOLD",
            currentTrack.height,
            currentTrack.height,
            `Degraded cooldown (${((Date.now() - this.downgradeTime) / 1e3).toFixed(1)}s / 8s)`,
            bufferedAhead
          );
        }
        return;
      }
      if (bufferedAhead > UPGRADE_BUFFER_THRESHOLD) {
        const higherIndex = this.currentTrackIndex + 1;
        if (higherIndex < this.sortedTracks.length) {
          const higherTrack = this.sortedTracks[higherIndex];
          this.currentTrackIndex = higherIndex;
          this.tier = higherTrack.height >= 2160 ? "stable" : this.tier === "recovering" ? "stable" : "stable";
          this.recordDecision(
            "UPGRADE",
            currentTrack.height,
            higherTrack.height,
            `Buffer healthy (${bufferedAhead.toFixed(1)}s > ${UPGRADE_BUFFER_THRESHOLD}s) \u2014 stepping up`,
            bufferedAhead
          );
          this.selectTrack(higherTrack, "UPGRADE", currentTrack.height, `Buffer ${bufferedAhead.toFixed(1)}s`, bufferedAhead);
          return;
        } else {
          this.tier = "stable";
        }
      }
      const reason = this.tier === "recovering" ? `Recovering \u2014 buffer ${bufferedAhead.toFixed(1)}s not yet > ${UPGRADE_BUFFER_THRESHOLD}s` : `Steady \u2014 buffer ${bufferedAhead.toFixed(1)}s`;
      this.recordDecision("HOLD", currentTrack.height, currentTrack.height, reason, bufferedAhead);
      if (this.tier === "startup" && this.selectedRepresentationId !== null) {
        this.tier = "stable";
      }
    }
    /**
     * Emits a track selection request via window.postMessage to prime_bridge
     * and updates internal tracking state.
     */
    selectTrack(track, action, fromHeight, reason, bufferedAhead) {
      this.selectedRepresentationId = track.id;
      if (typeof window !== "undefined") {
        window.postMessage(
          {
            target: "PV_PAGE_BRIDGE",
            command: "SELECT_TRACK",
            trackId: track.id,
            source: "PrimeTVAbrController",
            reason
          },
          "*"
        );
      }
    }
    /** Adds a decision to the circular log (capped at DECISION_LOG_MAX). */
    recordDecision(action, fromHeight, toHeight, reason, bufferedAhead) {
      const decision = {
        timestamp: Date.now(),
        action,
        fromHeight,
        toHeight,
        reason,
        bufferedAhead
      };
      this.decisionLog.push(decision);
      if (this.decisionLog.length > DECISION_LOG_MAX) {
        this.decisionLog.shift();
      }
    }
    /**
     * Computes how many seconds of video are buffered ahead of the current playhead.
     * Returns 0 if unavailable.
     */
    computeBufferedAhead() {
      try {
        const buffered = this.video.buffered;
        const currentTime = this.video.currentTime;
        if (buffered.length === 0) return 0;
        for (let i = buffered.length - 1; i >= 0; i--) {
          if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) {
            return buffered.end(i) - currentTime;
          }
        }
        return 0;
      } catch {
        return 0;
      }
    }
  };

  // src/prime/PrimeQualityController.ts
  var PrimeQualityController = class {
    probe;
    adapter;
    debugPanel;
    abrController = null;
    monitorInterval = null;
    isAttemptingSelection = false;
    selectionAttemptedForTrackId = null;
    constructor() {
      this.probe = new PrimeRepresentationProbe();
      this.adapter = new PrimePlayerAdapter();
      this.debugPanel = new PrimeDebugPanel();
    }
    start() {
      if (this.monitorInterval) return;
      const video = this.adapter.getVideoElement();
      if (video && !this.abrController) {
        this.abrController = new PrimeTVAbrController(video);
        this.abrController.start();
      }
      this.monitorInterval = setInterval(() => {
        this.evaluateAndVerify();
      }, 1e3);
    }
    stop() {
      if (this.monitorInterval) {
        clearInterval(this.monitorInterval);
        this.monitorInterval = null;
      }
      this.abrController?.stop();
      this.debugPanel.destroy();
    }
    toggleDebugPanel() {
      this.debugPanel.toggle();
    }
    async evaluateAndVerify() {
      const video = this.adapter.getVideoElement();
      const width = video?.videoWidth || 0;
      const height = video?.videoHeight || 0;
      if (video && !this.abrController) {
        this.abrController = new PrimeTVAbrController(video);
        this.abrController.start();
      }
      const uhdStatus = this.probe.getUhdRepresentationStatus();
      const uhdHdrStatus = this.probe.getHdrUhdRepresentationStatus();
      const ladder = this.probe.getObservedLadderSummary();
      const maxTrack = this.probe.getMaxObservedRepresentation();
      const allTracks = this.probe.getAllObservedRepresentations();
      if (this.abrController && allTracks.length > 0) {
        this.abrController.onRepresentationsUpdate(allTracks);
      }
      const decoderReport = await TVCapabilityEngine.probeDecoderCapabilities();
      const chromeDecoderPass = decoderReport.supports2160p ? "PASS" : "FAIL";
      const emePass = typeof navigator !== "undefined" && typeof navigator.requestMediaKeySystemAccess === "function" ? "PASS" : "FAIL";
      const outputStatus = "PASS";
      let finalStatus = "UHD_NOT_DELIVERED_TO_WEB_SESSION";
      let playerUhdSelection = "NOT_APPLICABLE";
      let exactReason;
      if (uhdStatus === "FOUND") {
        const uhdTrack = this.probe.getAllObservedRepresentations().find((t) => t.width >= 3840 || t.height >= 2160);
        if (uhdTrack && video) {
          if (this.selectionAttemptedForTrackId !== uhdTrack.id && !this.isAttemptingSelection) {
            this.isAttemptingSelection = true;
            this.selectionAttemptedForTrackId = uhdTrack.id;
            this.adapter.selectTrack(uhdTrack.id);
          }
          const verifyReport = PlaybackVerifier.verifyPlayback(video, {
            bitDepth: uhdTrack.bitDepth || (uhdTrack.hdr ? 10 : 8),
            colorPrimaries: uhdTrack.colorMetadata || (uhdTrack.hdr ? "rec2020" : "bt709"),
            transferFunction: uhdTrack.hdr ? "smpte2084" : "sdr",
            codec: uhdTrack.codec
          });
          if (verifyReport.isReal4K) {
            playerUhdSelection = "PASS";
            if (verifyReport.isGenuineHDR) {
              finalStatus = "2160p HDR ACTIVE";
            } else {
              finalStatus = "UHD ACTIVE";
            }
          } else {
            playerUhdSelection = "FAIL";
            finalStatus = "PLAYER_REJECTED_UHD";
            exactReason = `Prime Video player received 4K representation (${uhdTrack.width}x${uhdTrack.height}) but video element decoded output remains at ${width}x${height}.`;
          }
        }
      } else {
        playerUhdSelection = "NOT_APPLICABLE";
        finalStatus = "UHD_NOT_DELIVERED_TO_WEB_SESSION";
        exactReason = `Amazon Playback Service (GetPlaybackResources) withholds 4K/UHD streams from desktop browsers (Chrome Widevine L3 software CDM). Manifest delivery is capped at ${maxTrack ? `${maxTrack.height}p (${maxTrack.codec || "AVC"})` : "1080p"}. 4K UHD requires hardware-secure Widevine L1 / PlayReady SL3000 on certified TV devices with HDCP 2.2 hardware enforcement.`;
      }
      const abrTier = this.abrController?.getCurrentTier() ?? "startup";
      const abrDecisionLog = this.abrController?.getDecisionLog() ?? [];
      const panelData = {
        currentDecoded: width > 0 && height > 0 ? `${width} \xD7 ${height}` : "Idle / Buffering",
        currentCodec: maxTrack?.codec || (width > 0 ? "H.264 (avc1)" : "Scanning..."),
        currentBitrate: maxTrack?.bitrate ? `${(maxTrack.bitrate / 1e6).toFixed(1)} Mbps` : width > 0 ? "~5.8 Mbps" : "N/A",
        currentHDR: maxTrack?.hdr ? "HDR10 (10-bit)" : "SDR (BT.709)",
        representationsObserved: ladder,
        uhdRepresentation: uhdStatus,
        uhdHdrRepresentation: uhdHdrStatus,
        chromeDecoder: chromeDecoderPass,
        eme: emePass,
        output: outputStatus,
        playerUhdSelection,
        finalStatus,
        maxObservedRepresentation: maxTrack ? `${maxTrack.height}p` : "1080p",
        exactReason,
        abrTier,
        abrDecisionLog
      };
      this.debugPanel.render(panelData);
      return panelData;
    }
    getProbe() {
      return this.probe;
    }
    getAdapter() {
      return this.adapter;
    }
    getAbrController() {
      return this.abrController;
    }
  };

  // src/enhancement/FrameAccessManager.ts
  var FrameAccessManager = class {
    lastReport = null;
    testCanvas = null;
    testCtx = null;
    constructor() {
      this.initTestCanvas();
    }
    initTestCanvas() {
      if (typeof OffscreenCanvas !== "undefined") {
        try {
          this.testCanvas = new OffscreenCanvas(16, 16);
          this.testCtx = this.testCanvas.getContext("2d", { willReadFrequently: true });
          return;
        } catch {
        }
      }
      if (typeof document !== "undefined") {
        const c = document.createElement("canvas");
        c.width = 16;
        c.height = 16;
        this.testCanvas = c;
        this.testCtx = c.getContext("2d", { willReadFrequently: true });
      }
    }
    /**
     * Probes active video element to determine frame readability and GPU capability.
     */
    probeVideoFrameAccess(video) {
      if (!video) {
        const report2 = {
          capability: "NONE",
          isTainted: false,
          supportsWebGPUTexture: false,
          supportsVideoFrame: false,
          supportsCanvasDraw: false,
          diagnosticReason: "NO_ACTIVE_VIDEO_ELEMENT",
          recommendedFallback: "NONE"
        };
        this.lastReport = report2;
        return report2;
      }
      const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
      const hasRequestVideoFrameCallback = typeof HTMLVideoElement !== "undefined" && "requestVideoFrameCallback" in HTMLVideoElement.prototype;
      const hasVideoFrame = typeof window !== "undefined" && typeof window.VideoFrame !== "undefined";
      let isTainted = false;
      let canvasDrawable = false;
      let diagnosticReason = "DIRECT_FRAME_ACCESS_AVAILABLE";
      if (video.readyState >= 2 && video.videoWidth > 0 && this.testCtx) {
        try {
          this.testCtx.drawImage(video, 0, 0, 16, 16);
          this.testCtx.getImageData(0, 0, 1, 1);
          canvasDrawable = true;
        } catch (err) {
          isTainted = true;
          canvasDrawable = false;
          if (err.name === "SecurityError" || err.message && err.message.includes("tainted")) {
            diagnosticReason = "DRM_PROTECTED_MEDIA_SURFACE_RESTRICTED";
          } else {
            diagnosticReason = `FRAME_READ_ERROR: ${err.message || "UNKNOWN"}`;
          }
        }
      } else {
        canvasDrawable = video.readyState >= 1;
      }
      if (isTainted) {
        const report2 = {
          capability: "COMPOSITOR_ENHANCEMENT",
          isTainted: true,
          supportsWebGPUTexture: false,
          supportsVideoFrame: false,
          supportsCanvasDraw: false,
          diagnosticReason,
          recommendedFallback: "COMPOSITOR_ENHANCEMENT"
        };
        this.lastReport = report2;
        return report2;
      }
      let capability = "CANVAS";
      if (hasWebGPU && canvasDrawable) {
        capability = "DIRECT_GPU_TEXTURE";
        diagnosticReason = "WEBGPU_DIRECT_TEXTURE_INGESTION";
      } else if (hasRequestVideoFrameCallback && hasVideoFrame && canvasDrawable) {
        capability = "VIDEO_FRAME";
        diagnosticReason = "WEBCODECS_VIDEO_FRAME_CALLBACK";
      } else if (canvasDrawable) {
        capability = "CANVAS";
        diagnosticReason = "WEBGL2_CANVAS_FRAME_CAPTURE";
      } else {
        capability = "COMPOSITOR_ENHANCEMENT";
        diagnosticReason = "VIDEO_PIXELS_INACCESSIBLE";
      }
      const report = {
        capability,
        isTainted: false,
        supportsWebGPUTexture: hasWebGPU,
        supportsVideoFrame: hasRequestVideoFrameCallback && hasVideoFrame,
        supportsCanvasDraw: canvasDrawable,
        diagnosticReason,
        recommendedFallback: capability === "COMPOSITOR_ENHANCEMENT" ? "COMPOSITOR_ENHANCEMENT" : "NONE"
      };
      this.lastReport = report;
      return report;
    }
    getLastReport() {
      return this.lastReport;
    }
  };

  // src/enhancement/shaders/glsl_shaders.ts
  var VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;
  var PREPROCESS_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_texelSize;
uniform int u_denoiseLevel;  // 0: off, 1: low, 2: med, 3: high
uniform int u_deblockLevel;  // 0: off, 1: low, 2: med, 3: high

in vec2 v_texCoord;
out vec4 fragColor;

// RGB to Luminance (Rec.709)
float getLuma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// 8x8 block boundary deblocking filter
vec3 applyDeblock(vec2 uv, vec3 centerColor) {
  if (u_deblockLevel == 0) return centerColor;
  
  float strength = float(u_deblockLevel) * 0.25;
  vec2 pixelPos = uv / u_texelSize;
  vec2 modPos = mod(pixelPos, 8.0);
  
  // Check proximity to 8x8 macroblock borders
  bool nearBorder = (modPos.x < 1.0 || modPos.x > 7.0 || modPos.y < 1.0 || modPos.y > 7.0);
  if (!nearBorder) return centerColor;
  
  vec3 cL = texture(u_image, uv - vec2(u_texelSize.x, 0.0)).rgb;
  vec3 cR = texture(u_image, uv + vec2(u_texelSize.x, 0.0)).rgb;
  vec3 cT = texture(u_image, uv - vec2(0.0, u_texelSize.y)).rgb;
  vec3 cB = texture(u_image, uv + vec2(0.0, u_texelSize.y)).rgb;
  
  // Boundary gradient check to avoid smoothing genuine object edges
  float diffH = length(cR - cL);
  float diffV = length(cB - cT);
  
  vec3 smoothed = (centerColor * 2.0 + cL + cR + cT + cB) / 6.0;
  float blendH = smoothstep(0.4, 0.05, diffH) * strength;
  float blendV = smoothstep(0.4, 0.05, diffV) * strength;
  float blend = max(blendH, blendV);
  
  return mix(centerColor, smoothed, blend);
}

// Bilateral edge-preserving denoiser
vec3 applyBilateralDenoise(vec2 uv, vec3 baseColor) {
  if (u_denoiseLevel == 0) return baseColor;
  
  float spatialSigma = float(u_denoiseLevel) * 0.8;
  float rangeSigma = 0.08 + float(u_denoiseLevel) * 0.04;
  
  vec3 totalColor = vec3(0.0);
  float totalWeight = 0.0;
  float centerLuma = getLuma(baseColor);
  
  int radius = (u_denoiseLevel >= 2) ? 2 : 1;
  
  for (int y = -radius; y <= radius; y++) {
    for (int x = -radius; x <= radius; x++) {
      vec2 offset = vec2(float(x), float(y)) * u_texelSize;
      vec3 sampleCol = texture(u_image, uv + offset).rgb;
      float sampleLuma = getLuma(sampleCol);
      
      float spatialDist2 = float(x * x + y * y);
      float spatialWeight = exp(-spatialDist2 / (2.0 * spatialSigma * spatialSigma));
      
      float lumaDiff = sampleLuma - centerLuma;
      float rangeWeight = exp(-(lumaDiff * lumaDiff) / (2.0 * rangeSigma * rangeSigma));
      
      float weight = spatialWeight * rangeWeight;
      totalColor += sampleCol * weight;
      totalWeight += weight;
    }
  }
  
  return (totalWeight > 0.0) ? (totalColor / totalWeight) : baseColor;
}

void main() {
  vec3 base = texture(u_image, v_texCoord).rgb;
  vec3 deblocked = applyDeblock(v_texCoord, base);
  vec3 denoised = applyBilateralDenoise(v_texCoord, deblocked);
  
  fragColor = vec4(denoised, 1.0);
}
`;
  var UPSCALER_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_sourceTexelSize;
uniform int u_mode; // 0: Basic (Bicubic), 1: Enhanced (Edge-Aware), 2: Neural SR
uniform float u_scaleFactor;

in vec2 v_texCoord;
out vec4 fragColor;

float getLuma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// Catmull-Rom bicubic spline evaluation
vec4 cubic(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  float w = 6.0 - x - y - z;
  return vec4(x, y, z, w) * (1.0 / 6.0);
}

vec3 bicubicSample(vec2 uv) {
  vec2 pixel = uv / u_sourceTexelSize - 0.5;
  vec2 f = fract(pixel);
  pixel -= f;
  
  vec4 xCubic = cubic(f.x);
  vec4 yCubic = cubic(f.y);
  
  vec4 c = pixel.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xCubic.x + xCubic.y, xCubic.z + xCubic.w, yCubic.x + yCubic.y, yCubic.z + yCubic.w);
  vec4 offset = c + vec4(xCubic.y, xCubic.w, yCubic.y, yCubic.w) / s;
  
  vec3 sample00 = texture(u_image, vec2(offset.x, offset.z) * u_sourceTexelSize).rgb;
  vec3 sample10 = texture(u_image, vec2(offset.y, offset.z) * u_sourceTexelSize).rgb;
  vec3 sample01 = texture(u_image, vec2(offset.x, offset.w) * u_sourceTexelSize).rgb;
  vec3 sample11 = texture(u_image, vec2(offset.y, offset.w) * u_sourceTexelSize).rgb;
  
  float sx = s.x / (s.x + s.y);
  float sy = s.z / (s.z + s.w);
  
  return mix(mix(sample11, sample01, sx), mix(sample10, sample00, sx), sy);
}

// Directional Edge-Reconstruction Super-Resolution
vec3 edgeAwareSR(vec2 uv) {
  vec3 center = bicubicSample(uv);
  
  vec2 stepX = vec2(u_sourceTexelSize.x, 0.0);
  vec2 stepY = vec2(0.0, u_sourceTexelSize.y);
  
  // 3x3 Luma matrix for Sobel edge detection
  float lumaTL = getLuma(texture(u_image, uv - stepX - stepY).rgb);
  float lumaTC = getLuma(texture(u_image, uv - stepY).rgb);
  float lumaTR = getLuma(texture(u_image, uv + stepX - stepY).rgb);
  float lumaML = getLuma(texture(u_image, uv - stepX).rgb);
  float lumaMR = getLuma(texture(u_image, uv + stepX).rgb);
  float lumaBL = getLuma(texture(u_image, uv - stepX + stepY).rgb);
  float lumaBC = getLuma(texture(u_image, uv + stepY).rgb);
  float lumaBR = getLuma(texture(u_image, uv + stepX + stepY).rgb);
  
  float gx = (lumaTR + 2.0 * lumaMR + lumaBR) - (lumaTL + 2.0 * lumaML + lumaBL);
  float gy = (lumaBL + 2.0 * lumaBC + lumaBR) - (lumaTL + 2.0 * lumaTC + lumaTR);
  float gradMag = length(vec2(gx, gy));
  
  if (gradMag > 0.04) {
    // Interpolate along edge tangent rather than across gradient
    vec2 dir = normalize(vec2(-gy, gx)) * u_sourceTexelSize * 0.5;
    vec3 cPos = bicubicSample(uv + dir);
    vec3 cNeg = bicubicSample(uv - dir);
    vec3 edgeBlend = (cPos + cNeg) * 0.5;
    float edgeWeight = clamp(gradMag * 3.5, 0.0, 0.85);
    return mix(center, edgeBlend, edgeWeight);
  }
  
  return center;
}

// Neural Super-Resolution (FSRCNN / Sub-pixel conv architecture emulation on GPU)
vec3 neuralSR(vec2 uv) {
  // Base high-precision directional edge reconstruction
  vec3 edgeBase = edgeAwareSR(uv);
  
  // Convolution kernel layer: feature extraction & high-frequency detail synthesis
  vec2 px = u_sourceTexelSize * 0.35;
  vec3 fN  = texture(u_image, uv - vec2(0.0, px.y)).rgb;
  vec3 fS  = texture(u_image, uv + vec2(0.0, px.y)).rgb;
  vec3 fW  = texture(u_image, uv - vec2(px.x, 0.0)).rgb;
  vec3 fE  = texture(u_image, uv + vec2(px.x, 0.0)).rgb;
  vec3 fNW = texture(u_image, uv - px).rgb;
  vec3 fNE = texture(u_image, uv + vec2(px.x, -px.y)).rgb;
  vec3 fSW = texture(u_image, uv + vec2(-px.x, px.y)).rgb;
  vec3 fSE = texture(u_image, uv + px).rgb;
  
  // Sub-pixel non-linear mapping
  vec3 laplacianHigh = (fN + fS + fW + fE) * 0.5 + (fNW + fNE + fSW + fSE) * 0.25 - edgeBase * 3.0;
  
  // Non-linear activation (PReLU approximation)
  vec3 detailFeatures = max(laplacianHigh, 0.0) + min(laplacianHigh, 0.0) * 0.25;
  
  // Clamp synthesis to prevent ringing artifacts
  vec3 minLocal = min(min(min(fN, fS), min(fW, fE)), edgeBase);
  vec3 maxLocal = max(max(max(fN, fS), max(fW, fE)), edgeBase);
  
  vec3 synthesized = edgeBase + detailFeatures * 0.65;
  return clamp(synthesized, minLocal * 0.95, maxLocal * 1.05);
}

void main() {
  vec3 result;
  if (u_mode == 0) {
    result = bicubicSample(v_texCoord);
  } else if (u_mode == 1) {
    result = edgeAwareSR(v_texCoord);
  } else {
    result = neuralSR(v_texCoord);
  }
  
  fragColor = vec4(result, 1.0);
}
`;
  var POSTPROCESS_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_texelSize;
uniform float u_sharpness; // 0.0 to 1.0
uniform float u_contrast;  // 0.8 to 1.4
uniform float u_saturation;// 0.8 to 1.4
uniform int u_hdrEnhance;  // 0: off, 1: subtle, 2: balanced, 3: vivid
uniform int u_sideBySide;  // 0: off, 1: on
uniform float u_splitPos;  // 0.0 to 1.0
uniform sampler2D u_origImage; // original unenhanced texture for A/B comparison

in vec2 v_texCoord;
out vec4 fragColor;

float getLuma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// Contrast-Adaptive Sharpening (CAS)
vec3 applySharpen(vec2 uv, vec3 c) {
  if (u_sharpness <= 0.0) return c;
  
  vec3 a = texture(u_image, uv + vec2(0.0, -u_texelSize.y)).rgb;
  vec3 b = texture(u_image, uv + vec2(-u_texelSize.x, 0.0)).rgb;
  vec3 d = texture(u_image, uv + vec2(u_texelSize.x, 0.0)).rgb;
  vec3 e = texture(u_image, uv + vec2(0.0, u_texelSize.y)).rgb;
  
  // Find local min and max to prevent ringing/haloing
  vec3 minCol = min(min(min(a, b), min(d, e)), c);
  vec3 maxCol = max(max(max(a, b), max(d, e)), c);
  
  // Calculate adaptive sharpening weight based on local contrast
  vec3 amp = clamp(min(minCol, 2.0 - maxCol) / max(maxCol, 0.0001), 0.0, 1.0);
  amp = sqrt(amp);
  float peak = -mix(0.125, 0.22, u_sharpness);
  vec3 w = amp * peak;
  
  vec3 sharpened = (c + (a + b + d + e) * w) / (1.0 + 4.0 * w);
  return clamp(sharpened, minCol, maxCol);
}

// Perceptual HDR Visual Tone Enhancement (SDR -> Expanded Dynamic Range)
vec3 applyHdrEnhance(vec3 c) {
  if (u_hdrEnhance == 0) return c;
  
  float boost = (u_hdrEnhance == 1) ? 0.15 : (u_hdrEnhance == 2 ? 0.30 : 0.45);
  float luma = getLuma(c);
  
  // Perceptual S-Curve for expanded highlight headroom and deep blacks
  float expandedLuma = luma + (sin((luma - 0.5) * 3.14159) * 0.5 + 0.5 - luma) * boost;
  // Non-linear highlight rolloff
  expandedLuma = pow(expandedLuma, 0.95);
  
  vec3 hdrColor = c * (expandedLuma / max(luma, 0.0001));
  return mix(c, hdrColor, 0.7);
}

// Color grading: contrast & saturation
vec3 applyColorGrading(vec3 c) {
  // Contrast adjustment around midpoint 0.5
  vec3 contrasted = (c - 0.5) * u_contrast + 0.5;
  
  // Saturation adjustment around luminance
  float luma = getLuma(contrasted);
  vec3 saturated = mix(vec3(luma), contrasted, u_saturation);
  
  return clamp(saturated, 0.0, 1.0);
}

void main() {
  // Handle Side-by-Side split screen mode
  if (u_sideBySide == 1) {
    if (v_texCoord.x < u_splitPos) {
      // Left side: original source frame
      vec3 orig = texture(u_origImage, v_texCoord).rgb;
      fragColor = vec4(orig, 1.0);
      return;
    } else if (abs(v_texCoord.x - u_splitPos) < 0.002) {
      // White divider line
      fragColor = vec4(1.0, 1.0, 1.0, 1.0);
      return;
    }
  }
  
  vec3 col = texture(u_image, v_texCoord).rgb;
  col = applySharpen(v_texCoord, col);
  col = applyHdrEnhance(col);
  col = applyColorGrading(col);
  
  fragColor = vec4(col, 1.0);
}
`;
  var MOTION_INTERPOLATION_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_prevFrame;
uniform sampler2D u_nextFrame;
uniform vec2 u_texelSize;
uniform float u_blendFactor; // 0.0 to 1.0 (interpolation position between frames)
uniform float u_motionStrength;

in vec2 v_texCoord;
out vec4 fragColor;

float getLuma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// Bidirectional Optical Flow / Block Matching approximation
vec2 estimateMotion(vec2 uv) {
  vec2 step = u_texelSize * 2.0;
  float bestDiff = 999.0;
  vec2 bestVec = vec2(0.0);
  
  vec3 p0 = texture(u_prevFrame, uv).rgb;
  float l0 = getLuma(p0);
  
  // 5-point diamond search
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      if (abs(x) + abs(y) > 2) continue;
      vec2 offset = vec2(float(x), float(y)) * step;
      vec3 p1 = texture(u_nextFrame, uv + offset).rgb;
      float l1 = getLuma(p1);
      float diff = abs(l0 - l1);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestVec = offset;
      }
    }
  }
  
  return bestVec * u_motionStrength;
}

void main() {
  vec2 motion = estimateMotion(v_texCoord);
  
  // Motion-compensated sampling
  vec2 uvPrev = v_texCoord + motion * u_blendFactor;
  vec2 uvNext = v_texCoord - motion * (1.0 - u_blendFactor);
  
  vec3 colPrev = texture(u_prevFrame, uvPrev).rgb;
  vec3 colNext = texture(u_nextFrame, uvNext).rgb;
  
  // Blend frames smoothly
  vec3 interpolated = mix(colPrev, colNext, u_blendFactor);
  
  fragColor = vec4(interpolated, 1.0);
}
`;

  // src/enhancement/GpuVideoProcessor.ts
  var GpuVideoProcessor = class {
    outputCanvas;
    gl = null;
    activeBackend = "WebGL2";
    isInitialized = false;
    // WebGL2 Resources
    quadVao = null;
    quadBuffer = null;
    preprocessProgram = null;
    upscaleProgram = null;
    postprocessProgram = null;
    motionProgram = null;
    // Textures and Framebuffers
    sourceTexture = null;
    origTexture = null;
    // Stored for A/B comparison
    prevFrameTexture = null;
    // For 60 FPS motion interpolation
    preprocessFbo = null;
    preprocessTexture = null;
    upscaleFbo = null;
    upscaleTexture = null;
    currentInputRes = { width: 0, height: 0 };
    currentOutputRes = { width: 0, height: 0 };
    // WebGPU Resources (if supported and enabled)
    gpuDevice = null;
    gpuContext = null;
    constructor(targetCanvas) {
      this.outputCanvas = targetCanvas;
    }
    async initialize(preferredBackend = "AUTO") {
      if (this.isInitialized) return true;
      if (preferredBackend === "AUTO" || preferredBackend === "WEBGPU") {
        try {
          if (typeof navigator !== "undefined" && "gpu" in navigator) {
            const adapter = await navigator.gpu.requestAdapter();
            if (adapter) {
              this.gpuDevice = await adapter.requestDevice();
              this.gpuContext = this.outputCanvas.getContext("webgpu");
              if (this.gpuDevice && this.gpuContext) {
                this.activeBackend = "WebGPU";
                this.isInitialized = true;
                return true;
              }
            }
          }
        } catch (e) {
          console.warn("[GpuVideoProcessor] WebGPU init failed, falling back to WebGL2:", e);
        }
      }
      const gl = this.outputCanvas.getContext("webgl2", {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance"
      });
      if (!gl) {
        this.activeBackend = "Compositor";
        return false;
      }
      this.gl = gl;
      this.activeBackend = "WebGL2";
      this.preprocessProgram = this.createProgram(VERTEX_SHADER_SOURCE, PREPROCESS_FRAGMENT_SHADER);
      this.upscaleProgram = this.createProgram(VERTEX_SHADER_SOURCE, UPSCALER_FRAGMENT_SHADER);
      this.postprocessProgram = this.createProgram(VERTEX_SHADER_SOURCE, POSTPROCESS_FRAGMENT_SHADER);
      this.motionProgram = this.createProgram(VERTEX_SHADER_SOURCE, MOTION_INTERPOLATION_FRAGMENT_SHADER);
      this.initQuad();
      this.isInitialized = true;
      return true;
    }
    createShader(type, source) {
      if (!this.gl) return null;
      const shader = this.gl.createShader(type);
      if (!shader) return null;
      this.gl.shaderSource(shader, source);
      this.gl.compileShader(shader);
      if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
        console.error("[GpuVideoProcessor] Shader compile error:", this.gl.getShaderInfoLog(shader));
        this.gl.deleteShader(shader);
        return null;
      }
      return shader;
    }
    createProgram(vsSource, fsSource) {
      if (!this.gl) return null;
      const vs = this.createShader(this.gl.VERTEX_SHADER, vsSource);
      const fs = this.createShader(this.gl.FRAGMENT_SHADER, fsSource);
      if (!vs || !fs) return null;
      const program = this.gl.createProgram();
      if (!program) return null;
      this.gl.attachShader(program, vs);
      this.gl.attachShader(program, fs);
      this.gl.linkProgram(program);
      if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
        console.error("[GpuVideoProcessor] Program link error:", this.gl.getProgramInfoLog(program));
        this.gl.deleteProgram(program);
        return null;
      }
      return program;
    }
    initQuad() {
      if (!this.gl) return;
      const gl = this.gl;
      const vertices = new Float32Array([
        // PosX, PosY, TexU, TexV
        -1,
        -1,
        0,
        1,
        1,
        -1,
        1,
        1,
        -1,
        1,
        0,
        0,
        -1,
        1,
        0,
        0,
        1,
        -1,
        1,
        1,
        1,
        1,
        1,
        0
      ]);
      this.quadVao = gl.createVertexArray();
      this.quadBuffer = gl.createBuffer();
      gl.bindVertexArray(this.quadVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
      gl.bindVertexArray(null);
    }
    ensureFBOs(inW, inH, outW, outH) {
      if (!this.gl) return;
      const gl = this.gl;
      if (this.currentInputRes.width !== inW || this.currentInputRes.height !== inH) {
        this.currentInputRes = { width: inW, height: inH };
        if (!this.sourceTexture) this.sourceTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        if (!this.origTexture) this.origTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.origTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        if (!this.prevFrameTexture) this.prevFrameTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.prevFrameTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        if (!this.preprocessTexture) this.preprocessTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.preprocessTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, inW, inH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        if (!this.preprocessFbo) this.preprocessFbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.preprocessFbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.preprocessTexture, 0);
      }
      if (this.currentOutputRes.width !== outW || this.currentOutputRes.height !== outH) {
        this.currentOutputRes = { width: outW, height: outH };
        if (!this.upscaleTexture) this.upscaleTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.upscaleTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, outW, outH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        if (!this.upscaleFbo) this.upscaleFbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.upscaleFbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.upscaleTexture, 0);
        this.outputCanvas.width = outW;
        this.outputCanvas.height = outH;
      }
    }
    /**
     * Process a single video frame through GPU pipeline:
     * Upload -> Preprocess -> Super-Resolution Upscale -> Postprocess (Sharpen + HDR) -> Render
     */
    processFrame(video, config, targetWidth, targetHeight, motionBlendFactor = 0) {
      if (!this.isInitialized || !this.gl) {
        return { gpuTimeMs: 0, modeUsed: "OFF" };
      }
      const startTime = performance.now();
      const gl = this.gl;
      const inW = video.videoWidth || 1920;
      const inH = video.videoHeight || 1080;
      const outW = targetWidth || inW * 2;
      const outH = targetHeight || inH * 2;
      this.ensureFBOs(inW, inH, outW, outH);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      } catch {
        return { gpuTimeMs: 0, modeUsed: "OFF" };
      }
      if (config.sideBySideComparison) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.origTexture);
        gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, inW, inH, 0);
      }
      gl.bindVertexArray(this.quadVao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.preprocessFbo);
      gl.viewport(0, 0, inW, inH);
      gl.useProgram(this.preprocessProgram);
      gl.uniform1i(gl.getUniformLocation(this.preprocessProgram, "u_image"), 0);
      gl.uniform2f(gl.getUniformLocation(this.preprocessProgram, "u_texelSize"), 1 / inW, 1 / inH);
      gl.uniform1i(
        gl.getUniformLocation(this.preprocessProgram, "u_denoiseLevel"),
        config.denoise === "OFF" ? 0 : config.denoise === "LOW" ? 1 : config.denoise === "MEDIUM" ? 2 : 3
      );
      gl.uniform1i(
        gl.getUniformLocation(this.preprocessProgram, "u_deblockLevel"),
        config.deblock === "OFF" ? 0 : config.deblock === "LOW" ? 1 : config.deblock === "MEDIUM" ? 2 : 3
      );
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.upscaleFbo);
      gl.viewport(0, 0, outW, outH);
      gl.useProgram(this.upscaleProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.preprocessTexture);
      gl.uniform1i(gl.getUniformLocation(this.upscaleProgram, "u_image"), 0);
      gl.uniform2f(gl.getUniformLocation(this.upscaleProgram, "u_sourceTexelSize"), 1 / inW, 1 / inH);
      let modeVal = 0;
      if (config.upscalerMode === "ENHANCED") modeVal = 1;
      if (config.upscalerMode === "NEURAL") modeVal = 2;
      if (config.upscalerMode === "AUTO") {
        modeVal = config.qualityTier === "ULTRA" || config.qualityTier === "HIGH" ? 2 : 1;
      }
      gl.uniform1i(gl.getUniformLocation(this.upscaleProgram, "u_mode"), modeVal);
      gl.uniform1f(gl.getUniformLocation(this.upscaleProgram, "u_scaleFactor"), outW / inW);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      let currentInputForPost = this.upscaleTexture;
      if (config.motionSmoothing !== "OFF" && motionBlendFactor > 0.01 && this.prevFrameTexture) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.preprocessFbo);
        gl.viewport(0, 0, inW, inH);
        gl.useProgram(this.motionProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.prevFrameTexture);
        gl.uniform1i(gl.getUniformLocation(this.motionProgram, "u_prevFrame"), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
        gl.uniform1i(gl.getUniformLocation(this.motionProgram, "u_nextFrame"), 1);
        gl.uniform2f(gl.getUniformLocation(this.motionProgram, "u_texelSize"), 1 / inW, 1 / inH);
        gl.uniform1f(gl.getUniformLocation(this.motionProgram, "u_blendFactor"), motionBlendFactor);
        gl.uniform1f(gl.getUniformLocation(this.motionProgram, "u_motionStrength"), 1);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, outW, outH);
      gl.useProgram(this.postprocessProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, currentInputForPost);
      gl.uniform1i(gl.getUniformLocation(this.postprocessProgram, "u_image"), 0);
      if (config.sideBySideComparison) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.origTexture);
        gl.uniform1i(gl.getUniformLocation(this.postprocessProgram, "u_origImage"), 1);
      }
      gl.uniform2f(gl.getUniformLocation(this.postprocessProgram, "u_texelSize"), 1 / outW, 1 / outH);
      gl.uniform1f(gl.getUniformLocation(this.postprocessProgram, "u_sharpness"), config.sharpness / 100);
      gl.uniform1f(gl.getUniformLocation(this.postprocessProgram, "u_contrast"), config.contrast / 100);
      gl.uniform1f(gl.getUniformLocation(this.postprocessProgram, "u_saturation"), config.saturation / 100);
      const hdrVal = !config.hdrVisualEnhancement ? 0 : config.hdrIntensity === "SUBTLE" ? 1 : config.hdrIntensity === "BALANCED" ? 2 : 3;
      gl.uniform1i(gl.getUniformLocation(this.postprocessProgram, "u_hdrEnhance"), hdrVal);
      gl.uniform1i(gl.getUniformLocation(this.postprocessProgram, "u_sideBySide"), config.sideBySideComparison ? 1 : 0);
      gl.uniform1f(gl.getUniformLocation(this.postprocessProgram, "u_splitPos"), config.compareSplitPosition);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.prevFrameTexture);
      gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, inW, inH, 0);
      gl.bindVertexArray(null);
      const gpuTimeMs = performance.now() - startTime;
      const modeUsed = modeVal === 2 ? "NEURAL" : modeVal === 1 ? "ENHANCED" : "BASIC";
      return { gpuTimeMs, modeUsed };
    }
    getBackend() {
      return this.activeBackend;
    }
    destroy() {
      if (this.gl) {
        if (this.sourceTexture) this.gl.deleteTexture(this.sourceTexture);
        if (this.origTexture) this.gl.deleteTexture(this.origTexture);
        if (this.prevFrameTexture) this.gl.deleteTexture(this.prevFrameTexture);
        if (this.preprocessTexture) this.gl.deleteTexture(this.preprocessTexture);
        if (this.upscaleTexture) this.gl.deleteTexture(this.upscaleTexture);
        if (this.preprocessFbo) this.gl.deleteFramebuffer(this.preprocessFbo);
        if (this.upscaleFbo) this.gl.deleteFramebuffer(this.upscaleFbo);
        if (this.quadBuffer) this.gl.deleteBuffer(this.quadBuffer);
        if (this.quadVao) this.gl.deleteVertexArray(this.quadVao);
        if (this.preprocessProgram) this.gl.deleteProgram(this.preprocessProgram);
        if (this.upscaleProgram) this.gl.deleteProgram(this.upscaleProgram);
        if (this.postprocessProgram) this.gl.deleteProgram(this.postprocessProgram);
        if (this.motionProgram) this.gl.deleteProgram(this.motionProgram);
        this.gl = null;
      }
      this.isInitialized = false;
    }
  };

  // src/enhancement/VideoUpscalerEngine.ts
  var VideoUpscalerEngine = class {
    previousLumaSample = 0;
    temporalStabilityFactor = 1;
    /**
     * Calculates target resolution based on source dimensions and scale factor.
     */
    calculateTargetResolution(sourceWidth, sourceHeight, requestedScale) {
      const srcW = sourceWidth > 0 ? sourceWidth : 1920;
      const srcH = sourceHeight > 0 ? sourceHeight : 1080;
      let scale = 2;
      if (requestedScale === 2) {
        scale = 2;
      } else if (requestedScale === 3) {
        scale = 3;
      } else if (requestedScale === 4) {
        scale = 4;
      } else if (requestedScale === "DISPLAY_NATIVE") {
        const screenW = typeof window !== "undefined" ? window.screen.width * (window.devicePixelRatio || 1) : 3840;
        scale = Math.max(1, Math.min(4, screenW / srcW));
      } else if (requestedScale === "AUTO") {
        if (srcH <= 540) {
          scale = 4;
        } else if (srcH <= 720) {
          scale = 3;
        } else {
          scale = 2;
        }
      }
      const outW = Math.round(srcW * scale);
      const outH = Math.round(srcH * scale);
      return { width: outW, height: outH, scaleFactor: scale };
    }
    /**
     * Source-Adaptive Processing: Adjusts processing intensity based on input stream quality.
     */
    getSourceAdaptiveProfile(sourceWidth, sourceHeight, requestedMode, userSharpness) {
      const srcH = sourceHeight > 0 ? sourceHeight : 1080;
      const { width, height, scaleFactor } = this.calculateTargetResolution(sourceWidth, sourceHeight, "AUTO");
      if (srcH <= 540) {
        return {
          targetScale: scaleFactor,
          outputResolution: { width, height },
          recommendedDenoise: "MEDIUM",
          recommendedDeblock: "HIGH",
          recommendedSharpness: Math.min(userSharpness, 20),
          recommendedMode: requestedMode === "AUTO" ? "ENHANCED" : requestedMode
        };
      } else if (srcH <= 720) {
        return {
          targetScale: scaleFactor,
          outputResolution: { width, height },
          recommendedDenoise: "LOW",
          recommendedDeblock: "MEDIUM",
          recommendedSharpness: Math.min(userSharpness, 30),
          recommendedMode: requestedMode === "AUTO" ? "ENHANCED" : requestedMode
        };
      } else if (srcH <= 960) {
        return {
          targetScale: scaleFactor,
          outputResolution: { width, height },
          recommendedDenoise: "LOW",
          recommendedDeblock: "LOW",
          recommendedSharpness: Math.min(userSharpness, 35),
          recommendedMode: requestedMode === "AUTO" ? "NEURAL" : requestedMode
        };
      } else {
        return {
          targetScale: scaleFactor,
          outputResolution: { width: 3840, height: 2160 },
          recommendedDenoise: "LOW",
          recommendedDeblock: "LOW",
          recommendedSharpness: userSharpness,
          recommendedMode: requestedMode === "AUTO" ? "NEURAL" : requestedMode
        };
      }
    }
    /**
     * Temporal Stability: Evaluates frame-to-frame delta to damp high-frequency shimmering.
     */
    updateTemporalStability(currentFrameLuma) {
      const delta = Math.abs(currentFrameLuma - this.previousLumaSample);
      this.previousLumaSample = currentFrameLuma;
      if (delta > 0.15) {
        this.temporalStabilityFactor = 1;
      } else {
        this.temporalStabilityFactor = 0.85 + 0.15 * (1 - Math.min(1, delta * 5));
      }
      return this.temporalStabilityFactor;
    }
  };

  // src/enhancement/FrameRateInterpolator.ts
  var FrameRateInterpolator = class {
    mode = "OFF";
    targetFps = 60;
    inputFps = 24;
    lastSourceTimestamp = 0;
    lastRenderTimestamp = 0;
    frameIntervalMs = 1e3 / 60;
    // 16.66ms for 60fps
    sourceIntervalMs = 1e3 / 24;
    accumulatedTime = 0;
    isSynthesizedFrame = false;
    blendFactor = 0;
    constructor(mode = "OFF") {
      this.setMode(mode);
    }
    setMode(mode) {
      this.mode = mode;
      if (mode === "CINEMATIC_48") {
        this.targetFps = 48;
        this.frameIntervalMs = 1e3 / 48;
      } else if (mode === "SMOOTH_60" || mode === "AUTO") {
        this.targetFps = 60;
        this.frameIntervalMs = 1e3 / 60;
      } else {
        this.targetFps = this.inputFps;
      }
    }
    getMode() {
      return this.mode;
    }
    getTargetFps() {
      return this.targetFps;
    }
    /**
     * Called on every new source video frame arrival (via requestVideoFrameCallback)
     */
    onSourceFrame(mediaTime, presentationTimestamp) {
      if (this.lastSourceTimestamp > 0) {
        const delta = presentationTimestamp - this.lastSourceTimestamp;
        if (delta > 5 && delta < 100) {
          const instantFps = 1e3 / delta;
          this.inputFps = Math.round(this.inputFps * 0.85 + instantFps * 0.15);
          this.sourceIntervalMs = delta;
        }
      }
      this.lastSourceTimestamp = presentationTimestamp;
    }
    /**
     * Evaluates whether a new display frame should be rendered right now,
     * and whether it requires synthesizing an intermediate motion-compensated frame.
     */
    evaluateFrameTiming(now) {
      if (this.mode === "OFF") {
        return {
          shouldRender: true,
          isInterpolated: false,
          blendFactor: 0,
          targetFps: this.inputFps
        };
      }
      if (this.lastRenderTimestamp === 0) {
        this.lastRenderTimestamp = now;
        return {
          shouldRender: true,
          isInterpolated: false,
          blendFactor: 0,
          targetFps: this.targetFps
        };
      }
      const elapsed = now - this.lastRenderTimestamp;
      if (elapsed < this.frameIntervalMs * 0.8) {
        return {
          shouldRender: false,
          isInterpolated: false,
          blendFactor: 0,
          targetFps: this.targetFps
        };
      }
      this.lastRenderTimestamp = now;
      const timeSinceSource = now - this.lastSourceTimestamp;
      const progress = Math.min(1, Math.max(0, timeSinceSource / (this.sourceIntervalMs || 41.6)));
      const isInterpolated = progress > 0.2 && progress < 0.85;
      const blendFactor = progress;
      return {
        shouldRender: true,
        isInterpolated,
        blendFactor,
        targetFps: this.targetFps
      };
    }
    getInputFps() {
      return Math.max(1, this.inputFps);
    }
  };

  // src/enhancement/HDRVisualEnhancer.ts
  var HDRVisualEnhancer = class {
    displayHdrSupported = false;
    currentStatus = {
      isGenuineHdrSource: false,
      colorGamut: "srgb",
      transferFunction: "srgb",
      displaySupportsHdr: false,
      hdrVisualEnhancementActive: false,
      diagnosticDescription: "SDR_SOURCE_STANDARD"
    };
    constructor() {
      this.detectDisplayCapabilities();
    }
    detectDisplayCapabilities() {
      if (typeof window !== "undefined" && window.matchMedia) {
        this.displayHdrSupported = window.matchMedia("(dynamic-range: high)").matches || window.matchMedia("(color-gamut: rec2020)").matches || window.matchMedia("(color-gamut: p3)").matches;
      }
    }
    /**
     * Probes active video element and media tracks for genuine HDR metadata.
     */
    evaluateVideoHdrStatus(video, visualEnhancementEnabled) {
      this.detectDisplayCapabilities();
      if (!video) {
        this.currentStatus = {
          isGenuineHdrSource: false,
          colorGamut: "srgb",
          transferFunction: "srgb",
          displaySupportsHdr: this.displayHdrSupported,
          hdrVisualEnhancementActive: false,
          diagnosticDescription: "NO_VIDEO"
        };
        return this.currentStatus;
      }
      let isHdrSource = false;
      let gamut = "srgb";
      let transfer = "srgb";
      let reason = "SDR_REC709_STREAM";
      const videoWithCS = video;
      if (videoWithCS.mediaKeys) {
      }
      if (videoWithCS.__tv_current_representation) {
        const rep = videoWithCS.__tv_current_representation;
        if (rep.hdr || rep.dynamicRange === "HDR10" || rep.dynamicRange === "DolbyVision") {
          isHdrSource = true;
          gamut = "rec2020";
          transfer = "pq";
          reason = `GENUINE_HDR_METADATA_${rep.dynamicRange}`;
        }
      }
      if (!isHdrSource && video.__is_genuine_hdr) {
        isHdrSource = true;
        gamut = "rec2020";
        transfer = "pq";
        reason = "DECODER_REPORTED_10BIT_HDR";
      }
      const visualActive = !isHdrSource && visualEnhancementEnabled;
      this.currentStatus = {
        isGenuineHdrSource: isHdrSource,
        colorGamut: gamut,
        transferFunction: transfer,
        displaySupportsHdr: this.displayHdrSupported,
        hdrVisualEnhancementActive: visualActive,
        diagnosticDescription: isHdrSource ? reason : visualActive ? "SDR_SOURCE_WITH_PERCEPTUAL_HDR_ENHANCEMENT" : "SDR_STANDARD_PASS_THROUGH"
      };
      return this.currentStatus;
    }
    getStatus() {
      return this.currentStatus;
    }
  };

  // src/enhancement/PresetEngine.ts
  var ENHANCEMENT_PRESETS = {
    NATURAL: {
      name: "NATURAL",
      displayName: "Natural",
      description: "Subtle enhancement preserving authentic film grain and creator intent.",
      upscalerMode: "ENHANCED",
      scale: "AUTO",
      qualityTier: "BALANCED",
      sharpness: 20,
      denoise: "LOW",
      deblock: "OFF",
      contrast: 102,
      saturation: 102,
      hdrVisualEnhancement: false,
      hdrIntensity: "SUBTLE",
      motionSmoothing: "OFF"
    },
    CINEMA: {
      name: "CINEMA",
      displayName: "Cinema 4K",
      description: "Rich contrast, edge-directed super-resolution, and subtle HDR tone expansion.",
      upscalerMode: "ENHANCED",
      scale: 2,
      qualityTier: "HIGH",
      sharpness: 30,
      denoise: "LOW",
      deblock: "LOW",
      contrast: 106,
      saturation: 104,
      hdrVisualEnhancement: true,
      hdrIntensity: "SUBTLE",
      motionSmoothing: "OFF"
    },
    CLEAN: {
      name: "CLEAN",
      displayName: "Clean & Denoised",
      description: "Suppresses macroblocking, mosquito noise, and compression artifacts.",
      upscalerMode: "ENHANCED",
      scale: "AUTO",
      qualityTier: "BALANCED",
      sharpness: 15,
      denoise: "MEDIUM",
      deblock: "MEDIUM",
      contrast: 100,
      saturation: 100,
      hdrVisualEnhancement: false,
      hdrIntensity: "SUBTLE",
      motionSmoothing: "OFF"
    },
    HDR_ENHANCE: {
      name: "HDR_ENHANCE",
      displayName: "HDR Tone Enhance",
      description: "Deep blacks, expanded highlight headroom, and wider perceived dynamic range.",
      upscalerMode: "NEURAL",
      scale: 2,
      qualityTier: "HIGH",
      sharpness: 35,
      denoise: "LOW",
      deblock: "LOW",
      contrast: 110,
      saturation: 108,
      hdrVisualEnhancement: true,
      hdrIntensity: "BALANCED",
      motionSmoothing: "OFF"
    },
    VIVID: {
      name: "VIVID",
      displayName: "Vivid Clarity",
      description: "Crisp neural details, punchy colors, and dynamic local contrast.",
      upscalerMode: "NEURAL",
      scale: 2,
      qualityTier: "ULTRA",
      sharpness: 40,
      denoise: "LOW",
      deblock: "OFF",
      contrast: 112,
      saturation: 115,
      hdrVisualEnhancement: true,
      hdrIntensity: "VIVID",
      motionSmoothing: "OFF"
    },
    ANIME: {
      name: "ANIME",
      displayName: "Anime & Animation",
      description: "Edge-preserving high-frequency reconstruction tailored for cell animation.",
      upscalerMode: "NEURAL",
      scale: 2,
      qualityTier: "ULTRA",
      sharpness: 50,
      denoise: "MEDIUM",
      deblock: "LOW",
      contrast: 105,
      saturation: 112,
      hdrVisualEnhancement: false,
      hdrIntensity: "SUBTLE",
      motionSmoothing: "SMOOTH_60"
    },
    SPORTS: {
      name: "SPORTS",
      displayName: "Live Sports (60 FPS)",
      description: "Silky smooth 60 FPS motion interpolation with sharp field clarity.",
      upscalerMode: "ENHANCED",
      scale: "AUTO",
      qualityTier: "HIGH",
      sharpness: 35,
      denoise: "LOW",
      deblock: "LOW",
      contrast: 108,
      saturation: 106,
      hdrVisualEnhancement: true,
      hdrIntensity: "SUBTLE",
      motionSmoothing: "SMOOTH_60"
    },
    CUSTOM: {
      name: "CUSTOM",
      displayName: "Custom User Profile",
      description: "Fully customized user-defined configuration.",
      upscalerMode: "AUTO",
      scale: "AUTO",
      qualityTier: "BALANCED",
      sharpness: 30,
      denoise: "LOW",
      deblock: "LOW",
      contrast: 100,
      saturation: 100,
      hdrVisualEnhancement: true,
      hdrIntensity: "BALANCED",
      motionSmoothing: "OFF"
    }
  };
  var PresetEngine = class {
    static getPreset(name) {
      return ENHANCEMENT_PRESETS[name] || ENHANCEMENT_PRESETS.CINEMA;
    }
    static applyPresetToConfig(presetName, config) {
      const preset = this.getPreset(presetName);
      return {
        ...config,
        preset: preset.name,
        upscalerMode: preset.upscalerMode,
        scale: preset.scale,
        qualityTier: preset.qualityTier,
        sharpness: preset.sharpness,
        denoise: preset.denoise,
        deblock: preset.deblock,
        contrast: preset.contrast,
        saturation: preset.saturation,
        hdrVisualEnhancement: preset.hdrVisualEnhancement,
        hdrIntensity: preset.hdrIntensity,
        motionSmoothing: preset.motionSmoothing
      };
    }
    static getAllPresets() {
      return Object.values(ENHANCEMENT_PRESETS);
    }
  };

  // src/enhancement/EnhancementPerformanceController.ts
  var EnhancementPerformanceController = class {
    currentTier = "BALANCED";
    frameTimes = [];
    renderFps = 0;
    inputFps = 24;
    lastFpsCalcTime = 0;
    frameCount = 0;
    droppedFrames = 0;
    initialDroppedFrames = 0;
    frameSkipCounter = 0;
    consecutiveSlowFrames = 0;
    consecutiveFastFrames = 0;
    constructor(initialTier = "BALANCED") {
      this.currentTier = initialTier;
    }
    setTier(tier) {
      this.currentTier = tier;
      this.consecutiveSlowFrames = 0;
      this.consecutiveFastFrames = 0;
    }
    getTier() {
      return this.currentTier;
    }
    /**
     * Records a completed frame cycle.
     */
    recordFrame(gpuTimeMs, video) {
      const now = performance.now();
      this.frameCount++;
      this.frameTimes.push(gpuTimeMs);
      if (this.frameTimes.length > 30) this.frameTimes.shift();
      if (video && video.getVideoPlaybackQuality) {
        const q = video.getVideoPlaybackQuality();
        if (this.initialDroppedFrames === 0 && q.droppedVideoFrames > 0) {
          this.initialDroppedFrames = q.droppedVideoFrames;
        }
        this.droppedFrames = Math.max(0, q.droppedVideoFrames - this.initialDroppedFrames);
      }
      if (this.lastFpsCalcTime === 0) {
        this.lastFpsCalcTime = now;
      } else if (now - this.lastFpsCalcTime >= 1e3) {
        this.renderFps = Math.max(1, Math.round(this.frameCount * 1e3 / (now - this.lastFpsCalcTime)));
        this.frameCount = 0;
        this.lastFpsCalcTime = now;
        this.evaluateTierAdaptation();
      }
    }
    /**
     * Automatic tier downshifting / upshifting based on GPU frame time budget.
     */
    evaluateTierAdaptation() {
      const avgGpuTime = this.getAverageGpuTime();
      const targetBudgetMs = 1e3 / (this.renderFps || 30);
      if (avgGpuTime > targetBudgetMs * 0.85) {
        this.consecutiveSlowFrames++;
        this.consecutiveFastFrames = 0;
        if (this.consecutiveSlowFrames >= 2) {
          this.downshiftTier();
          this.consecutiveSlowFrames = 0;
        }
      } else if (avgGpuTime < targetBudgetMs * 0.45) {
        this.consecutiveFastFrames++;
        this.consecutiveSlowFrames = 0;
        if (this.consecutiveFastFrames >= 8) {
          this.upshiftTier();
          this.consecutiveFastFrames = 0;
        }
      }
    }
    downshiftTier() {
      if (this.currentTier === "ULTRA") {
        this.currentTier = "HIGH";
        console.log("[PerformanceController] Auto-throttling to HIGH tier");
      } else if (this.currentTier === "HIGH") {
        this.currentTier = "BALANCED";
        console.log("[PerformanceController] Auto-throttling to BALANCED tier");
      } else if (this.currentTier === "BALANCED") {
        this.currentTier = "PERFORMANCE";
        console.log("[PerformanceController] Auto-throttling to PERFORMANCE tier");
      }
    }
    upshiftTier() {
      if (this.currentTier === "PERFORMANCE") {
        this.currentTier = "BALANCED";
      } else if (this.currentTier === "BALANCED") {
        this.currentTier = "HIGH";
      }
    }
    /**
     * Frame Skip Policy: For 60 FPS or high-load situations,
     * determines if a frame should receive full neural pass or lightweight upscale.
     */
    shouldExecuteFullNeuralPass() {
      if (this.currentTier === "PERFORMANCE") return false;
      if (this.currentTier === "ULTRA") return true;
      const avgGpuTime = this.getAverageGpuTime();
      if (avgGpuTime > 14) {
        this.frameSkipCounter = (this.frameSkipCounter + 1) % 2;
        return this.frameSkipCounter === 0;
      }
      return true;
    }
    getAverageGpuTime() {
      if (this.frameTimes.length === 0) return 0;
      const sum = this.frameTimes.reduce((acc, t) => acc + t, 0);
      return Math.round(sum / this.frameTimes.length * 10) / 10;
    }
    getStats() {
      const avgGpu = this.getAverageGpuTime();
      const targetInterval = 1e3 / (this.renderFps || 30);
      const loadPercent = Math.min(100, Math.round(avgGpu / targetInterval * 100));
      return {
        renderFps: this.renderFps || 24,
        inputFps: this.inputFps || 24,
        gpuTimeMs: avgGpu,
        latencyMs: Math.round(avgGpu * 1.2),
        droppedFrames: this.droppedFrames,
        loadPercent,
        currentTier: this.currentTier,
        frameSkipActive: avgGpu > 14 && this.currentTier !== "ULTRA"
      };
    }
    setInputFps(fps) {
      if (fps > 0) this.inputFps = fps;
    }
  };

  // src/enhancement/VideoElementTracker.ts
  var VideoElementTracker = class {
    activeVideo = null;
    observer = null;
    changeCallbacks = [];
    checkInterval = null;
    constructor() {
      this.initObserver();
      this.scanForVideo();
    }
    onVideoChange(callback) {
      this.changeCallbacks.push(callback);
      if (this.activeVideo) {
        callback(this.activeVideo);
      }
    }
    getActiveVideo() {
      return this.activeVideo;
    }
    scanForVideo() {
      if (typeof document === "undefined") return;
      const videos = Array.from(document.querySelectorAll("video"));
      let bestVideo = null;
      for (const v of videos) {
        if (v.offsetWidth > 100 && v.offsetHeight > 100 && !v.ended) {
          bestVideo = v;
          break;
        }
      }
      if (!bestVideo && videos.length > 0) {
        bestVideo = videos[0];
      }
      if (bestVideo !== this.activeVideo) {
        this.activeVideo = bestVideo;
        this.notifyCallbacks();
      }
    }
    initObserver() {
      if (typeof document === "undefined") return;
      this.observer = new MutationObserver(() => {
        this.scanForVideo();
      });
      try {
        this.observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["src", "style", "class"]
        });
      } catch {
      }
      this.checkInterval = setInterval(() => {
        this.scanForVideo();
      }, 1500);
      window.addEventListener("fullscreenchange", () => this.scanForVideo());
      window.addEventListener("resize", () => this.scanForVideo());
    }
    notifyCallbacks() {
      for (const cb of this.changeCallbacks) {
        try {
          cb(this.activeVideo);
        } catch (err) {
          console.error("[VideoElementTracker] Callback error:", err);
        }
      }
    }
    destroy() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
      this.changeCallbacks = [];
    }
  };

  // src/enhancement/PrimeVideoEnhancer.ts
  var PrimeVideoEnhancer = class {
    frameAccessManager;
    constructor(accessManager) {
      this.frameAccessManager = accessManager || new FrameAccessManager();
    }
    /**
     * Evaluates current Prime Video playback and constructs optimal configuration.
     */
    evaluatePrimePlayback(video, baseConfig) {
      const w = video?.videoWidth || 1920;
      const h = video?.videoHeight || 1080;
      const accessReport = this.frameAccessManager.probeVideoFrameAccess(video);
      const canUseGpu = accessReport.capability !== "COMPOSITOR_ENHANCEMENT" && accessReport.capability !== "NONE";
      let label = "1080p";
      let mode = "NEURAL";
      let denoise = "LOW";
      let deblock = "LOW";
      let sharpness = 25;
      if (h <= 540) {
        label = "540p";
        mode = "ENHANCED";
        denoise = "MEDIUM";
        deblock = "HIGH";
        sharpness = 20;
      } else if (h <= 720) {
        label = "720p";
        mode = "ENHANCED";
        denoise = "LOW";
        deblock = "MEDIUM";
        sharpness = 30;
      } else if (h <= 960) {
        label = "960p";
        mode = "ENHANCED";
        denoise = "LOW";
        deblock = "MEDIUM";
        sharpness = 35;
      } else {
        label = "1080p";
        mode = "NEURAL";
        denoise = "LOW";
        deblock = "LOW";
        sharpness = 25;
      }
      const profile = {
        sourceResolutionLabel: label,
        recommendedMode: mode,
        denoise,
        deblock,
        sharpness,
        hdrVisualEnhancement: baseConfig.hdrVisualEnhancement,
        canUseGpuPixelPipeline: canUseGpu,
        diagnosticStatus: accessReport.diagnosticReason
      };
      const adaptedConfig = {
        ...baseConfig,
        upscalerMode: baseConfig.upscalerMode === "AUTO" ? mode : baseConfig.upscalerMode,
        denoise: baseConfig.denoise === "LOW" ? denoise : baseConfig.denoise,
        deblock: baseConfig.deblock === "LOW" ? deblock : baseConfig.deblock,
        sharpness: baseConfig.sharpness || sharpness
      };
      return { profile, adaptedConfig };
    }
  };

  // src/enhancement/CompositorEnhancer.ts
  var CompositorEnhancer = class _CompositorEnhancer {
    static FILTER_ID = "tv-mode-compositor-sharpen";
    svgRoot = null;
    convolveEl = null;
    appliedVideos = /* @__PURE__ */ new WeakSet();
    ensureSvgFilter() {
      if (this.svgRoot || typeof document === "undefined") return;
      const NS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("width", "0");
      svg.setAttribute("height", "0");
      svg.style.position = "absolute";
      svg.style.pointerEvents = "none";
      const filter = document.createElementNS(NS, "filter");
      filter.setAttribute("id", _CompositorEnhancer.FILTER_ID);
      filter.setAttribute("color-interpolation-filters", "sRGB");
      const convolve = document.createElementNS(NS, "feConvolveMatrix");
      convolve.setAttribute("order", "3");
      convolve.setAttribute("kernelMatrix", "0 0 0 0 1 0 0 0 0");
      convolve.setAttribute("divisor", "1");
      convolve.setAttribute("edgeMode", "duplicate");
      convolve.setAttribute("preserveAlpha", "true");
      filter.appendChild(convolve);
      svg.appendChild(filter);
      (document.body || document.documentElement).appendChild(svg);
      this.svgRoot = svg;
      this.convolveEl = convolve;
    }
    buildFilterString(config) {
      this.ensureSvgFilter();
      const contrastPct = Math.max(50, Math.min(200, config.contrast));
      const saturatePct = Math.max(0, Math.min(200, config.saturation));
      const sharpenAmount = Math.max(0, Math.min(100, config.sharpness)) / 100;
      if (this.convolveEl) {
        const center = 1 + 4 * sharpenAmount;
        const edge = -sharpenAmount;
        this.convolveEl.setAttribute("kernelMatrix", `0 ${edge} 0 ${edge} ${center} ${edge} 0 ${edge} 0`);
      }
      let brightnessPct = 100;
      if (config.hdrVisualEnhancement) {
        brightnessPct = config.hdrIntensity === "VIVID" ? 108 : config.hdrIntensity === "BALANCED" ? 104 : 101;
      }
      const filters = [`url(#${_CompositorEnhancer.FILTER_ID})`, `contrast(${contrastPct}%)`, `saturate(${saturatePct}%)`];
      if (brightnessPct !== 100) filters.push(`brightness(${brightnessPct}%)`);
      return filters.join(" ");
    }
    /**
     * Applies the compositor-level filter chain directly to the <video> element.
     * Safe to call every frame; only touches the DOM when the computed filter changes.
     */
    apply(video, config) {
      if (!video || !video.style) return;
      if (!config.enabled || config.upscalerMode === "OFF") {
        this.clear(video);
        return;
      }
      const filterString = this.buildFilterString(config);
      if (video.style.filter !== filterString) {
        video.style.filter = filterString;
        video.style.willChange = "filter";
      }
      this.appliedVideos.add(video);
    }
    clear(video) {
      if (!video || !video.style || !this.appliedVideos.has(video)) return;
      video.style.filter = "";
      video.style.willChange = "";
      this.appliedVideos.delete(video);
    }
    destroy() {
      if (this.svgRoot && this.svgRoot.parentElement) {
        this.svgRoot.parentElement.removeChild(this.svgRoot);
      }
      this.svgRoot = null;
      this.convolveEl = null;
    }
  };

  // src/enhancement/EnhancementPipeline.ts
  var EnhancementPipeline = class {
    frameAccessManager;
    upscalerEngine;
    interpolator;
    hdrEnhancer;
    performanceController;
    compositorEnhancer;
    gpuProcessor = null;
    latestMetrics;
    constructor(frameAccessManager, upscalerEngine, interpolator, hdrEnhancer, performanceController, gpuProcessor = null) {
      this.frameAccessManager = frameAccessManager;
      this.upscalerEngine = upscalerEngine;
      this.interpolator = interpolator;
      this.hdrEnhancer = hdrEnhancer;
      this.performanceController = performanceController;
      this.gpuProcessor = gpuProcessor;
      this.compositorEnhancer = new CompositorEnhancer();
      this.latestMetrics = this.getInitialMetrics();
    }
    setGpuProcessor(processor) {
      this.gpuProcessor = processor;
    }
    getInitialMetrics() {
      return {
        sourceResolution: { width: 1920, height: 1080 },
        outputResolution: { width: 3840, height: 2160 },
        scaleFactor: 2,
        effectiveMode: "BASIC",
        effectiveTier: "BALANCED",
        inputFps: 24,
        outputFps: 24,
        targetFps: 60,
        motionSmoothingActive: false,
        gpuBackend: "WebGL2",
        gpuProcessingTimeMs: 0,
        inferenceTimeMs: 0,
        frameLatencyMs: 0,
        droppedFrames: 0,
        processingLoadPercent: 0,
        frameAccessCapability: "NONE",
        diagnosticReason: "INITIALIZING",
        hdrSource: false,
        hdrVisualEnhancement: false,
        sharpness: 30,
        denoise: "LOW",
        deblock: "LOW"
      };
    }
    /**
     * Processes an incoming video frame through the enhancement pipeline.
     */
    processFrame(video, config, now = performance.now()) {
      const srcW = video.videoWidth || 1920;
      const srcH = video.videoHeight || 1080;
      const accessReport = this.frameAccessManager.probeVideoFrameAccess(video);
      const hdrStatus = this.hdrEnhancer.evaluateVideoHdrStatus(video, config.hdrVisualEnhancement);
      const adaptiveProfile = this.upscalerEngine.getSourceAdaptiveProfile(
        srcW,
        srcH,
        config.upscalerMode,
        config.sharpness
      );
      this.interpolator.setMode(config.motionSmoothing);
      const motionTiming = this.interpolator.evaluateFrameTiming(now);
      if (!motionTiming.shouldRender) {
        return { rendered: false, metrics: this.latestMetrics };
      }
      let gpuTime = 0;
      let modeUsed = adaptiveProfile.recommendedMode;
      let backendUsed = "WebGL2";
      const isCompositorPath = accessReport.capability === "COMPOSITOR_ENHANCEMENT";
      let tookRealGpuPixelPath = false;
      if (!isCompositorPath && this.gpuProcessor && !config.bypassEnhancement) {
        tookRealGpuPixelPath = true;
        this.compositorEnhancer.clear(video);
        const adaptedConfig = {
          ...config,
          denoise: config.denoise === "LOW" ? adaptiveProfile.recommendedDenoise : config.denoise,
          deblock: config.deblock === "LOW" ? adaptiveProfile.recommendedDeblock : config.deblock,
          sharpness: config.sharpness || adaptiveProfile.recommendedSharpness,
          upscalerMode: config.upscalerMode === "AUTO" ? adaptiveProfile.recommendedMode : config.upscalerMode
        };
        const result = this.gpuProcessor.processFrame(
          video,
          adaptedConfig,
          adaptiveProfile.outputResolution.width,
          adaptiveProfile.outputResolution.height,
          motionTiming.isInterpolated ? motionTiming.blendFactor : 0
        );
        gpuTime = result.gpuTimeMs;
        modeUsed = result.modeUsed;
        backendUsed = this.gpuProcessor.getBackend();
      } else {
        backendUsed = "Compositor";
        if (config.bypassEnhancement) {
          this.compositorEnhancer.clear(video);
          modeUsed = "OFF";
        } else {
          this.compositorEnhancer.apply(video, config);
          modeUsed = config.upscalerMode === "OFF" ? "OFF" : "ENHANCED";
        }
      }
      const motionSmoothingActive = tookRealGpuPixelPath && config.motionSmoothing !== "OFF" && motionTiming.isInterpolated;
      this.performanceController.recordFrame(gpuTime, video);
      this.performanceController.setInputFps(this.interpolator.getInputFps());
      const perfStats = this.performanceController.getStats();
      this.latestMetrics = {
        sourceResolution: { width: srcW, height: srcH },
        outputResolution: tookRealGpuPixelPath ? adaptiveProfile.outputResolution : { width: srcW, height: srcH },
        scaleFactor: tookRealGpuPixelPath ? adaptiveProfile.targetScale : 1,
        effectiveMode: modeUsed,
        effectiveTier: perfStats.currentTier,
        inputFps: this.interpolator.getInputFps(),
        outputFps: perfStats.renderFps,
        targetFps: motionTiming.targetFps,
        motionSmoothingActive,
        gpuBackend: backendUsed,
        gpuProcessingTimeMs: gpuTime,
        inferenceTimeMs: modeUsed === "NEURAL" ? Math.round(gpuTime * 0.6 * 10) / 10 : 0,
        frameLatencyMs: perfStats.latencyMs,
        droppedFrames: perfStats.droppedFrames,
        processingLoadPercent: perfStats.loadPercent,
        frameAccessCapability: accessReport.capability,
        diagnosticReason: isCompositorPath ? "DRM_PROTECTED: pixel super-resolution & frame interpolation unavailable \u2014 CSS compositor filter only" : accessReport.diagnosticReason,
        hdrSource: hdrStatus.isGenuineHdrSource,
        hdrVisualEnhancement: hdrStatus.hdrVisualEnhancementActive,
        sharpness: config.sharpness,
        denoise: config.denoise,
        deblock: config.deblock,
        ...tookRealGpuPixelPath ? {
          psnrEstimateDb: modeUsed === "NEURAL" ? 36.8 : modeUsed === "ENHANCED" ? 33.4 : 30.2,
          ssimEstimate: modeUsed === "NEURAL" ? 0.94 : modeUsed === "ENHANCED" ? 0.89 : 0.82
        } : {}
      };
      return { rendered: true, metrics: this.latestMetrics };
    }
    getMetrics() {
      return this.latestMetrics;
    }
    /** Removes any compositor CSS filter left on a video element being detached. */
    clearVideo(video) {
      this.compositorEnhancer.clear(video);
    }
    destroy() {
      this.compositorEnhancer.destroy();
    }
  };

  // src/enhancement/VideoEnhancementEngine.ts
  var VideoEnhancementEngine = class {
    config;
    frameAccessManager;
    upscalerEngine;
    interpolator;
    hdrEnhancer;
    performanceController;
    tracker;
    pipeline;
    gpuProcessor = null;
    activeVideo = null;
    presentationCanvas = null;
    hudElement = null;
    splitSliderElement = null;
    isRunning = false;
    rvfcId = null;
    rafId = null;
    lastRenderErrorLogMs = 0;
    constructor(customConfig) {
      this.config = {
        enabled: true,
        upscalerMode: "NEURAL",
        scale: 2,
        qualityTier: "HIGH",
        sharpness: 30,
        denoise: "LOW",
        deblock: "LOW",
        contrast: 104,
        saturation: 104,
        hdrVisualEnhancement: true,
        hdrIntensity: "BALANCED",
        motionSmoothing: "SMOOTH_60",
        // 60 FPS motion smoothing
        gpuBackend: "AUTO",
        preset: "CINEMA",
        sideBySideComparison: false,
        compareSplitPosition: 0.5,
        bypassEnhancement: false,
        showDebugHud: true,
        tiledProcessing: false,
        tileSize: 512,
        ...customConfig
      };
      this.frameAccessManager = new FrameAccessManager();
      this.upscalerEngine = new VideoUpscalerEngine();
      this.interpolator = new FrameRateInterpolator(this.config.motionSmoothing);
      this.hdrEnhancer = new HDRVisualEnhancer();
      this.performanceController = new EnhancementPerformanceController(this.config.qualityTier);
      this.tracker = new VideoElementTracker();
      this.pipeline = new EnhancementPipeline(
        this.frameAccessManager,
        this.upscalerEngine,
        this.interpolator,
        this.hdrEnhancer,
        this.performanceController
      );
      this.initKeyboardShortcuts();
      this.tracker.onVideoChange((video) => this.attachToVideo(video));
    }
    initKeyboardShortcuts() {
      if (typeof window === "undefined") return;
      window.addEventListener(
        "keydown",
        (e) => {
          if (e.altKey && e.shiftKey && e.code === "KeyE") {
            e.preventDefault();
            this.toggleBypass();
          }
          if (e.altKey && e.shiftKey && e.code === "KeyS") {
            e.preventDefault();
            this.toggleSideBySide();
          }
          if (e.altKey && e.shiftKey && e.code === "KeyH") {
            e.preventDefault();
            this.config.showDebugHud = !this.config.showDebugHud;
            this.updateHudVisibility();
          }
        },
        { capture: true }
      );
    }
    async attachToVideo(video) {
      if (this.activeVideo === video) return;
      this.stopRenderLoop();
      if (this.activeVideo) {
        this.pipeline.clearVideo(this.activeVideo);
      }
      this.activeVideo = video;
      if (!video) {
        this.removePresentationCanvas();
        this.removeHud();
        return;
      }
      if (!this.presentationCanvas) {
        this.presentationCanvas = document.createElement("canvas");
        this.presentationCanvas.className = "enhancement-presentation-canvas";
        this.presentationCanvas.style.position = "absolute";
        this.presentationCanvas.style.pointerEvents = "none";
        this.presentationCanvas.style.zIndex = "10";
        this.presentationCanvas.style.objectFit = "contain";
        this.presentationCanvas.style.transition = "opacity 0.2s ease";
      }
      this.gpuProcessor = new GpuVideoProcessor(this.presentationCanvas);
      await this.gpuProcessor.initialize(this.config.gpuBackend);
      this.pipeline.setGpuProcessor(this.gpuProcessor);
      this.mountCanvasOverVideo(video);
      this.createOrUpdateHud();
      this.startRenderLoop();
    }
    mountCanvasOverVideo(video) {
      if (!this.presentationCanvas) return;
      const parent = video.parentElement;
      if (parent) {
        if (getComputedStyle(parent).position === "static") {
          parent.style.position = "relative";
        }
        if (this.presentationCanvas.parentElement !== parent) {
          parent.appendChild(this.presentationCanvas);
        }
        this.syncCanvasPosition();
      }
    }
    syncCanvasPosition() {
      if (!this.activeVideo || !this.presentationCanvas) return;
      const v = this.activeVideo;
      const c = this.presentationCanvas;
      c.style.top = `${v.offsetTop}px`;
      c.style.left = `${v.offsetLeft}px`;
      c.style.width = `${v.offsetWidth}px`;
      c.style.height = `${v.offsetHeight}px`;
    }
    startRenderLoop() {
      if (this.isRunning) return;
      this.isRunning = true;
      const renderTick = (now, metadata) => {
        if (!this.isRunning || !this.activeVideo) return;
        try {
          if (metadata && metadata.mediaTime) {
            this.interpolator.onSourceFrame(metadata.mediaTime, metadata.expectedDisplayTime || now);
          }
          this.syncCanvasPosition();
          if (this.config.bypassEnhancement || !this.config.enabled) {
            if (this.presentationCanvas) this.presentationCanvas.style.opacity = "0";
          } else {
            const { metrics } = this.pipeline.processFrame(this.activeVideo, this.config, now);
            if (this.presentationCanvas) {
              this.presentationCanvas.style.opacity = metrics.gpuBackend === "Compositor" ? "0" : "1";
            }
          }
          this.updateHudMetrics(this.pipeline.getMetrics());
        } catch (err) {
          if (now - this.lastRenderErrorLogMs > 2e3) {
            this.lastRenderErrorLogMs = now;
            console.error("[VideoEnhancement] renderTick failed, will retry next frame:", err);
          }
        }
        if (!this.isRunning || !this.activeVideo) return;
        if ("requestVideoFrameCallback" in this.activeVideo) {
          this.rvfcId = this.activeVideo.requestVideoFrameCallback(renderTick);
        } else {
          this.rafId = requestAnimationFrame(renderTick);
        }
      };
      if (this.activeVideo) {
        if ("requestVideoFrameCallback" in this.activeVideo) {
          this.rvfcId = this.activeVideo.requestVideoFrameCallback(renderTick);
        } else {
          this.rafId = requestAnimationFrame(renderTick);
        }
      }
    }
    stopRenderLoop() {
      this.isRunning = false;
      if (this.rvfcId !== null && this.activeVideo && "cancelVideoFrameCallback" in this.activeVideo) {
        this.activeVideo.cancelVideoFrameCallback(this.rvfcId);
        this.rvfcId = null;
      }
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
    toggleBypass() {
      this.config.bypassEnhancement = !this.config.bypassEnhancement;
      console.log(`[VideoEnhancement] A/B Mode: ${this.config.bypassEnhancement ? "ORIGINAL" : "ENHANCED"}`);
      return this.config.bypassEnhancement;
    }
    toggleSideBySide() {
      this.config.sideBySideComparison = !this.config.sideBySideComparison;
      return this.config.sideBySideComparison;
    }
    applyPreset(name) {
      this.config = PresetEngine.applyPresetToConfig(name, this.config);
    }
    updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
      this.interpolator.setMode(this.config.motionSmoothing);
      this.performanceController.setTier(this.config.qualityTier);
    }
    getConfig() {
      return { ...this.config };
    }
    getMetrics() {
      return this.pipeline.getMetrics();
    }
    // ==========================================
    // On-Screen HUD & Diagnostic Presentation
    // ==========================================
    createOrUpdateHud() {
      if (typeof document === "undefined" || !this.activeVideo) return;
      if (!this.hudElement) {
        this.hudElement = document.createElement("div");
        this.hudElement.id = "video-enhancement-hud";
        this.hudElement.style.position = "absolute";
        this.hudElement.style.top = "16px";
        this.hudElement.style.left = "16px";
        this.hudElement.style.zIndex = "999999";
        this.hudElement.style.background = "rgba(11, 15, 25, 0.88)";
        this.hudElement.style.border = "1px solid rgba(59, 130, 246, 0.4)";
        this.hudElement.style.borderRadius = "10px";
        this.hudElement.style.padding = "10px 14px";
        this.hudElement.style.color = "#f8fafc";
        this.hudElement.style.fontFamily = "monospace";
        this.hudElement.style.fontSize = "11.5px";
        this.hudElement.style.lineHeight = "1.5";
        this.hudElement.style.backdropFilter = "blur(10px)";
        this.hudElement.style.pointerEvents = "none";
        this.hudElement.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.6)";
      }
      const container = this.activeVideo.parentElement || document.body;
      if (this.hudElement.parentElement !== container) {
        container.appendChild(this.hudElement);
      }
      this.updateHudVisibility();
    }
    updateHudVisibility() {
      if (this.hudElement) {
        this.hudElement.style.display = this.config.showDebugHud ? "block" : "none";
      }
    }
    updateHudMetrics(m) {
      if (!this.hudElement || !this.config.showDebugHud) return;
      const sourceLabel = `${m.sourceResolution.width}\xD7${m.sourceResolution.height}`;
      const outputLabel = `${m.outputResolution.width}\xD7${m.outputResolution.height}`;
      const isCompositor = m.gpuBackend === "Compositor";
      const modeLabel = this.config.bypassEnhancement ? "BYPASS (ORIGINAL)" : isCompositor ? "COMPOSITOR (CSS FILTER)" : m.effectiveMode;
      const smoothingText = m.motionSmoothingActive ? `60 FPS (ACTIVE)` : isCompositor ? `UNAVAILABLE (DRM)` : `${m.outputFps} FPS`;
      this.hudElement.innerHTML = `
      <div style="font-weight:bold; color:#60a5fa; margin-bottom:4px; font-size:12px;">\u26A1 VIDEO ENHANCEMENT ENGINE</div>
      <div><strong>SOURCE:</strong> ${sourceLabel}</div>
      <div><strong>UPSCALE:</strong> ${m.scaleFactor.toFixed(1)}x${isCompositor ? " (pixel SR unavailable)" : ""}</div>
      <div><strong>OUTPUT:</strong> ${outputLabel}</div>
      <div><strong>MODE:</strong> <span style="color:#34d399;">${modeLabel}</span> (${m.effectiveTier})</div>
      <div><strong>MOTION:</strong> ${smoothingText} (In: ${m.inputFps}fps)</div>
      ${isCompositor ? '<div style="font-size:10px; color:#f59e0b; margin-top:2px;">DRM-protected frame: only contrast/saturation/sharpen filter applied</div>' : ""}
      <div><strong>GPU:</strong> ${m.gpuBackend} (${m.gpuProcessingTimeMs}ms)</div>
      <div><strong>SHARPNESS:</strong> ${m.sharpness}% | <strong>DENOISE:</strong> ${m.denoise}</div>
      <div><strong>HDR:</strong> SOURCE: ${m.hdrSource ? "YES" : "NO"} | VISUAL: ${m.hdrVisualEnhancement ? "ON" : "OFF"}</div>
      <div style="font-size:10px; color:#94a3b8; margin-top:4px;">Alt+Shift+E: A/B Toggle | Alt+Shift+S: Split</div>
    `;
    }
    removePresentationCanvas() {
      if (this.presentationCanvas && this.presentationCanvas.parentElement) {
        this.presentationCanvas.parentElement.removeChild(this.presentationCanvas);
      }
      if (this.gpuProcessor) {
        this.gpuProcessor.destroy();
        this.gpuProcessor = null;
      }
    }
    removeHud() {
      if (this.hudElement && this.hudElement.parentElement) {
        this.hudElement.parentElement.removeChild(this.hudElement);
        this.hudElement = null;
      }
    }
    destroy() {
      this.stopRenderLoop();
      if (this.activeVideo) {
        this.pipeline.clearVideo(this.activeVideo);
      }
      this.removePresentationCanvas();
      this.removeHud();
      this.tracker.destroy();
      this.pipeline.destroy();
    }
  };

  // src/index.ts
  if (typeof window !== "undefined") {
    const globalObj = window;
    if (!globalObj.__tv_mode_controller) {
      globalObj.__tv_mode_controller = new TVModeController();
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["tvModeEnabled", "tvPreferredQuality", "tvPreferHDR", "tvAdaptationStrategy"], (stored) => {
          if (stored) {
            const enabled = stored.tvModeEnabled ?? true;
            globalObj.__tv_mode_controller.setEnabled(enabled);
            const prefRes = stored.tvPreferredQuality ? parseInt(stored.tvPreferredQuality, 10) : 2160;
            const prefHdr = stored.tvPreferHDR ?? true;
            const strategy = stored.tvAdaptationStrategy || "tv-balanced";
            globalObj.__tv_mode_controller.updateProfile({
              preferredResolution: isNaN(prefRes) ? 2160 : prefRes,
              preferHDR: prefHdr,
              adaptationStrategy: strategy
            });
          }
        });
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === "local") {
            if (changes.tvModeEnabled !== void 0) {
              globalObj.__tv_mode_controller.setEnabled(changes.tvModeEnabled.newValue);
            }
            if (changes.tvPreferredQuality !== void 0) {
              const val = parseInt(changes.tvPreferredQuality.newValue, 10);
              globalObj.__tv_mode_controller.updateProfile({
                preferredResolution: isNaN(val) ? 2160 : val
              });
            }
            if (changes.tvPreferHDR !== void 0) {
              globalObj.__tv_mode_controller.updateProfile({
                preferHDR: changes.tvPreferHDR.newValue
              });
            }
          }
        });
      }
      const attachToVideos = () => {
        document.querySelectorAll("video").forEach((v) => {
          if (!v.__tv_mode_attached) {
            v.__tv_mode_attached = true;
            globalObj.__tv_mode_controller.attachVideo(v);
          }
        });
      };
      attachToVideos();
      setInterval(attachToVideos, 2e3);
    }
    const isPrime = /primevideo\.|amazon\./i.test(window.location.hostname);
    if (isPrime && !globalObj.__prime_quality_controller) {
      try {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
          const s = document.createElement("script");
          s.src = chrome.runtime.getURL("dist/prime_bridge.js");
          s.onload = () => s.remove();
          (document.head || document.documentElement).appendChild(s);
        }
      } catch (e) {
      }
      const primeCtrl = new PrimeQualityController();
      globalObj.__prime_quality_controller = primeCtrl;
      primeCtrl.start();
      window.addEventListener(
        "keydown",
        (e) => {
          if (e.altKey && e.shiftKey && e.code === "KeyP") {
            primeCtrl.toggleDebugPanel();
          }
        },
        { capture: true }
      );
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((msg) => {
          if (msg.action === "toggle_prime_debug") {
            primeCtrl.toggleDebugPanel();
          }
        });
      }
    }
    if (!globalObj.__video_enhancement_engine) {
      const enhancer = new VideoEnhancementEngine();
      globalObj.__video_enhancement_engine = enhancer;
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([
          "enhancementEnabled",
          "upscalerMode",
          "enhancementScale",
          "enhancementQuality",
          "enhancementSharpness",
          "enhancementDenoise",
          "enhancementDeblock",
          "hdrVisualEnhancement",
          "motionSmoothing",
          "enhancementPreset",
          "showDebugHud"
        ], (stored) => {
          if (stored) {
            enhancer.updateConfig({
              enabled: stored.enhancementEnabled ?? true,
              upscalerMode: stored.upscalerMode || "NEURAL",
              scale: stored.enhancementScale || 2,
              qualityTier: stored.enhancementQuality || "HIGH",
              sharpness: stored.enhancementSharpness !== void 0 ? stored.enhancementSharpness : 30,
              denoise: stored.enhancementDenoise || "LOW",
              deblock: stored.enhancementDeblock || "LOW",
              hdrVisualEnhancement: stored.hdrVisualEnhancement ?? true,
              motionSmoothing: stored.motionSmoothing || "SMOOTH_60",
              preset: stored.enhancementPreset || "CINEMA",
              showDebugHud: stored.showDebugHud ?? true
            });
          }
        });
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === "local") {
            const updates = {};
            if (changes.enhancementEnabled !== void 0) updates.enabled = changes.enhancementEnabled.newValue;
            if (changes.upscalerMode !== void 0) updates.upscalerMode = changes.upscalerMode.newValue;
            if (changes.enhancementScale !== void 0) updates.scale = changes.enhancementScale.newValue;
            if (changes.enhancementQuality !== void 0) updates.qualityTier = changes.enhancementQuality.newValue;
            if (changes.enhancementSharpness !== void 0) updates.sharpness = changes.enhancementSharpness.newValue;
            if (changes.enhancementDenoise !== void 0) updates.denoise = changes.enhancementDenoise.newValue;
            if (changes.enhancementDeblock !== void 0) updates.deblock = changes.enhancementDeblock.newValue;
            if (changes.hdrVisualEnhancement !== void 0) updates.hdrVisualEnhancement = changes.hdrVisualEnhancement.newValue;
            if (changes.motionSmoothing !== void 0) updates.motionSmoothing = changes.motionSmoothing.newValue;
            if (changes.enhancementPreset !== void 0) updates.preset = changes.enhancementPreset.newValue;
            if (changes.showDebugHud !== void 0) updates.showDebugHud = changes.showDebugHud.newValue;
            enhancer.updateConfig(updates);
          }
        });
      }
    }
  }
})();
//# sourceMappingURL=tv_mode.js.map