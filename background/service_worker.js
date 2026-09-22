/**
 * JioHotstar Ad Skipper - Background Service Worker (MV3)
 * Manages user settings, badge state, and skipped ad statistics.
 *
 * MV3 Note: Service workers terminate after ~30s of inactivity.
 * We use chrome.alarms to keep the worker reliably available and
 * to ensure the badge is always up-to-date when Chrome restarts.
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function updateBadge(isEnabled) {
  if (isEnabled) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#00c853' });
  } else {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#757575' });
  }
}

async function restoreBadge() {
  try {
    const { enabled } = await chrome.storage.local.get(['enabled']);
    updateBadge(enabled ?? true);
  } catch (e) {
    updateBadge(true);
  }
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Stream Skipper] Installed/Updated:', details.reason);

  const stored = await chrome.storage.local.get(null);
  const newSettings = { ...DEFAULT_SETTINGS };

  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (stored[key] !== undefined) {
      newSettings[key] = stored[key];
    }
  }

  await chrome.storage.local.set(newSettings);
  updateBadge(newSettings.enabled);

  // Create a keepalive alarm that fires every 20 seconds.
  // This prevents the service worker from being terminated between user clicks.
  chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });
});

chrome.runtime.onStartup.addListener(async () => {
  await restoreBadge();
  // Re-register keepalive alarm on browser startup (alarms survive SW restarts)
  chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });
});

// ─── Alarms ─────────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive') {
    // No-op tick — keeps the service worker awake and the event loop alive.
    // Also re-syncs the badge in case it was cleared after a SW restart.
    restoreBadge();
  } else if (alarm.name === 'badge_restore') {
    // Restore badge to ON/OFF after the ⚡ flash from AD_SKIPPED
    restoreBadge();
  }
});

// ─── Storage Changes ────────────────────────────────────────────────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.enabled) {
    updateBadge(changes.enabled.newValue);
  }
});

// ─── Commands (keyboard shortcuts) ──────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (!tabId) return;

    if (command === 'toggle_tv_hud') {
      chrome.tabs.sendMessage(tabId, { action: 'TOGGLE_TV_HUD' }).catch(() => {});
    } else if (command === 'toggle_prime_debug') {
      chrome.tabs.sendMessage(tabId, { action: 'toggle_prime_debug' }).catch(() => {});
    }
  });
});

// ─── Messages ───────────────────────────────────────────────────────────────

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

    // Flash badge briefly then restore
    chrome.action.setBadgeText({ text: '⚡' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });

    // Use alarm for deferred badge restore instead of setTimeout
    // (setTimeout is unreliable when SW may be terminated)
    chrome.alarms.create('badge_restore', { delayInMinutes: 0.02 }); // ~1.2s

    sendResponse({ success: true });
    return false; // Synchronous response — do NOT keep the channel open
  }

  if (message.action === 'RESET_STATS') {
    chrome.storage.local.set({ adsSkipped: 0, secondsSaved: 0 }, () => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async sendResponse
  }

  return false;
});
