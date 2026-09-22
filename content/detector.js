/**
 * JioHotstar Ad Skipper - Content Engine
 * Detects in-video ads (e.g. "Go Ads free", "Ad · 00:06", ad overlays),
 * accelerates playback to 16x, auto-mutes, instant-seeks, and auto-clicks skip buttons.
 */

(function () {
  'use strict';

  if (window.__jiohotstar_detector_loaded) return;
  window.__jiohotstar_detector_loaded = true;

  console.log('[JioHotstar Ad Skipper] Content detector active.');

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

  // State tracking
  let isAdCurrentlyActive = false;
  let previousPlaybackRate = 1.0;
  let previousMuted = false;
  let adStartTime = 0;
  let consecutiveNonAdTicks = 0;

  // Load initial settings from chrome.storage
  chrome.storage.local.get(null, (stored) => {
    if (stored) {
      settings = { ...settings, ...stored };
    }
  });

  // Listen for settings updates
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      for (const [key, change] of Object.entries(changes)) {
        settings[key] = change.newValue;
      }
      if (!settings.enabled && isAdCurrentlyActive) {
        exitAdMode();
      }
    }
  });

  // Fallback: Inject main-world script if not already loaded via manifest
  function injectMainWorldFallback() {
    if (document.getElementById('jioad-main-script')) return;
    try {
      const script = document.createElement('script');
      script.id = 'jioad-main-script';
      script.src = chrome.runtime.getURL('content/injector.js');
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
    } catch (err) {}
  }
  injectMainWorldFallback();

  // Listen for background beacon messages
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'HOTSTAR_AD_BEACON') {
      if (!settings.enabled) return;
      console.log(`[JioHotstar Ad Skipper] Ad beacon ping: ${message.adName} (${message.durationSec}s)`);
      enterAdMode(message.durationSec || 15);
    }
  });

  // ==========================================
  // In-Video Ad Detection Logic
  // ==========================================

  // Regular expressions to match Hotstar in-video ad cues
  const AD_TEXT_REGEXES = [
    /go\s+ads?\s*free/i,                    // Matches "Go Ads free", "Go Ad free" button
    /^Ad\s*[·•:\-\s]\s*\d{1,2}:\d{2}/i,      // Matches "Ad · 00:06", "Ad • 00:15"
    /\bAd\s*[·•:\-]\s*\d{1,2}:\d{2}\b/i,    // Substring match for ad timers
    /\bAd\s+\d+\s+of\s+\d+/i,               // Matches "Ad 1 of 2"
    /\bAd\s*:\s*\d+s?\b/i,                  // Matches "Ad : 15s"
    /\bAd will end in\b/i,                  // Matches countdown label
    /\bYour video will resume shortly\b/i,   // Matches resume label
    /\bAdvertisement\b/i                    // Matches standalone badge
  ];

  function isAdDetectedInDOM() {
    // 1. Scan leaf / near-leaf elements for explicit ad labels
    const candidates = document.querySelectorAll(
      'button, [role="button"], span, div, p, a, [data-testid*="ad"], [class*="ad-"], [class*="ad_"], [class*="adBadge"]'
    );

    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      // Keep search ultra-fast: only inspect elements with few children or buttons
      if (el.children.length <= 2 || el.tagName === 'BUTTON') {
        const text = (el.textContent || '').trim();
        if (!text) continue;

        for (let j = 0; j < AD_TEXT_REGEXES.length; j++) {
          if (AD_TEXT_REGEXES[j].test(text)) {
            return true;
          }
        }
      }
    }

    // 2. Check for explicit aria-label or testid markers
    const adMarked = document.querySelector(
      '[aria-label*="advertisement" i], [data-testid*="ad-indicator"], [data-testid*="ad-badge"], .ad-tag, .adBadge'
    );
    if (adMarked && adMarked.offsetParent !== null) {
      return true;
    }

    return false;
  }

  // ==========================================
  // Auto-Click Skip Buttons
  // ==========================================

  function handleSkipButtons() {
    if (!settings.autoSkipButtons) return;

    const skipPatterns = [
      /Skip\s*Ad/i,
      /Skip\s*Ads/i,
      /^Skip$/i
    ];

    if (settings.skipIntros) {
      skipPatterns.push(/Skip\s*Intro/i, /Skip\s*Recap/i, /Skip\s*Credits/i);
    }

    const clickables = document.querySelectorAll(
      'button, [role="button"], div[class*="skip" i], span[class*="skip" i], a[class*="skip" i], [data-testid*="skip" i]'
    );

    for (let i = 0; i < clickables.length; i++) {
      const el = clickables[i];
      if (el.offsetParent === null) continue; // Hidden

      const text = (el.innerText || el.textContent || '').trim();
      // Explicitly protect "Go Ads free" from being clicked!
      if (/go\s+ads?\s*free/i.test(text)) continue;

      for (let j = 0; j < skipPatterns.length; j++) {
        if (skipPatterns[j].test(text) && text.length < 25) {
          console.log('[JioHotstar Ad Skipper] Auto-clicking skip button:', text);
          try {
            el.click();
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          } catch (e) {}
          return;
        }
      }
    }
  }

  // ==========================================
  // Floating HUD Pill
  // ==========================================

  function showHUD() {
    let hud = document.getElementById('jioad-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'jioad-hud';
      hud.innerHTML = `
        <span class="jioad-hud-icon">⚡</span>
        <span class="jioad-hud-text">Skipping Ad</span>
        <span class="jioad-hud-badge" id="jioad-hud-speed">${settings.playbackSpeed}x</span>
      `;
      const playerContainer = document.getElementById('video-container') ||
                              document.querySelector('[data-testid*="player"]') ||
                              document.querySelector('.shaka-video-container') ||
                              document.body;
      if (playerContainer) {
        playerContainer.appendChild(hud);
      }
    } else {
      const badge = document.getElementById('jioad-hud-speed');
      if (badge) badge.textContent = `${settings.playbackSpeed}x`;
      hud.style.display = 'flex';
    }
  }

  function hideHUD() {
    const hud = document.getElementById('jioad-hud');
    if (hud) hud.style.display = 'none';
  }

  // ==========================================
  // Execution: Enter & Exit Ad Mode
  // ==========================================

  function enterAdMode(estimatedDuration = 15) {
    if (!settings.enabled) return;

    const videos = document.querySelectorAll('video');
    if (videos.length === 0) return;

    if (!isAdCurrentlyActive) {
      isAdCurrentlyActive = true;
      adStartTime = Date.now();
      consecutiveNonAdTicks = 0;

      const primary = videos[0];
      previousPlaybackRate = primary.playbackRate || 1.0;
      previousMuted = primary.muted;

      console.log(`[JioHotstar Ad Skipper] ⚡ In-video ad active! Accelerating (${settings.playbackSpeed}x) & muting.`);
    }

    const targetSpeed = Number(settings.playbackSpeed) || 16.0;

    // Apply speed, mute, and instant seek across all video elements
    videos.forEach((v) => {
      try {
        if (settings.autoMute && !v.muted) {
          v.muted = true;
        }
        if (v.playbackRate !== targetSpeed) {
          v.playbackRate = targetSpeed;
        }
        if (settings.blurAdVideo) {
          v.classList.add('jioad-video-blur');
        }

        // Instant Seek: If duration represents an ad segment (< 180s)
        if (settings.instantSeek && v.duration && isFinite(v.duration) && v.duration > 0 && v.duration <= 180) {
          if (v.currentTime < v.duration - 0.1) {
            v.currentTime = v.duration;
          }
        }
      } catch (e) {}
    });

    // Notify main world script
    document.documentElement.setAttribute('data-jioad-active', 'true');
    window.dispatchEvent(new CustomEvent('jioad-speed-override', {
      detail: { active: true, speed: targetSpeed, seek: settings.instantSeek }
    }));

    showHUD();
  }

  function exitAdMode() {
    if (!isAdCurrentlyActive) return;
    isAdCurrentlyActive = false;
    consecutiveNonAdTicks = 0;

    console.log('[JioHotstar Ad Skipper] Ad ended. Restoring normal playback.');

    const videos = document.querySelectorAll('video');
    videos.forEach((v) => {
      try {
        v.playbackRate = previousPlaybackRate || 1.0;
        if (settings.autoMute) {
          v.muted = previousMuted;
        }
        v.classList.remove('jioad-video-blur');
      } catch (e) {}
    });

    document.documentElement.removeAttribute('data-jioad-active');
    window.dispatchEvent(new CustomEvent('jioad-speed-override', {
      detail: { active: false, speed: 1.0 }
    }));

    hideHUD();

    // Report saved time to stats
    const elapsed = Math.max(1, Math.round((Date.now() - adStartTime) / 1000));
    chrome.runtime.sendMessage({
      action: 'AD_SKIPPED',
      duration: elapsed
    }).catch(() => {});
  }

  // ==========================================
  // Continuous Monitor Loop
  // ==========================================

  function tick() {
    if (!settings.enabled) return;

    handleSkipButtons();

    const adDetected = isAdDetectedInDOM();

    if (adDetected) {
      consecutiveNonAdTicks = 0;
      enterAdMode();
    } else if (isAdCurrentlyActive) {
      // Require 3 consecutive clean ticks before exiting to prevent flickering
      consecutiveNonAdTicks++;
      if (consecutiveNonAdTicks >= 3) {
        exitAdMode();
      }
    }
  }

  // High-frequency poll (every 120ms)
  setInterval(tick, 120);

  // MutationObserver for instant DOM updates
  const observer = new MutationObserver(() => {
    if (settings.enabled) {
      handleSkipButtons();
      if (isAdDetectedInDOM()) {
        consecutiveNonAdTicks = 0;
        enterAdMode();
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

})();
