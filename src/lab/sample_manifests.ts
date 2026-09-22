/**
 * Sample Authorized / Synthetic HLS & DASH Test Manifests
 * Representing modern 4K HDR TV stream ladders across HEVC, AV1, VP9, and H.264
 */

export const SAMPLE_4K_HDR_HLS_MANIFEST = `#EXTM3U
#EXT-X-VERSION:7

# 4K HDR10 (HEVC Main 10 @ 60 FPS, 18.5 Mbps)
#EXT-X-STREAM-INF:BANDWIDTH=18500000,AVERAGE-BANDWIDTH=18000000,RESOLUTION=3840x2160,CODECS="hvc1.2.4.L150.B0",FRAME-RATE=60.000,VIDEO-RANGE=PQ
manifest_4k_hdr_hevc.m3u8

# 4K SDR (AV1 Main Profile @ 60 FPS, 14 Mbps)
#EXT-X-STREAM-INF:BANDWIDTH=14000000,AVERAGE-BANDWIDTH=13500000,RESOLUTION=3840x2160,CODECS="av01.0.12M.08",FRAME-RATE=60.000,VIDEO-RANGE=SDR
manifest_4k_sdr_av1.m3u8

# 1440p (QHD) HDR (VP9 Profile 2 @ 60 FPS, 10 Mbps)
#EXT-X-STREAM-INF:BANDWIDTH=10000000,AVERAGE-BANDWIDTH=9500000,RESOLUTION=2560x1440,CODECS="vp09.02.51.10.01.09.16.09.00",FRAME-RATE=60.000,VIDEO-RANGE=PQ
manifest_1440p_hdr_vp9.m3u8

# 1080p (Full HD) SDR (H.264 High Profile @ 60 FPS, 5.8 Mbps)
#EXT-X-STREAM-INF:BANDWIDTH=5800000,AVERAGE-BANDWIDTH=5500000,RESOLUTION=1920x1080,CODECS="avc1.640028",FRAME-RATE=60.000,VIDEO-RANGE=SDR
manifest_1080p_sdr_h264.m3u8

# 720p (HD) SDR (H.264 @ 30 FPS, 2.8 Mbps)
#EXT-X-STREAM-INF:BANDWIDTH=2800000,AVERAGE-BANDWIDTH=2600000,RESOLUTION=1280x720,CODECS="avc1.4d401f",FRAME-RATE=30.000,VIDEO-RANGE=SDR
manifest_720p_sdr_h264.m3u8
`;

export const SAMPLE_4K_HDR_DASH_MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" minBufferTime="PT4S" type="static" mediaPresentationDuration="PT30M">
  <Period id="0">
    <AdaptationSet id="0" contentType="video" mimeType="video/mp4" maxWidth="3840" maxHeight="2160" maxFrameRate="60" par="16:9">
      <SupplementalProperty schemeIdUri="urn:mpeg:mpegB:cicp:ColourPrimaries" value="9"/>
      <SupplementalProperty schemeIdUri="urn:mpeg:mpegB:cicp:TransferCharacteristics" value="16"/>
      <SupplementalProperty schemeIdUri="urn:mpeg:mpegB:cicp:MatrixCoefficients" value="9"/>

      <!-- 4K HDR10 60 FPS (HEVC Main 10) -->
      <Representation id="dash-4k-hdr" bandwidth="19000000" width="3840" height="2160" frameRate="60" codecs="hvc1.2.4.L150.B0" />

      <!-- 4K SDR 60 FPS (AV1) -->
      <Representation id="dash-4k-sdr-av1" bandwidth="13500000" width="3840" height="2160" frameRate="60" codecs="av01.0.12M.08" />

      <!-- 1440p HDR10 60 FPS (VP9 Profile 2) -->
      <Representation id="dash-1440p-hdr-vp9" bandwidth="9800000" width="2560" height="1440" frameRate="60" codecs="vp09.02.51.10.01.09.16.09.00" />

      <!-- 1080p SDR 60 FPS (H.264) -->
      <Representation id="dash-1080p-sdr" bandwidth="5500000" width="1920" height="1080" frameRate="60" codecs="avc1.640028" />

      <!-- 720p SDR 30 FPS (H.264) -->
      <Representation id="dash-720p-sdr" bandwidth="2600000" width="1280" height="720" frameRate="30" codecs="avc1.4d401f" />
    </AdaptationSet>
  </Period>
</MPD>
`;

export const SAMPLE_1080P_ONLY_HLS_MANIFEST = `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-STREAM-INF:BANDWIDTH=4800000,RESOLUTION=1920x1080,CODECS="avc1.640028",FRAME-RATE=30.000
1080p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2400000,RESOLUTION=1280x720,CODECS="avc1.4d401f",FRAME-RATE=30.000
720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=854x480,CODECS="avc1.4d401e",FRAME-RATE=30.000
480p.m3u8
`;
