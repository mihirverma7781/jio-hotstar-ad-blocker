/**
 * JioHotstar & Prime Video Skipper - Popup Controller
 * Manages UI interactions, settings persistence, and stats display.
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  playbackSpeed: 16,
  instantSeek: true,
  autoMute: true,
  autoSkipButtons: true,
  blurAdVideo: true,
  skipIntros: true,
  removeWebappAds: true,
  presenterMode: false,
  tvModeEnabled: true,
  tvPreferredQuality: '2160',
  tvPreferHDR: true,
  tvAdaptationStrategy: 'tv-balanced',
  enhancementEnabled: true,
  upscalerMode: 'NEURAL',
  motionSmoothing: 'SMOOTH_60',
  enhancementPreset: 'CINEMA',
  enhancementScale: '2',
  enhancementQuality: 'HIGH',
  enhancementSharpness: 30,
  hdrVisualEnhancement: true,
  adsSkipped: 0,
  secondsSaved: 0
};

function formatTime(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours}h ${remMinutes}m`;
}

function initPopup() {
  // UI Elements
  const statusBadge = document.getElementById('statusBadge');
  const masterStatusText = document.getElementById('masterStatusText');
  const toggleEnabled = document.getElementById('toggleEnabled');
  const adsSkippedCount = document.getElementById('adsSkippedCount');
  const timeSavedCount = document.getElementById('timeSavedCount');
  const speedButtons = document.querySelectorAll('.speed-btn');

  const toggleAutoMute = document.getElementById('toggleAutoMute');
  const toggleAutoSkipButtons = document.getElementById('toggleAutoSkipButtons');
  const toggleInstantSeek = document.getElementById('toggleInstantSeek');
  const toggleBlurAdVideo = document.getElementById('toggleBlurAdVideo');
  const toggleSkipIntros = document.getElementById('toggleSkipIntros');
  const toggleRemoveWebappAds = document.getElementById('toggleRemoveWebappAds');
  const togglePresenterMode = document.getElementById('togglePresenterMode');
  const toggleTvMode = document.getElementById('toggleTvMode');
  const selTvQuality = document.getElementById('selTvQuality');
  const toggleTvHdr = document.getElementById('toggleTvHdr');
  const linkOpenLab = document.getElementById('linkOpenLab');

  // Video Enhancement & 60 FPS elements
  const toggleEnhancement = document.getElementById('toggleEnhancement');
  const selUpscalerMode = document.getElementById('selUpscalerMode');
  const selMotionSmoothing = document.getElementById('selMotionSmoothing');
  const selPreset = document.getElementById('selPreset');
  const selScale = document.getElementById('selScale');
  const selQualityTier = document.getElementById('selQualityTier');
  const rngSharpness = document.getElementById('rngSharpness');
  const valSharpness = document.getElementById('valSharpness');
  const toggleHdrVisual = document.getElementById('toggleHdrVisual');

  const btnResetStats = document.getElementById('btnResetStats');

  function updateUI(settings) {
    if (!settings) settings = {};
    const merged = { ...DEFAULT_SETTINGS, ...settings };

    // Master Toggle & Badge
    const isEnabled = merged.enabled;
    if (toggleEnabled) toggleEnabled.checked = isEnabled;

    if (statusBadge) {
      statusBadge.textContent = isEnabled ? 'Active' : 'Paused';
      statusBadge.className = isEnabled ? 'status-badge active' : 'status-badge paused';
    }

    if (masterStatusText) {
      masterStatusText.textContent = isEnabled
        ? 'Accelerating & skipping in-video ads'
        : 'Skipper is currently disabled';
    }

    // Statistics
    if (adsSkippedCount) {
      adsSkippedCount.textContent = (merged.adsSkipped || 0).toLocaleString();
    }
    if (timeSavedCount) {
      timeSavedCount.textContent = formatTime(merged.secondsSaved || 0);
    }

    // Speed Selection
    const currentSpeed = Number(merged.playbackSpeed) || 16;
    speedButtons.forEach((btn) => {
      const speed = Number(btn.getAttribute('data-speed'));
      if (speed === currentSpeed) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Checkbox preferences
    if (toggleAutoMute) toggleAutoMute.checked = merged.autoMute;
    if (toggleAutoSkipButtons) toggleAutoSkipButtons.checked = merged.autoSkipButtons;
    if (toggleInstantSeek) toggleInstantSeek.checked = merged.instantSeek;
    if (toggleBlurAdVideo) toggleBlurAdVideo.checked = merged.blurAdVideo;
    if (toggleSkipIntros) toggleSkipIntros.checked = merged.skipIntros;
    if (toggleRemoveWebappAds) toggleRemoveWebappAds.checked = merged.removeWebappAds;
    if (togglePresenterMode) togglePresenterMode.checked = merged.presenterMode;
    if (toggleTvMode) toggleTvMode.checked = merged.tvModeEnabled !== false;
    if (selTvQuality) selTvQuality.value = String(merged.tvPreferredQuality || '2160');
    if (toggleTvHdr) toggleTvHdr.checked = merged.tvPreferHDR !== false;

    // Enhancement bindings
    if (toggleEnhancement) toggleEnhancement.checked = merged.enhancementEnabled !== false;
    if (selUpscalerMode) selUpscalerMode.value = merged.upscalerMode || 'NEURAL';
    if (selMotionSmoothing) selMotionSmoothing.value = merged.motionSmoothing || 'SMOOTH_60';
    if (selPreset) selPreset.value = merged.enhancementPreset || 'CINEMA';
    if (selScale) selScale.value = String(merged.enhancementScale || '2');
    if (selQualityTier) selQualityTier.value = merged.enhancementQuality || 'HIGH';
    if (rngSharpness) rngSharpness.value = String(merged.enhancementSharpness !== undefined ? merged.enhancementSharpness : 30);
    if (valSharpness) valSharpness.textContent = `${merged.enhancementSharpness !== undefined ? merged.enhancementSharpness : 30}%`;
    if (toggleHdrVisual) toggleHdrVisual.checked = merged.hdrVisualEnhancement !== false;
  }

  // Load initial settings
  try {
    chrome.storage.local.get(null, (stored) => {
      updateUI(stored || {});
    });
  } catch (err) {
    console.error('[Popup] Storage load error:', err);
    updateUI(DEFAULT_SETTINGS);
  }

  // Bind Master Toggle
  if (toggleEnabled) {
    toggleEnabled.addEventListener('change', (e) => {
      chrome.storage.local.set({ enabled: e.target.checked });
    });
  }

  // Bind Speed Buttons
  speedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const speed = Number(btn.getAttribute('data-speed'));
      chrome.storage.local.set({ playbackSpeed: speed });
    });
  });

  // Bind Preference Toggles
  if (toggleAutoMute) {
    toggleAutoMute.addEventListener('change', (e) => {
      chrome.storage.local.set({ autoMute: e.target.checked });
    });
  }

  if (toggleAutoSkipButtons) {
    toggleAutoSkipButtons.addEventListener('change', (e) => {
      chrome.storage.local.set({ autoSkipButtons: e.target.checked });
    });
  }

  if (toggleInstantSeek) {
    toggleInstantSeek.addEventListener('change', (e) => {
      chrome.storage.local.set({ instantSeek: e.target.checked });
    });
  }

  if (toggleBlurAdVideo) {
    toggleBlurAdVideo.addEventListener('change', (e) => {
      chrome.storage.local.set({ blurAdVideo: e.target.checked });
    });
  }

  if (toggleSkipIntros) {
    toggleSkipIntros.addEventListener('change', (e) => {
      chrome.storage.local.set({ skipIntros: e.target.checked });
    });
  }

  if (toggleRemoveWebappAds) {
    toggleRemoveWebappAds.addEventListener('change', (e) => {
      chrome.storage.local.set({ removeWebappAds: e.target.checked });
    });
  }

  if (togglePresenterMode) {
    togglePresenterMode.addEventListener('change', (e) => {
      chrome.storage.local.set({ presenterMode: e.target.checked });
    });
  }

  // Bind TV Mode Settings
  if (toggleTvMode) {
    toggleTvMode.addEventListener('change', (e) => {
      chrome.storage.local.set({ tvModeEnabled: e.target.checked });
    });
  }

  if (selTvQuality) {
    selTvQuality.addEventListener('change', (e) => {
      chrome.storage.local.set({ tvPreferredQuality: e.target.value });
    });
  }

  if (toggleTvHdr) {
    toggleTvHdr.addEventListener('change', (e) => {
      chrome.storage.local.set({ tvPreferHDR: e.target.checked });
    });
  }

  if (linkOpenLab) {
    linkOpenLab.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('lab/index.html') });
    });
  }

  // Bind Video Enhancement Controls
  if (toggleEnhancement) {
    toggleEnhancement.addEventListener('change', (e) => {
      chrome.storage.local.set({ enhancementEnabled: e.target.checked });
    });
  }

  if (selUpscalerMode) {
    selUpscalerMode.addEventListener('change', (e) => {
      chrome.storage.local.set({ upscalerMode: e.target.value });
    });
  }

  if (selMotionSmoothing) {
    selMotionSmoothing.addEventListener('change', (e) => {
      chrome.storage.local.set({ motionSmoothing: e.target.value });
    });
  }

  if (selPreset) {
    selPreset.addEventListener('change', (e) => {
      chrome.storage.local.set({ enhancementPreset: e.target.value });
    });
  }

  if (selScale) {
    selScale.addEventListener('change', (e) => {
      chrome.storage.local.set({ enhancementScale: e.target.value });
    });
  }

  if (selQualityTier) {
    selQualityTier.addEventListener('change', (e) => {
      chrome.storage.local.set({ enhancementQuality: e.target.value });
    });
  }

  if (rngSharpness) {
    rngSharpness.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      if (valSharpness) valSharpness.textContent = `${val}%`;
      chrome.storage.local.set({ enhancementSharpness: val });
    });
  }

  if (toggleHdrVisual) {
    toggleHdrVisual.addEventListener('change', (e) => {
      chrome.storage.local.set({ hdrVisualEnhancement: e.target.checked });
    });
  }

  // Bind Reset Stats Button (Inline feedback without window.confirm)
  if (btnResetStats) {
    btnResetStats.addEventListener('click', () => {
      chrome.storage.local.set({ adsSkipped: 0, secondsSaved: 0 }, () => {
        if (adsSkippedCount) adsSkippedCount.textContent = '0';
        if (timeSavedCount) timeSavedCount.textContent = '0s';
        const originalText = btnResetStats.textContent;
        btnResetStats.textContent = 'Reset ✓';
        setTimeout(() => {
          btnResetStats.textContent = originalText;
        }, 1500);
      });
    });
  }

  // Open external links reliably in extension popups via chrome.tabs.create
  document.querySelectorAll('a[href^="http"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const url = link.getAttribute('href');
      if (url) {
        chrome.tabs.create({ url });
      }
    });
  });

  // Listen for storage changes in real-time
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        chrome.storage.local.get(null, (updated) => {
          updateUI(updated || {});
        });
      }
    });
  } catch (e) {}
}

// Safely initialize whether DOM is already loaded or still loading
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPopup);
} else {
  initPopup();
}
