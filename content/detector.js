/**
 * JioHotstar Ad Skipper - Safe & Ultra-Fast Content Engine
 * Detects in-video ads ("Go Ads free", "Ad · 00:xx"), accelerates playback (16x),
 * auto-mutes, auto-clicks skip buttons, and removes in-webapp promo banners & billboard ads.
 * 
 * Performance Optimized:
 * - Scopes all DOM scans strictly to the active player container (< 25 nodes vs 10,000+).
 * - Zero recurring layout reflows or forced style recalculations.
 * - Hardware-accelerated transitions to ensure 60fps silky smooth screen sharing.
 */

(function () {
  'use strict';

  if (window.__jiohotstar_skipper_v2) return;
  window.__jiohotstar_skipper_v2 = true;

  console.log('[JioHotstar Ad Skipper] Active and monitoring (Performance Optimized).');

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
  let cachedPlayerContainer = null;
  let cachedVideo = null;

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

  // Skip button patterns
  const SKIP_BASE_PATTERNS = [/Skip\s*Ad/i, /Skip\s*Ads/i, /^Skip$/i];
  const SKIP_INTRO_PATTERNS = [/Skip\s*Intro/i, /Skip\s*Recap/i, /Skip\s*Credits/i];

  /**
   * Locate the active video element efficiently
   */
  function getActiveVideo() {
    if (cachedVideo && cachedVideo.isConnected) {
      return cachedVideo;
    }
    const videos = document.querySelectorAll('video');
    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      if (v.isConnected && (v.offsetWidth > 0 || v.videoWidth > 0 || !v.paused)) {
        cachedVideo = v;
        return v;
      }
    }
    cachedVideo = videos[0] || null;
    return cachedVideo;
  }

  /**
   * Find the player container enclosing the active video.
   * Scoping queries to this container avoids scanning thousands of unrelated page nodes.
   */
  function getPlayerContainer(video) {
    if (!video) return null;
    if (cachedPlayerContainer && cachedPlayerContainer.isConnected && cachedPlayerContainer.contains(video)) {
      return cachedPlayerContainer;
    }

    const container = video.closest(
      '[data-testid*="player" i], [class*="player" i], [id*="player" i], .shaka-video-container, .video-player'
    ) || video.parentElement?.parentElement || video.parentElement || document.body;

    cachedPlayerContainer = container;
    return container;
  }

  /**
   * High-performance ad detection scoped strictly to the player container
   */
  function checkIsAdPlaying(playerContainer) {
    if (!playerContainer) return false;

    // Targeted query for ad-related elements inside the player only (~5-20 nodes max)
    const candidates = playerContainer.querySelectorAll(
      'button, [role="button"], [class*="ad" i], [class*="timer" i], [class*="badge" i], [data-testid*="ad" i], [data-testid*="timer" i]'
    );

    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
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

    // Direct check for explicit ad badge elements within player
    const adTag = playerContainer.querySelector('[data-testid*="ad-badge"], [data-testid*="ad-indicator"], .ad-tag, .adBadge');
    if (adTag && adTag.offsetParent !== null) {
      return true;
    }

    return false;
  }

  /**
   * High-performance skip button auto-clicker scoped strictly to the player container
   */
  function handleSkipButtons(playerContainer) {
    if (!settings.autoSkipButtons || !playerContainer) return;

    const skipRegexes = settings.skipIntros
      ? [...SKIP_BASE_PATTERNS, ...SKIP_INTRO_PATTERNS]
      : SKIP_BASE_PATTERNS;

    const clickables = playerContainer.querySelectorAll(
      'button, [role="button"], [class*="skip" i], [data-testid*="skip" i]'
    );

    for (let i = 0; i < clickables.length; i++) {
      const el = clickables[i];
      if (el.offsetParent === null) continue;

      const text = (el.innerText || el.textContent || '').trim();
      if (!text || GO_ADS_FREE_REGEX.test(text)) continue;

      for (let j = 0; j < skipRegexes.length; j++) {
        if (skipRegexes[j].test(text) && text.length < 30) {
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

  /**
   * HUD Indicator Management
   */
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

  /**
   * Accelerate Ad Playback & Mute
   */
  function accelerateAd(video) {
    if (!video) return;
    const targetSpeed = Number(settings.playbackSpeed) || 16.0;

    if (!isAdActive) {
      isAdActive = true;
      adStartTime = Date.now();
      nonAdCount = 0;

      previousMuted = video.muted;
      previousPlaybackRate = video.playbackRate <= 2 ? (video.playbackRate || 1.0) : 1.0;

      console.log(`[JioHotstar Ad Skipper] Ad detected! Accelerating to ${targetSpeed}x & muting.`);
    }

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
      } else {
        video.classList.remove('jioad-video-blur');
      }
    } catch (e) {}

    showHUD(targetSpeed);
  }

  /**
   * Restore Normal Playback
   */
  function restorePlayback() {
    if (!isAdActive) return;
    isAdActive = false;
    nonAdCount = 0;

    console.log('[JioHotstar Ad Skipper] Ad ended. Restoring original speed and volume.');

    const video = getActiveVideo();
    if (video) {
      try {
        video.playbackRate = previousPlaybackRate || 1.0;
        if (settings.autoMute) {
          video.muted = previousMuted;
        }
        video.classList.remove('jioad-video-blur');
      } catch (e) {}
    }

    hideHUD();

    const elapsed = Math.max(1, Math.round((Date.now() - adStartTime) / 1000));
    chrome.runtime.sendMessage({
      action: 'AD_SKIPPED',
      duration: elapsed
    }).catch(() => {});
  }

  /**
   * Lightweight one-time webapp cleanup (relying primarily on CSS rules)
   */
  function cleanWebappAdsOnce() {
    if (!settings.enabled || !settings.removeWebappAds) return;
    // Hide Akamaized ad media if any leaked past CSS
    const adMedia = document.querySelectorAll('img[src*="hesads.akamaized.net"], video[src*="hesads.akamaized.net"]');
    for (let i = 0; i < adMedia.length; i++) {
      const card = adMedia[i].closest('div[class*="card"], div[class*="banner"], div[class*="widget"]') || adMedia[i];
      if (card && card.style.display !== 'none') {
        card.style.display = 'none';
      }
    }
  }

  // Run one-time cleanup on navigation rather than an aggressive interval
  cleanWebappAdsOnce();
  window.addEventListener('popstate', cleanWebappAdsOnce, { passive: true });

  /**
   * Optimized Monitor Loop
   * Runs every 350ms (or 1000ms if tab is hidden in background), zero reflows.
   */
  function monitorTick() {
    if (settings.enabled) {
      const video = getActiveVideo();

      if (video) {
        const playerContainer = getPlayerContainer(video);
        handleSkipButtons(playerContainer);

        const adDetected = checkIsAdPlaying(playerContainer);

        if (adDetected) {
          nonAdCount = 0;
          accelerateAd(video);
        } else if (isAdActive) {
          nonAdCount++;
          if (nonAdCount >= 2) {
            restorePlayback();
          }
        }
      } else if (isAdActive) {
        restorePlayback();
      }
    }

    const nextDelay = document.hidden ? 1000 : 350;
    setTimeout(monitorTick, nextDelay);
  }

  // Start the tick loop
  setTimeout(monitorTick, 350);

})();
