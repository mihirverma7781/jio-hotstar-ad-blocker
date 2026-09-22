/**
 * JioHotstar Ad Skipper - Safe & Ultra-Fast Content Engine
 * Detects in-video ads ("Go Ads free", "Ad · 00:xx"), accelerates playback (16x),
 * auto-mutes, and auto-clicks skip buttons with zero page lag.
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
    skipIntros: true
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

  // Fast ad detection regexes
  const GO_ADS_FREE_REGEX = /go\s+ads?\s*free/i;
  const AD_TIMER_REGEX = /^Ad\s*[·•:\-\s]\s*\d{1,2}:\d{2}/i;
  const AD_SUBSTRING_REGEX = /\bAd\s*[·•:\-]\s*\d{1,2}:\d{2}\b/i;
  const AD_COUNT_REGEX = /\bAd\s+\d+\s+of\s+\d+/i;

  // Scan visible DOM elements for Hotstar ad markers
  function checkIsAdPlaying() {
    // Look at buttons, spans, and leaf divs inside the document
    const elements = document.querySelectorAll('button, [role="button"], span, div');
    
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      // Only inspect elements that have 2 or fewer children (leaf text containers)
      if (el.children.length <= 2) {
        const text = (el.textContent || '').trim();
        if (!text) continue;

        // Check for "Go Ads free" (prominent Hotstar in-video ad button)
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
      if (el.offsetParent === null) continue; // Not visible

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

  // HUD management
  function showHUD(speed) {
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

      // Remember initial state from first video
      previousMuted = videos[0].muted;
      previousPlaybackRate = videos[0].playbackRate <= 2 ? (videos[0].playbackRate || 1.0) : 1.0;

      console.log(`[JioHotstar Ad Skipper] Ad detected! Accelerating to ${targetSpeed}x & muting.`);
    }

    videos.forEach((video) => {
      try {
        // Auto-Mute
        if (settings.autoMute && !video.muted) {
          video.muted = true;
        }

        // Fast forward
        if (video.playbackRate !== targetSpeed) {
          video.playbackRate = targetSpeed;
        }

        // Instant seek if short ad clip
        if (settings.instantSeek && video.duration && isFinite(video.duration)) {
          if (video.duration > 0 && video.duration <= 180) {
            if (video.currentTime < video.duration - 0.1) {
              video.currentTime = video.duration;
            }
          }
        }

        // Blur ad video
        if (settings.blurAdVideo) {
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

    // Track saved time
    const elapsed = Math.max(1, Math.round((Date.now() - adStartTime) / 1000));
    chrome.runtime.sendMessage({
      action: 'AD_SKIPPED',
      duration: elapsed
    }).catch(() => {});
  }

  // Safe periodic monitor loop (every 250ms)
  // Low CPU usage, zero interference with Widevine DRM or player streaming
  setInterval(() => {
    if (!settings.enabled) return;

    handleSkipButtons();

    const adDetected = checkIsAdPlaying();

    if (adDetected) {
      nonAdCount = 0;
      accelerateAd();
    } else if (isAdActive) {
      // Require 2 consecutive clean checks to ensure ad is genuinely finished
      nonAdCount++;
      if (nonAdCount >= 2) {
        restorePlayback();
      }
    }
  }, 250);

})();
