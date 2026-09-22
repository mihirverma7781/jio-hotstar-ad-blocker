/**
 * JioHotstar & Amazon Prime Video Ad Skipper - Safe & Ultra-Fast Content Engine
 * Detects in-video ads, accelerates playback (16x), auto-mutes,
 * auto-clicks skip buttons, and removes in-webapp promo banners.
 */

(function () {
  'use strict';

  if (window.__stream_skipper_v3) return;
  window.__stream_skipper_v3 = true;

  console.log('[Stream Skipper] Active and monitoring.');

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

  // Platform detection
  const isAmazon = /amazon\.|primevideo\./i.test(window.location.hostname);
  const isHotstar = /hotstar\.|jiocinema\.|jiostar\./i.test(window.location.hostname);

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

  // Precise in-video ad detection regexes
  const GO_ADS_FREE_REGEX = /go\s+ads?\s*free/i;
  const HOTSTAR_AD_TIMER_REGEX = /^Ad\s*[·•:\-\s]\s*\d{1,2}:\d{2}/i;
  const PRIME_AD_TIMER_REGEX = /\bAd\s+\d{1,2}:\d{2}\b/i;
  const PRIME_LEARN_MORE_REGEX = /\bAd\b[\s\S]{0,40}\bLearn\s+more\b/i;
  const AD_COUNT_REGEX = /\bAd\s+\d+\s+of\s+\d+/i;

  // Locate the active player container
  function getPlayerContainer() {
    if (document.fullscreenElement) {
      return document.fullscreenElement;
    }

    if (isAmazon) {
      const amazonPlayer = document.querySelector(
        '.webPlayerSDKContainer, #dv-web-player, .dv-player-container, .fpqiyer, .rendererContainer'
      );
      if (amazonPlayer) return amazonPlayer;
    }

    if (isHotstar) {
      const hotstarPlayer = document.querySelector(
        '[data-testid*="player"], .watch-container, [class*="player-container"]'
      );
      if (hotstarPlayer) return hotstarPlayer;
    }

    const video = document.querySelector('video');
    if (video) {
      return video.closest('[class*="player"], [id*="player"]') || video.parentElement?.parentElement || document.body;
    }

    return document.body;
  }

  // Scan for in-video ad markers strictly within the video player
  function checkIsAdPlaying() {
    const videos = document.querySelectorAll('video');
    if (videos.length === 0) return false;

    // Make sure at least one video is loaded and not ended
    let hasActiveVideo = false;
    for (let i = 0; i < videos.length; i++) {
      if (videos[i].readyState > 0 && !videos[i].ended) {
        hasActiveVideo = true;
        break;
      }
    }
    if (!hasActiveVideo) return false;

    const player = getPlayerContainer();

    // 1. Amazon Prime Video checks (Text-only, strictly inside player container)
    if (isAmazon) {
      const candidates = player.querySelectorAll('div, span, p, a, button');
      for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];
        // Only inspect leaf or small container elements
        if (el.children.length <= 3) {
          const text = (el.textContent || '').trim();
          if (!text || text.length > 70) continue;

          // Prime Video ad overlay patterns: "Ad 1:08 Learn more", "Ad 0:45", "Ad 1 of 2"
          if (PRIME_LEARN_MORE_REGEX.test(text) || PRIME_AD_TIMER_REGEX.test(text) || AD_COUNT_REGEX.test(text)) {
            return true;
          }
        }
      }
      return false;
    }

    // 2. JioHotstar checks
    if (isHotstar) {
      // Hotstar explicit ad badge / indicator
      const adTag = player.querySelector('[data-testid*="ad-badge"], [data-testid*="ad-indicator"], .ad-tag, .adBadge');
      if (adTag && (adTag.offsetParent !== null || adTag.offsetWidth > 0)) {
        return true;
      }

      const candidates = player.querySelectorAll('button, [role="button"], span, div');
      for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];
        if (el.children.length <= 3) {
          const text = (el.textContent || '').trim();
          if (!text || text.length > 70) continue;

          // Hotstar patterns: "Go Ads free", "Ad · 00:15", "Ad 1 of 2"
          if (GO_ADS_FREE_REGEX.test(text) || HOTSTAR_AD_TIMER_REGEX.test(text) || AD_COUNT_REGEX.test(text)) {
            return true;
          }
        }
      }
      return false;
    }

    return false;
  }

  // Auto-click Skip buttons safely without touching playback controls
  function handleSkipButtons() {
    if (!settings.autoSkipButtons) return;

    const player = getPlayerContainer();
    const clickables = player.querySelectorAll('button, [role="button"], div[class*="skip" i], a[role="button"]');

    for (let i = 0; i < clickables.length; i++) {
      const el = clickables[i];
      if (el.offsetParent === null && el.offsetWidth === 0) continue;

      const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim();
      if (!text) continue;

      // CRITICAL SAFETY CHECK: NEVER click forward 10s, backward, jump, or next episode!
      if (/\b(10|15|30|forward|backward|jump|next|episode)\b/i.test(text)) {
        continue;
      }

      // NEVER click "Go Ads free"!
      if (GO_ADS_FREE_REGEX.test(text)) continue;

      // Strictly match Ad skip buttons
      if (/^Skip\s*Ad[s]?$/i.test(text) || /^Skip$/i.test(text)) {
        console.log('[Stream Skipper] Auto-clicking ad skip button:', text);
        try {
          el.click();
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        } catch (e) {}
        return;
      }

      // Strictly match Intro/Recap skip buttons if enabled
      if (settings.skipIntros && /^(Skip\s*(Intro|Recap|Credits))$/i.test(text)) {
        console.log('[Stream Skipper] Auto-clicking intro skip button:', text);
        try {
          el.click();
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        } catch (e) {}
        return;
      }
    }
  }

  // ==========================================
  // In-WebApp Ad & Promo Removal
  // ==========================================
  const WEBAPP_AD_SELECTORS = [
    // Hotstar Billboards & Companion Ads
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
    // Prime Video Promo / Upsell banners
    '[data-testid*="banner-upsell"]',
    '[class*="pv-banner-upsell" i]',
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
        }
      }
    }

    if (isHotstar) {
      const adMedia = document.querySelectorAll('img[src*="hesads.akamaized.net"], video[src*="hesads.akamaized.net"]');
      for (let i = 0; i < adMedia.length; i++) {
        const card = adMedia[i].closest('div[class*="card"], div[class*="banner"], div[class*="widget"], div[data-testid]') || adMedia[i];
        if (card && card.style.display !== 'none') {
          card.style.setProperty('display', 'none', 'important');
        }
      }
    }
  }

  // HUD management
  function showHUD(speed) {
    if (settings.presenterMode) {
      hideHUD();
      return;
    }

    const container = document.fullscreenElement || document.body || document.documentElement;
    let hud = document.getElementById('jioad-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'jioad-hud';
      hud.innerHTML = `
        <span class="jioad-hud-icon">⚡</span>
        <span class="jioad-hud-text">Skipping Ad</span>
        <span class="jioad-hud-badge" id="jioad-hud-speed">${speed}x</span>
      `;
      container.appendChild(hud);
    } else {
      if (hud.parentElement !== container) {
        container.appendChild(hud);
      }
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

      console.log(`[Stream Skipper] Ad detected! Accelerating to ${targetSpeed}x & muting.`);
    }

    videos.forEach((video) => {
      try {
        if (settings.autoMute && !video.muted) {
          video.muted = true;
        }

        if (video.playbackRate !== targetSpeed) {
          video.playbackRate = targetSpeed;
        }

        // Only instant-seek on platforms with standalone ad video clips (like Hotstar),
        // and NEVER on Amazon Prime Video where ads are part of the stream timeline!
        if (settings.instantSeek && !isAmazon) {
          if (video.duration && isFinite(video.duration) && video.duration > 0 && video.duration <= 90) {
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

    console.log('[Stream Skipper] Ad ended. Restoring original speed and volume.');

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

  // Periodic webapp banner cleaner (every 800ms)
  setInterval(cleanWebappAds, 800);
  cleanWebappAds();

})();
