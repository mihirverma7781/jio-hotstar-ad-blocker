# JioHotstar Ad Skipper & Blocker ⚡

A Chrome Extension (Manifest V3) designed to automatically fast-forward, mute, and skip in-video advertisements on **JioHotstar** (`hotstar.com`), **JioCinema** (`jiocinema.com`), and **JioStar** (`jiostar.com`).

Modeled after popular OTT ad-skippers (like *Ad Skipper for Prime Video*), this extension provides an uninterrupted, seamless viewing experience without breaking video playback streams.

---

## 🚀 Key Features

* **⚡ Ultra-Fast Playback (up to 16x)**: When an in-video advertisement is detected, playback speed is instantly accelerated to 16x, compressing 30-second ad breaks down to less than 2 seconds.
* **🔇 Auto-Mute & Volume Restore**: Silences ad audio automatically while active, and cleanly restores your previous listening volume once your show or movie resumes.
* **⏩ Auto-Click "Skip Ad" Buttons**: Instantly detects and clicks "Skip Ad", "Skip", "Skip Intro", and "Skip Recap" buttons the exact millisecond they become clickable.
* **🎯 Instant Seek**: Attempts to seek directly to the end of seekable pre-roll and mid-roll ad segments.
* **🕶️ Blur / Dim Screen Veil**: Minimizes disruptive, loud visual ads by applying a subtle blur veil with an unobtrusive *"Skipping Ad ⚡"* HUD indicator.
* **🛡️ Network Tracking Filter**: Employs Manifest V3 `declarativeNetRequest` rules to suppress external telemetry and ad trackers.
* **📊 Real-time Dashboard**: Track your total number of ads skipped and total hours/minutes saved directly in the popup interface.

---

## 🛠️ How It Works (Multi-Layered Architecture)

1. **Main-World Hooking (`content/injector.js`)**: Runs directly within the page context to prevent website player scripts from throttling playback speed back to `1.0x` during ad breaks.
2. **DOM & Player Detection (`content/detector.js`)**: Employs an ultra-low-overhead `MutationObserver` and periodic scanner to detect ad badges, timers, and skip prompts across Hotstar and JioCinema.
3. **Network Beacon Interception (`background/service_worker.js`)**: Listens for server-guided ad impression events (e.g. `bifrost-api.hotstar.com`) to alert the active tab before DOM changes take effect.
4. **DeclarativeNetRequest Filter (`rules/ad_rules.json`)**: Pre-emptively blocks third-party trackers (Scorecard, Conviva, Adobe DTM, Pubmatic, etc.) without affecting video playback.

---

## 📦 Installation Instructions (Chrome / Brave / Edge)

1. Open **Google Chrome** (or Brave, Edge, Opera).
2. Navigate to `chrome://extensions/` in your address bar.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click the **"Load unpacked"** button in the top-left corner.
5. Select this project folder:
   ```
   /Users/mihirverma/jiohotstar-adblocker
   ```
6. The **JioHotstar Ad Skipper & Blocker** extension is now installed and active!
7. Pin the extension icon to your toolbar for quick access to settings and statistics.

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
* **Reset Stats**: Clear accumulated ads skipped and time saved counters.

---

## 📁 Project Structure

```
jiohotstar-adblocker/
├── manifest.json              # Extension Manifest V3 configuration
├── background/
│   └── service_worker.js     # Beacon detection & statistics manager
├── content/
│   ├── detector.js           # Content script watcher & video controller
│   ├── injector.js           # Main-world script for playbackRate protection
│   └── styles.css            # Styling for blur veil and skipping HUD
├── popup/
│   ├── popup.html            # Settings & dashboard popup
│   ├── popup.js              # Popup controller logic
│   └── popup.css             # Dark-theme glassmorphism styling
├── rules/
│   └── ad_rules.json         # Declarative Net Request rules
├── icons/                    # Extension icons (16, 32, 48, 128 px)
└── README.md                 # Project documentation
```
