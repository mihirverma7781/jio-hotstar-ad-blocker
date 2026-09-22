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
      if (is10Bit && hasHdrColorSpace) {
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
      window.addEventListener("keydown", (e) => {
        if (e.altKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
          e.preventDefault();
          this.toggleHUD();
        }
      });
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
  }
})();
//# sourceMappingURL=tv_mode.js.map