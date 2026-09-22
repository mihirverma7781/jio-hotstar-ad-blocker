/**
 * JioHotstar Ad Skipper - Background Service Worker
 * Manages user settings, badge state, and skipped ad statistics.
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
  adsSkipped: 0,
  secondsSaved: 0
};

// Initialize settings on installation or update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[JioHotstar Ad Skipper] Installed/Updated:', details.reason);
  const stored = await chrome.storage.local.get(null);
  const newSettings = { ...DEFAULT_SETTINGS };

  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (stored[key] !== undefined) {
      newSettings[key] = stored[key];
    }
  }

  await chrome.storage.local.set(newSettings);
  updateBadge(newSettings.enabled);
});

chrome.runtime.onStartup.addListener(async () => {
  const { enabled } = await chrome.storage.local.get(['enabled']);
  updateBadge(enabled ?? true);
});

// Update extension icon badge
function updateBadge(isEnabled) {
  if (isEnabled) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#00c853' }); // Vibrant green
  } else {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#757575' });
  }
}

// Sync badge when master switch changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.enabled) {
    updateBadge(changes.enabled.newValue);
  }
});

// Listen for keyboard commands
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle_tv_hud') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'TOGGLE_TV_HUD' }).catch(() => {});
      }
    });
  }
});

// Handle stats updates and reset requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'AD_SKIPPED') {
    const duration = message.duration || 15;
    chrome.storage.local.get(['adsSkipped', 'secondsSaved'], (res) => {
      const currentSkipped = (res.adsSkipped || 0) + 1;
      const currentSaved = (res.secondsSaved || 0) + Math.round(duration);
      chrome.storage.local.set({
        adsSkipped: currentSkipped,
        secondsSaved: currentSaved
      });
    });

    // Flash badge briefly
    chrome.action.setBadgeText({ text: '⚡' });
    setTimeout(async () => {
      const { enabled } = await chrome.storage.local.get(['enabled']);
      updateBadge(enabled ?? true);
    }, 1200);

    sendResponse({ success: true });
  } else if (message.action === 'RESET_STATS') {
    chrome.storage.local.set({ adsSkipped: 0, secondsSaved: 0 }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
