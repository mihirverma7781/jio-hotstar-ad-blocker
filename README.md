# JioHotstar Ad Skipper & Blocker ⚡

[![Live Website](https://img.shields.io/badge/Live_Website-mihirverma7781.github.io-3b82f6?style=for-the-badge&logo=googlechrome&logoColor=white)](https://mihirverma7781.github.io/jio-hotstar-ad-blocker/)
[![GitHub stars](https://img.shields.io/github/stars/mihirverma7781/jio-hotstar-ad-blocker?style=for-the-badge&color=f59e0b)](https://github.com/mihirverma7781/jio-hotstar-ad-blocker/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)](LICENSE)

> 🌐 **Official Website & Interactive Simulator**: [https://mihirverma7781.github.io/jio-hotstar-ad-blocker/](https://mihirverma7781.github.io/jio-hotstar-ad-blocker/)

A Chrome Extension (Manifest V3) designed to automatically fast-forward, mute, and skip in-video advertisements on **JioHotstar** (`hotstar.com`), **JioCinema** (`jiocinema.com`), and **JioStar** (`jiostar.com`).

Modeled after popular OTT ad-skippers (like *Ad Skipper for Prime Video*), this extension provides an uninterrupted, seamless viewing experience without breaking video playback streams.

---

<p align="center">
  <a href="https://mihirverma7781.github.io/jio-hotstar-ad-blocker/">
    <img src="assets/hero.jpg" alt="JioHotstar Ad Skipper Cinema Experience" width="100%" style="border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.5);" />
  </a>
</p>

---

## 🌐 Landing Website & Live Demo

Visit the [Live Project Website](https://mihirverma7781.github.io/jio-hotstar-ad-blocker/) to explore:
* **Interactive Ad Bypass Simulator**: Test how the extension detects ad cues, silences audio, and accelerates through commercials at 16x speed.
* **Feature Breakdown**: Detailed look at the multi-layered in-video speedup and cosmetic banner purge.
* **Visual Previews**: Screenshots of the extension popup dashboard and cinema mode HUD.

---

## 🚀 Key Features

* **⚡ Ultra-Fast Playback (up to 16x)**: When an in-video advertisement is detected, playback speed is instantly accelerated to 16x, compressing 30-second ad breaks down to less than 2 seconds.
* **🔇 Auto-Mute & Volume Restore**: Silences ad audio automatically while active, and cleanly restores your previous listening volume once your show or movie resumes.
* **⏩ Auto-Click "Skip Ad" Buttons**: Instantly detects and clicks "Skip Ad", "Skip", "Skip Intro", and "Skip Recap" buttons the exact millisecond they become clickable.
* **🎯 Instant Seek**: Attempts to seek directly to the end of seekable pre-roll and mid-roll ad segments.
* **🚫 In-Webapp Banner & Billboard Purge**: Removes invasive homepage billboard ads, companion promo cards, and subscription nudges for a clean interface.
* **🕶️ Blur / Dim Screen Veil**: Minimizes disruptive, loud visual ads by applying a subtle blur veil with an unobtrusive *"Skipping Ad ⚡"* HUD indicator.
* **🛡️ Network Tracking Filter**: Employs Manifest V3 `declarativeNetRequest` rules to suppress external telemetry and ad trackers.
* **📊 Real-time Dashboard**: Track your total number of ads skipped and total hours/minutes saved directly in the popup interface.

---

## 🛠️ How It Works (Safe, Zero-Freeze Architecture)

1. **Pure Isolated Content Script (`content/detector.js`)**: Runs in Chrome's safe isolated sandbox with zero risk of interfering with Widevine DRM or encrypted DASH streaming chunks. Uses a lightweight 250ms scanner consuming near 0% CPU.
2. **Accurate In-Video Ad Detection**: Directly detects Hotstar's in-video cues:
   * `"Go Ads free"` button
   * `"Ad · 00:xx"` / `Ad • mm:ss` countdown timer
   * `Ad 1 of 2`
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
* **Reset Stats**: Clear accumulated ads skipped and time saved counters.

---

## 📁 Project Structure

```
jio-hotstar-ad-blocker/
├── index.html                 # Modern minimalist landing page for GitHub Pages
├── style.css                  # Landing page dark glassmorphic styling
├── script.js                  # Interactive ad-bypass simulation player
├── assets/                    # Visual assets for GitHub Pages
│   ├── hero.jpg               # Cinema screen preview graphic
│   └── control-panel.jpg      # Extension popup preview mockup
├── docs/                      # GitHub Pages deployment mirror
├── manifest.json              # Extension Manifest V3 configuration
├── background/
│   └── service_worker.js     # Badge status & statistics manager
├── content/
│   ├── detector.js           # Safe in-video ad detector & 16x speedup engine
│   └── styles.css            # Ad veil & banner cleanup styles
├── popup/
│   ├── popup.html            # Settings & dashboard popup
│   ├── popup.js              # Popup controller logic
│   └── popup.css             # Dark-theme glassmorphism styling
├── rules/
│   └── ad_rules.json         # Declarative Net Request rules
├── icons/                    # Extension icons (16, 32, 48, 128 px)
└── README.md                 # Project documentation
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
