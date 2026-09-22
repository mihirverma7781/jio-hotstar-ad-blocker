/**
 * JioHotstar Ad Skipper - Popup Controller
 * Manages UI interactions, settings persistence, and stats display.
 */

document.addEventListener('DOMContentLoaded', async () => {
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
  const btnResetStats = document.getElementById('btnResetStats');

  // Format seconds into readable string (e.g. 45s, 3m 20s, 1h 12m)
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

  // Update UI based on storage state
  function updateUI(settings) {
    // Master Toggle & Badge
    const isEnabled = settings.enabled ?? true;
    toggleEnabled.checked = isEnabled;

    if (isEnabled) {
      statusBadge.textContent = 'Active';
      statusBadge.className = 'status-badge active';
      masterStatusText.textContent = 'Accelerating & skipping in-video ads';
    } else {
      statusBadge.textContent = 'Paused';
      statusBadge.className = 'status-badge paused';
      masterStatusText.textContent = 'Skipper is currently disabled';
    }

    // Statistics
    adsSkippedCount.textContent = (settings.adsSkipped || 0).toLocaleString();
    timeSavedCount.textContent = formatTime(settings.secondsSaved || 0);

    // Speed Selection
    const currentSpeed = settings.playbackSpeed || 16;
    speedButtons.forEach((btn) => {
      const speed = Number(btn.getAttribute('data-speed'));
      if (speed === currentSpeed) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Checkbox preferences
    toggleAutoMute.checked = settings.autoMute ?? true;
    toggleAutoSkipButtons.checked = settings.autoSkipButtons ?? true;
    toggleInstantSeek.checked = settings.instantSeek ?? true;
    toggleBlurAdVideo.checked = settings.blurAdVideo ?? true;
    toggleSkipIntros.checked = settings.skipIntros ?? true;
    toggleRemoveWebappAds.checked = settings.removeWebappAds ?? true;
  }

  // Initial load
  const currentSettings = await chrome.storage.local.get(null);
  updateUI(currentSettings);

  // Bind Master Toggle
  toggleEnabled.addEventListener('change', (e) => {
    chrome.storage.local.set({ enabled: e.target.checked });
  });

  // Bind Speed Buttons
  speedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const speed = Number(btn.getAttribute('data-speed'));
      chrome.storage.local.set({ playbackSpeed: speed });
    });
  });

  // Bind Preference Toggles
  toggleAutoMute.addEventListener('change', (e) => {
    chrome.storage.local.set({ autoMute: e.target.checked });
  });

  toggleAutoSkipButtons.addEventListener('change', (e) => {
    chrome.storage.local.set({ autoSkipButtons: e.target.checked });
  });

  toggleInstantSeek.addEventListener('change', (e) => {
    chrome.storage.local.set({ instantSeek: e.target.checked });
  });

  toggleBlurAdVideo.addEventListener('change', (e) => {
    chrome.storage.local.set({ blurAdVideo: e.target.checked });
  });

  toggleSkipIntros.addEventListener('change', (e) => {
    chrome.storage.local.set({ skipIntros: e.target.checked });
  });

  toggleRemoveWebappAds.addEventListener('change', (e) => {
    chrome.storage.local.set({ removeWebappAds: e.target.checked });
  });

  // Bind Reset Stats Button
  btnResetStats.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset your ad skipping stats?')) {
      chrome.runtime.sendMessage({ action: 'RESET_STATS' }, () => {
        adsSkippedCount.textContent = '0';
        timeSavedCount.textContent = '0s';
      });
    }
  });

  // Listen for storage changes in real-time
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      chrome.storage.local.get(null, (updated) => {
        updateUI(updated);
      });
    }
  });
});
