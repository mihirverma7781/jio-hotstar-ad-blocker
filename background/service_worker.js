/**
 * JioHotstar Ad Skipper - Background Service Worker
 * Manages settings, network ad tracking beacons, and global skip stats.
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  playbackSpeed: 16,
  instantSeek: true,
  autoMute: true,
  autoSkipButtons: true,
  blurAdVideo: true,
  skipIntros: true,
  adsSkipped: 0,
  secondsSaved: 0
};

// Initialize settings on install or startup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[JioHotstar Ad Skipper] Extension installed/updated:', details.reason);
  const stored = await chrome.storage.local.get(null);
  const newSettings = { ...DEFAULT_SETTINGS };

  // Preserve existing statistics and preferences
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

// Listen for storage changes to keep badge synced
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.enabled) {
    updateBadge(changes.enabled.newValue);
  }
});

// Regex to extract ad duration (e.g., "_15s_", "20sEng", "30s", "10s")
const DURATION_REGEXES = [
  /(\d{1,3})s(?:Eng(?:lish)?|Hin(?:di)?)/i,
  /(?:HIN|ENG|HINDI|ENGLISH)[^\d]*(\d{1,3})/i,
  /(?:_|^)(\d{1,3})(?:s)?(?=$|_)/i
];

let lastDetectedAd = '';
let lastDetectedTimestamp = 0;

// Listen for Hotstar server-guided ad impression events via webRequest
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    try {
      const url = new URL(details.url);
      const adName = url.searchParams.get('adName') || '';

      // Prevent duplicate fires within 2 seconds for identical ad
      const now = Date.now();
      if (adName && adName === lastDetectedAd && now - lastDetectedTimestamp < 2000) {
        return;
      }

      if (adName) {
        lastDetectedAd = adName;
        lastDetectedTimestamp = now;

        let durationSec = 15; // default fallback
        for (const regex of DURATION_REGEXES) {
          const match = adName.match(regex);
          if (match && match[1]) {
            const parsed = parseInt(match[1], 10);
            if (parsed > 0 && parsed <= 120) {
              durationSec = parsed;
              break;
            }
          }
        }

        console.log(`[JioHotstar Ad Skipper] Ad impression detected: ${adName} (~${durationSec}s)`);

        // Notify content scripts in Hotstar tabs
        chrome.tabs.query({ url: ['*://*.hotstar.com/*', '*://*.jiocinema.com/*', '*://*.jiostar.com/*'] }, (tabs) => {
          for (const tab of tabs) {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, {
                action: 'HOTSTAR_AD_BEACON',
                adName,
                durationSec
              }).catch(() => {
                // Tab might not have script injected yet or is idle
              });
            }
          }
        });
      }
    } catch (err) {
      console.warn('[JioHotstar Ad Skipper] Error parsing webRequest URL:', err);
    }
  },
  {
    urls: [
      '*://bifrost-api.hotstar.com/v1/events/track/ct_impression*',
      '*://*.hotstar.com/v1/events/track/ct_impression*'
    ]
  }
);

// Listen for messages from content scripts or popup
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
    }, 1500);

    sendResponse({ success: true });
  } else if (message.action === 'RESET_STATS') {
    chrome.storage.local.set({ adsSkipped: 0, secondsSaved: 0 }, () => {
      sendResponse({ success: true });
    });
    return true; // Keep sendResponse open for async
  }
});
