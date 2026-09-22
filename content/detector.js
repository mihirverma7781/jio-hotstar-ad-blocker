/**
 * JioHotstar Ad Skipper - Safe & Ultra-Fast Content Engine
 * Detects in-video ads ("Go Ads free", "Ad · 00:xx"), accelerates playback (16x),
 * auto-mutes, auto-clicks skip buttons, and removes in-webapp promo banners & billboard ads.
 */

(function () {
  'use strict';

  if (window.__jiohotstar_skipper_v2) return;
  window.__jiohotstar_skipper_v2 = true;

  console.log('[JioHotstar Ad Skipper] Active and monitoring.');

  // Default configuration
  let settings = {
    enabled: true,
    playbackSpeed: 16,
    instantSeek: true,
    autoMute: true,
    autoSkipButtons: true,
    blurAdVideo: true,
    skipIntros: true,
    removeWebappAds: true,
    presenterMode: false
  };

  // State
  let isAdActive = false;
  let previousMuted = false;
  let previousPlaybackRate = 1.0;
  let adStartTime = 0;
  let nonAdCount = 0;

  // Load settings
  chrome.storage.local.get(null, (stored) => {
    if (stored) {
      settings = { ...settings, ...stored };
    }
  });

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      for (const [key, change] of Object.entries(changes)) {
        settings[key] = change.newValue;
      }
      if (!settings.enabled && isAdActive) {
        restorePlayback();
      }
    }
  });

  // Fast in-video ad detection regexes
  const GO_ADS_FREE_REGEX = /go\s+ads?\s*free/i;
  const AD_TIMER_REGEX = /^Ad\s*[·•:\-\s]\s*\d{1,2}:\d{2}/i;
  const AD_SUBSTRING_REGEX = /\bAd\s*[·•:\-]\s*\d{1,2}:\d{2}\b/i;
  const AD_COUNT_REGEX = /\bAd\s+\d+\s+of\s+\d+/i;

  // Scan visible DOM elements for Hotstar in-video ad markers
  function checkIsAdPlaying() {
    const elements = document.querySelectorAll('button, [role="button"], span, div');
    
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (el.children.length <= 2) {
        const text = (el.textContent || '').trim();
        if (!text) continue;

        // Check for "Go Ads free"
        if (GO_ADS_FREE_REGEX.test(text)) {
          return true;
        }

        // Check for "Ad · 00:06" / "Ad • 00:15"
        if (AD_TIMER_REGEX.test(text) || AD_SUBSTRING_REGEX.test(text)) {
          return true;
        }

        // Check for "Ad 1 of 2"
        if (AD_COUNT_REGEX.test(text)) {
          return true;
        }
      }
    }

    // Check for explicit ad testid or class markers if present
    const adTag = document.querySelector('[data-testid*="ad-badge"], [data-testid*="ad-indicator"], .ad-tag, .adBadge');
    if (adTag && adTag.offsetParent !== null) {
      return true;
    }

    return false;
  }

  // Auto-click Skip buttons
  function handleSkipButtons() {
    if (!settings.autoSkipButtons) return;

    const skipRegexes = [
      /Skip\s*Ad/i,
      /Skip\s*Ads/i,
      /^Skip$/i
    ];

    if (settings.skipIntros) {
      skipRegexes.push(/Skip\s*Intro/i, /Skip\s*Recap/i, /Skip\s*Credits/i);
    }

    const clickables = document.querySelectorAll('button, [role="button"], div[class*="skip" i], span[class*="skip" i]');
    for (let i = 0; i < clickables.length; i++) {
      const el = clickables[i];
      if (el.offsetParent === null) continue;

      const text = (el.innerText || el.textContent || '').trim();
      // NEVER click "Go Ads free"!
      if (GO_ADS_FREE_REGEX.test(text)) continue;

      for (let j = 0; j < skipRegexes.length; j++) {
        if (skipRegexes[j].test(text) && text.length < 25) {
          console.log('[JioHotstar Ad Skipper] Auto-clicking skip button:', text);
          try {
            el.click();
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          } catch (e) {}
          return;
        }
      }
    }
  }

  // ==========================================
  // In-WebApp Ad & Promo Removal
  // ==========================================

  const WEBAPP_AD_SELECTORS = [
    // Hotstar Billboards, Banners & Companion Ads
    'div[data-testid="bbtype-video"]',
    'div[data-testid="bbtype-image"]',
    '[data-testid*="billboard"]',
    '[data-testid*="bbtype"]',
    '[data-testid*="companion"]',
    '[data-testid*="breakout"]',
    '[data-testid*="leadgen"]',
    '[data-testid*="cte-"]',
    '[data-testid*="ad-banner"]',
    '[class*="billboard" i]',
    '[class*="companionCard" i]',
    '[class*="breakoutAd" i]',
    // Sidebar Upgrade / Payment links
    'a[href*="/subscribe"]',
    'a[href*="/payment"]',
    '[data-testid*="upgrade"]',
    // Generic Ad slots
    '[id*="google_ads" i]',
    '[id*="gpt-ad" i]',
    '[id*="gam-ad" i]',
    '[id*="ad-slot" i]',
    'iframe[src*="doubleclick" i]',
    'iframe[src*="jioads" i]'
  ];

  function cleanWebappAds() {
    if (!settings.enabled || !settings.removeWebappAds) return;

    for (let i = 0; i < WEBAPP_AD_SELECTORS.length; i++) {
      const ads = document.querySelectorAll(WEBAPP_AD_SELECTORS[i]);
      for (let j = 0; j < ads.length; j++) {
        const el = ads[j];
        if (el && el.style.display !== 'none') {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('height', '0', 'important');
          el.style.setProperty('margin', '0', 'important');
          el.style.setProperty('padding', '0', 'important');

          // If inside an isolated tray-wrapper, collapse the parent wrapper as well
          const parentWrapper = el.closest('[id*="tray-wrapper"], [class*="trayWrapper"], [class*="widget_wrapper"]');
          if (parentWrapper && parentWrapper.children.length <= 2) {
            parentWrapper.style.setProperty('display', 'none', 'important');
            parentWrapper.style.setProperty('height', '0', 'important');
          }
        }
      }
    }

    // Hide any element loading media from Hotstar's ad CDN
    const adMedia = document.querySelectorAll('img[src*="hesads.akamaized.net"], video[src*="hesads.akamaized.net"]');
    for (let i = 0; i < adMedia.length; i++) {
      const card = adMedia[i].closest('div[class*="card"], div[class*="banner"], div[class*="widget"], div[data-testid]') || adMedia[i];
      if (card && card.style.display !== 'none') {
        card.style.setProperty('display', 'none', 'important');
      }
    }
  }

  // HUD management
  function showHUD(speed) {
    if (settings.presenterMode) {
      hideHUD();
      return;
    }

    let hud = document.getElementById('jioad-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'jioad-hud';
      hud.innerHTML = `
        <span class="jioad-hud-icon">⚡</span>
        <span class="jioad-hud-text">Skipping Ad</span>
        <span class="jioad-hud-badge" id="jioad-hud-speed">${speed}x</span>
      `;
      (document.body || document.documentElement).appendChild(hud);
    } else {
      const badge = document.getElementById('jioad-hud-speed');
      if (badge) badge.textContent = `${speed}x`;
      hud.style.display = 'flex';
    }
  }

  function hideHUD() {
    const hud = document.getElementById('jioad-hud');
    if (hud) hud.style.display = 'none';
  }

  // Apply acceleration & mute
  function accelerateAd() {
    const videos = document.querySelectorAll('video');
    if (videos.length === 0) return;

    const targetSpeed = Number(settings.playbackSpeed) || 16.0;

    if (!isAdActive) {
      isAdActive = true;
      adStartTime = Date.now();
      nonAdCount = 0;

      previousMuted = videos[0].muted;
      previousPlaybackRate = videos[0].playbackRate <= 2 ? (videos[0].playbackRate || 1.0) : 1.0;

      console.log(`[JioHotstar Ad Skipper] Ad detected! Accelerating to ${targetSpeed}x & muting.`);
    }

    videos.forEach((video) => {
      try {
        if (settings.autoMute && !video.muted) {
          video.muted = true;
        }

        if (video.playbackRate !== targetSpeed) {
          video.playbackRate = targetSpeed;
        }

        if (settings.instantSeek && video.duration && isFinite(video.duration)) {
          if (video.duration > 0 && video.duration <= 180) {
            if (video.currentTime < video.duration - 0.1) {
              video.currentTime = video.duration;
            }
          }
        }

        // Apply blur only if enabled and not in presenter/meeting mode
        if (settings.blurAdVideo && !settings.presenterMode) {
          video.classList.add('jioad-video-blur');
        }
      } catch (e) {}
    });

    showHUD(targetSpeed);
  }

  // Restore normal playback
  function restorePlayback() {
    if (!isAdActive) return;
    isAdActive = false;
    nonAdCount = 0;

    console.log('[JioHotstar Ad Skipper] Ad ended. Restoring original speed and volume.');

    const videos = document.querySelectorAll('video');
    videos.forEach((video) => {
      try {
        video.playbackRate = previousPlaybackRate || 1.0;
        if (settings.autoMute) {
          video.muted = previousMuted;
        }
        video.classList.remove('jioad-video-blur');
      } catch (e) {}
    });

    hideHUD();

    const elapsed = Math.max(1, Math.round((Date.now() - adStartTime) / 1000));
    chrome.runtime.sendMessage({
      action: 'AD_SKIPPED',
      duration: elapsed
    }).catch(() => {});
  }

  // Periodic video ad monitor loop (every 250ms)
  setInterval(() => {
    if (!settings.enabled) return;

    handleSkipButtons();

    const adDetected = checkIsAdPlaying();

    if (adDetected) {
      nonAdCount = 0;
      accelerateAd();
    } else if (isAdActive) {
      nonAdCount++;
      if (nonAdCount >= 2) {
        restorePlayback();
      }
    }
  }, 250);

  // Periodic webapp banner cleaner (every 600ms)
  setInterval(cleanWebappAds, 600);
  cleanWebappAds();

})();
