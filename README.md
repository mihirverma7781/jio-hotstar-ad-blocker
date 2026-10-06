# JioHotstar & Amazon Prime Video Ad Skipper ⚡

[![Live Website](https://img.shields.io/badge/Live_Website-mihirverma7781.github.io-3b82f6?style=for-the-badge&logo=googlechrome&logoColor=white)](https://mihirverma7781.github.io/jio-hotstar-ad-blocker/)
[![GitHub stars](https://img.shields.io/github/stars/mihirverma7781/jio-hotstar-ad-blocker?style=for-the-badge&color=f59e0b)](https://github.com/mihirverma7781/jio-hotstar-ad-blocker/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)](LICENSE)

> 🌐 **Official Website & Interactive Simulator**: [https://mihirverma7781.github.io/jio-hotstar-ad-blocker/](https://mihirverma7781.github.io/jio-hotstar-ad-blocker/)

A high-performance Chrome Extension (Manifest V3) designed to automatically fast-forward (16x), mute, and skip in-video advertisements on **JioHotstar** (`hotstar.com`), **JioCinema** (`jiocinema.com`), **JioStar** (`jiostar.com`), and **Amazon Prime Video** (`primevideo.com` / `amazon.com` / `amazon.in` / regional domains).

Provides an uninterrupted, seamless viewing experience across streaming giants without breaking video playback streams or tampering with DRM.

---

<p align="center">
  <a href="https://mihirverma7781.github.io/jio-hotstar-ad-blocker/">
    <img src="assets/hero.jpg" alt="JioHotstar & Prime Video Ad Skipper Cinema Experience" width="100%" style="border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.5);" />
  </a>
</p>

---

## 🌐 Landing Website & Live Demo

Visit the [Live Project Website](https://mihirverma7781.github.io/jio-hotstar-ad-blocker/) to explore:
* **Interactive Ad Bypass Simulator**: Test how the extension detects ad cues, silences audio, and accelerates through commercials at 16x speed on both Hotstar and Prime Video.
* **Feature Breakdown**: Detailed look at multi-platform in-video speedup and cosmetic banner purge.
* **Visual Previews**: Screenshots of the extension popup dashboard and cinema mode HUD.

---

## 🚀 Key Features

* **⚡ Ultra-Fast Playback (up to 16x)**: When an in-video advertisement is detected, playback speed is instantly accelerated to 16x, compressing 30-second ad breaks down to less than 2 seconds.
* **🔇 Auto-Mute & Volume Restore**: Silences ad audio automatically while active, and cleanly restores your previous listening volume once your show or movie resumes.
* **⏩ Auto-Click "Skip Ad" Buttons**: Instantly detects and clicks "Skip Ad", "Skip", "Skip Intro", and "Skip Recap" buttons across Hotstar and Prime Video the exact millisecond they appear.
* **🎯 Instant Seek**: Attempts to seek directly to the end of seekable pre-roll and mid-roll ad segments.
* **🚫 In-Webapp Banner & Billboard Purge**: Removes invasive homepage billboard ads, companion promo cards, and subscription nudges for a clean interface.
* **🕶️ Blur / Dim Screen Veil**: Minimizes disruptive, loud visual ads by applying a subtle blur veil with an unobtrusive *"Skipping Ad ⚡"* HUD indicator.
* **🛡️ Network Tracking Filter**: Employs Manifest V3 `declarativeNetRequest` rules to suppress external telemetry and ad trackers.
* **📊 Real-time Dashboard**: Track your total number of ads skipped and total hours/minutes saved directly in the popup interface.

---

## 🛠️ How It Works (Safe, Zero-Freeze Architecture)

1. **Pure Isolated Content Script (`content/detector.js`)**: Runs in Chrome's safe isolated sandbox with zero risk of interfering with Widevine DRM or encrypted DASH/HLS streaming chunks. Uses a lightweight 250ms scanner consuming near 0% CPU.
2. **Multi-Platform Ad Detection**:
   * **JioHotstar**: `"Go Ads free"` button, `"Ad · 00:xx"` / `Ad • mm:ss` countdown timer, `Ad 1 of 2`.
   * **Amazon Prime Video**: `"Ad 1:08 Learn more"` overlay, countdown timers (`Ad 0:56`), ad timer indicators (`.atvwebplayersdk-ad-timer`, `[class*="adMarker"]`, `[class*="adOverlay"]`), and Prime Video skip triggers (`.atvwebplayersdk-skipelement-button`, `.fu4a6eb`).
3. **Multi-Video Acceleration**: Automatically targets and speeds up all active `<video>` elements to 16x speed and mutes loud commercial audio.
4. **Cosmetic & Network Filtering (`rules/ad_rules.json` & `content/styles.css`)**: Suppresses external telemetry (Scorecard, Conviva, Pubmatic, etc.) and hides cosmetic ad banners.

---

## 📦 Installation Instructions (Chrome / Brave / Edge)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/mihirverma7781/jio-hotstar-ad-blocker.git
   ```
2. Open your Chromium browser (Google Chrome, Brave, Microsoft Edge, Opera, or Vivaldi).
3. Navigate to `chrome://extensions/` in your address bar.
4. Enable **Developer mode** using the toggle in the top-right corner.
5. Click the **"Load unpacked"** button in the top-left corner.
6. Select the cloned project directory:
   ```bash
   path/to/jio-hotstar-ad-blocker
   ```
7. The **JioHotstar Ad Skipper & Blocker** extension is now installed and active!
8. Pin the extension icon to your browser toolbar for quick access to settings and statistics.

---

## ⚙️ Customization Options

Click the extension icon in your browser toolbar to customize:
* **Master Switch**: Toggle the ad skipper on or off anytime.
* **Fast-Forward Speed**: Choose between `16x` (fastest), `8x`, or `4x`.
* **Auto-Mute Ads**: Enable or disable automatic muting.
* **Auto-Click "Skip" Buttons**: Enable or disable automatic clicking of skip prompts.
* **Instant Seek**: Toggle direct seeking for ad clips.
* **Blur / Dim Ad Video**: Toggle the visual veil effect.
* **Skip Intros & Recaps**: Toggle auto-skipping of show intros and recaps.
* **Block In-App Banners**: Toggle hiding of home feed billboard promos.
* **Presenter Mode**: Suppresses on-screen HUD pills and blur transitions during screen-sharing sessions (e.g. Google Meet, MS Teams, Zoom) for a distraction-free presentation.
* **TV Mode — UHD/HDR Playback Emulator**: Emulates the client-side media player behavior of modern 4K HDR smart TVs (UHD preference, HDR10 ranking, TV-style ABR, diagnostic HUD).
* **Reset Stats**: Clear accumulated ads skipped and time saved counters.

---

## 📺 TV Mode — UHD/HDR Playback Emulator (Experimental Research)

An experimental feature designed to reproduce, as closely as technically possible within Chromium, the **client-side media player behavior** of a modern 4K HDR streaming-TV application for authorized streams and testing media.

### 🎯 TV Player Behaviors Emulated
1. **Resolution & Dynamic Range Hierarchy**: Automatically prioritizes representations following smart-TV preference order:
   $$\text{2160p HDR} > \text{2160p SDR} > \text{1440p HDR} > \text{1440p SDR} > \text{1080p HDR} > \text{1080p SDR}$$
2. **Codec Selection Matrix**: Evaluates codec compatibility via `navigator.mediaCapabilities.decodingInfo()` for HEVC (`hvc1`, `hev1`), AV1 (`av01`), VP9 Profile 2 (`vp09.02`), and AVC (`avc1`), preferring modern high-efficiency codecs with smooth, power-efficient decoding.
3. **TV-Style Adaptive Bitrate (ABR)**:
   * **Conservative TV Startup**: Begins on a stable tier (e.g., 1080p) to guarantee sub-second Time-To-First-Frame (TTFF) without buffering spinners.
   * **Buffer-Aware Safety**: Aggressively monitors buffer length against a safety margin ($\ge 15\text{s}$) before stepping up to high-bitrate 4K tiers.
   * **Fast Drop on Starvation**: Drops quality immediately upon buffer depletion ($< 5\text{s}$) to avoid rebuffering stalls.
   * **Hold-Time Recovery**: Enforces a 15-second stability hold before allowing subsequent step-ups.
4. **Hardware & Display Probing**: Queries OS/display wide-color-gamut (`display-p3`, `rec2020`), HDR capability (`video-dynamic-range: high`, `dynamic-range: high`), device pixel ratio (DPR), and screen resolution.
5. **Real-Time Diagnostic HUD Overlay**: Press **`Alt + Shift + D`** (or invoke via extension commands) to toggle an on-screen TV diagnostic overlay displaying:
   * Resolution & Frame Rate
   * Video & Audio Codec
   * Current & Target Bitrate
   * Buffer Health & Safety Margin
   * Color Space & HDR Status (`HDR10`, `HLG`, `DolbyVision`, `SDR`)
   * Dropped Frames & Decode Stalls
   * Bottleneck Diagnosis
6. **Service Analysis Bottleneck Classifier**:
   When 4K/HDR cannot be selected, TV Mode classifies the exact root cause:
   * `SERVICE_OFFER`: The streaming manifest or service tier does not offer UHD/HDR representations to browser clients.
   * `BROWSER_CAPABILITY`: The browser/OS decoder does not support the required codec/profile (e.g., HEVC Main 10).
   * `DISPLAY_LIMITATION`: The attached monitor does not support high dynamic range or wide gamut.
   * `NETWORK_CONSTRAINT`: Measured throughput is insufficient for high-bitrate 4K streams.
   * `BUFFER_HEALTH`: Playback buffer is depleted or unstable.
   * `HDCP_LIMITATION`: Output protection requirements are not satisfied.
   * `DRM_RESTRICTION`: The content is restricted to certified hardware DRM security levels.

### 🧪 TV Playback Lab
An interactive test bench is included directly inside the extension (`lab/index.html`). Launch it from the extension popup or navigate to `chrome-extension://<id>/lab/index.html`.
* Test live authentic HLS and DASH manifests (Big Buck Bunny 4K, Tears of Steel 4K, Sintel 4K, Cosmos Laundromat).
* Test preset TV profiles: **TV 4K HDR**, **TV 4K SDR**, **TV 1080p HDR**, **TV 1080p SDR**, and **Low-Bandwidth TV**.
* Live visual representation list, playback metrics, and ABR state engine.

### ⚖️ Strict Compliance Boundary (Player Emulation vs TV Device Authorization)
* **What TV Mode does**: Emulates the player-side track selection, ABR adaptation, display query heuristics, and telemetry of a television app.
* **What TV Mode DOES NOT do**: Does **NOT** impersonate certified television hardware, forge device certificates, spoof DRM robustness levels, extract DRM keys, alter license responses, forge license requests, disable EME, or bypass HDCP.
* When commercial streaming services withhold 4K/HDR streams behind certified hardware EME/DRM requirements, TV Mode accurately reports this as a `SERVICE_OFFER` or `DRM_RESTRICTION` bottleneck rather than attempting forbidden spoofing.

---

## 📁 Project Structure

```
jio-hotstar-ad-blocker/
├── index.html                 # Modern minimalist landing page for GitHub Pages
├── style.css                  # Landing page dark glassmorphic styling
├── script.js                  # Interactive ad-bypass simulation player
├── assets/                    # Visual assets for GitHub Pages
├── docs/                      # GitHub Pages deployment mirror
├── manifest.json              # Extension Manifest V3 configuration (v1.4.0)
├── background/
│   └── service_worker.js     # Settings, badge status, & keyboard shortcuts
├── content/
│   ├── detector.js           # Safe in-video ad detector & 16x speedup engine
│   └── styles.css            # Ad veil & TV diagnostic HUD styles
├── popup/
│   ├── popup.html            # Settings, TV Mode controls, & dashboard popup
│   ├── popup.js              # Popup controller logic
│   └── popup.css             # Dark-theme glassmorphism styling
├── lab/
│   ├── index.html            # TV Playback Lab interactive test bench
│   └── lab.css               # TV Playback Lab styling
├── rules/
│   └── ad_rules.json         # Declarative Net Request rules
├── src/                      # TV Mode TypeScript Core Engine
│   ├── types/tv_mode.ts      # Data contracts, models & interfaces
│   ├── core/
│   │   ├── TVCapabilityEngine.ts       # Display & decoder probing
│   │   ├── TVHdrEngine.ts              # HDR state & format evaluation
│   │   ├── TVRepresentationAnalyzer.ts # DASH MPD & HLS M3U8 parsing
│   │   ├── TVQualitySelector.ts        # TV representation ranking & filtering
│   │   ├── TVAdaptationController.ts   # TV-style ABR algorithm
│   │   ├── TVMetrics.ts                # Telemetry & performance metrics
│   │   ├── TVDiagnostics.ts            # HUD overlay & bottleneck classifier
│   │   └── TVModeController.ts         # Full 10-step lifecycle coordinator
│   ├── lab/                            # Lab application and sample manifests
│   └── index.ts                        # Content script bootstrap entry point
├── dist/                     # Compiled JavaScript bundles (tsup)
│   ├── tv_mode.js            # Injected content script bundle
│   └── lab_app.js            # Interactive TV Lab bundle
├── test/                     # Vitest test suite (17 scenario verifications)
├── package.json              # TypeScript, tsup, & Vitest toolchain
├── tsconfig.json             # TypeScript compiler settings
└── README.md                 # Project documentation
```

### 💻 Developer & Testing Commands

```bash
# Install dependencies
npm install

# Run TypeScript typechecker
npm run typecheck

# Run automated Vitest test suite (unit + integration)
npm test

# Build production bundles with tsup
npm run build
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
