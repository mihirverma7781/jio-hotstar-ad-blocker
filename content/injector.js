/**
 * JioHotstar Ad Skipper - Main World Injector
 * Runs directly in the webpage context (MAIN world) at document_start.
 * 
 * Intercepts VMAP / mid-roll ad scheduling requests to prevent in-video ads
 * from being scheduled, and guards HTMLMediaElement.prototype.playbackRate
 * from player throttles.
 */

(function () {
  'use strict';

  if (window.__jiohotstar_main_injected) return;
  window.__jiohotstar_main_injected = true;

  console.log('[JioHotstar Ad Skipper] Main world interceptor active.');

  let isAdActive = false;
  let targetSpeed = 16.0;

  // ==========================================
  // 1. VMAP / Mid-Roll Network Interception
  // ==========================================

  function isAdScheduleRequest(url) {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();

    // Endpoints for mid-roll, pre-roll, VMAP, or VAST
    if (lower.includes('/midroll') || lower.includes('/preroll') || lower.includes('/vmap') || lower.includes('/vast')) {
      return true;
    }
    if (lower.includes('vmap=') || lower.includes('vmap.xml') || lower.includes('vast.xml')) {
      return true;
    }

    // Hotstar user_segment and prefetch targeting
    if (lower.includes('user_segment=') && (lower.includes('prefetch=') || lower.includes('ad') || lower.includes('vmap'))) {
      return true;
    }

    // Ad break playlist queries
    if (lower.includes('adbreak') || lower.includes('ad_break') || lower.includes('adschedule') || lower.includes('ad-schedule')) {
      return true;
    }

    return false;
  }

  // Standard empty VMAP XML response (0 ad breaks scheduled)
  const EMPTY_VMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0"/>`;

  // Intercept window.fetch
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    let url = '';
    try {
      if (typeof args[0] === 'string') {
        url = args[0];
      } else if (args[0] instanceof Request) {
        url = args[0].url;
      } else if (args[0] && args[0].url) {
        url = args[0].url;
      }
    } catch (e) {}

    if (url && isAdScheduleRequest(url)) {
      console.log('[JioHotstar Ad Skipper] 🛡️ Intercepted VMAP/mid-roll fetch:', url);
      return new Response(EMPTY_VMAP_XML, {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/xml; charset=utf-8'
        }
      });
    }

    return originalFetch.apply(this, args);
  };

  // Intercept XMLHttpRequest
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._jio_url = typeof url === 'string' ? url : (url ? url.toString() : '');
    this._jio_method = method;
    return originalXhrOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    if (this._jio_url && isAdScheduleRequest(this._jio_url)) {
      console.log('[JioHotstar Ad Skipper] 🛡️ Intercepted VMAP/mid-roll XHR:', this._jio_url);

      Object.defineProperty(this, 'status', { configurable: true, writable: false, value: 200 });
      Object.defineProperty(this, 'statusText', { configurable: true, writable: false, value: 'OK' });
      Object.defineProperty(this, 'readyState', { configurable: true, writable: false, value: 4 });
      Object.defineProperty(this, 'responseText', { configurable: true, writable: false, value: EMPTY_VMAP_XML });
      Object.defineProperty(this, 'response', { configurable: true, writable: false, value: EMPTY_VMAP_XML });

      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(EMPTY_VMAP_XML, 'text/xml');
        Object.defineProperty(this, 'responseXML', { configurable: true, writable: false, value: xmlDoc });
      } catch (e) {}

      setTimeout(() => {
        if (typeof this.onreadystatechange === 'function') {
          this.onreadystatechange(new Event('readystatechange'));
        }
        if (typeof this.onload === 'function') {
          this.onload(new ProgressEvent('load'));
        }
        if (typeof this.onloadend === 'function') {
          this.onloadend(new ProgressEvent('loadend'));
        }
        this.dispatchEvent(new Event('readystatechange'));
        this.dispatchEvent(new ProgressEvent('load'));
        this.dispatchEvent(new ProgressEvent('loadend'));
      }, 5);

      return;
    }

    return originalXhrSend.apply(this, args);
  };

  // ==========================================
  // 2. Playback Speed Protection & Video Hooks
  // ==========================================

  const originalRateDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');

  if (originalRateDesc && originalRateDesc.set && originalRateDesc.get) {
    Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
      configurable: true,
      enumerable: true,
      get: function () {
        return originalRateDesc.get.call(this);
      },
      set: function (val) {
        if (isAdActive && (val === 1 || val < targetSpeed)) {
          return originalRateDesc.set.call(this, targetSpeed);
        }
        return originalRateDesc.set.call(this, val);
      }
    });
  }

  // Handle command from content script
  window.addEventListener('jioad-speed-override', (e) => {
    const detail = e.detail || {};
    isAdActive = detail.active ?? false;
    targetSpeed = detail.speed || 16.0;
    const shouldSeek = detail.seek ?? false;

    const videos = document.querySelectorAll('video');
    videos.forEach((video) => {
      try {
        if (isAdActive) {
          // Force mute
          video.muted = true;

          // Force rate
          if (originalRateDesc && originalRateDesc.set) {
            originalRateDesc.set.call(video, targetSpeed);
          } else {
            video.playbackRate = targetSpeed;
          }

          // Attempt instant seek past ad clip
          if (shouldSeek && video.duration && isFinite(video.duration) && video.duration > 0 && video.duration <= 180) {
            video.currentTime = video.duration;
          }
        } else {
          // Restore normal rate
          if (originalRateDesc && originalRateDesc.set) {
            originalRateDesc.set.call(video, 1.0);
          } else {
            video.playbackRate = 1.0;
          }
        }
      } catch (err) {
        // Ignored
      }
    });
  });

  // Guard ratechange events while ad is active
  document.addEventListener('ratechange', (e) => {
    if (isAdActive && e.target instanceof HTMLMediaElement) {
      if (e.target.playbackRate !== targetSpeed) {
        try {
          if (originalRateDesc && originalRateDesc.set) {
            originalRateDesc.set.call(e.target, targetSpeed);
          } else {
            e.target.playbackRate = targetSpeed;
          }
        } catch (err) {}
      }
    }
  }, true);

})();
