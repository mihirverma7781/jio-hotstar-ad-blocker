/**
 * TV Mode — UHD/HDR Playback Emulator & Prime Video Integration
 * Entrypoint for extension content script and global API
 */

export * from './types/tv_mode';
export * from './types/drm_research';

// Generic TV Mode Engine
export { TVCapabilityEngine, TVCapabilityEngine as MediaCapabilityEngine } from './core/TVCapabilityEngine';
export { TVHdrEngine, TVHdrEngine as HDRCapabilityEngine } from './core/TVHdrEngine';
export { TVRepresentationAnalyzer, TVRepresentationAnalyzer as RepresentationAnalyzer } from './core/TVRepresentationAnalyzer';
export { TVQualitySelector } from './core/TVQualitySelector';
export { TVAdaptationController } from './core/TVAdaptationController';
export { TVMetrics } from './core/TVMetrics';
export { TVDiagnostics } from './core/TVDiagnostics';
export { TVModeController } from './core/TVModeController';
export { PlaybackVerifier } from './core/PlaybackVerifier';

// Prime Video Integration Layer
export { PrimeRepresentationProbe } from './prime/PrimeRepresentationProbe';
export { PrimePlayerAdapter } from './prime/PrimePlayerAdapter';
export { PrimeQualityController } from './prime/PrimeQualityController';
export { PrimeDebugPanel } from './prime/PrimeDebugPanel';

import { TVModeController } from './core/TVModeController';
import { PrimeQualityController } from './prime/PrimeQualityController';

// Auto-bootstrap on streaming pages
if (typeof window !== 'undefined') {
  const globalObj = window as any;

  // Initialize Generic TV Mode
  if (!globalObj.__tv_mode_controller) {
    globalObj.__tv_mode_controller = new TVModeController();

    // Check storage for user settings
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['tvModeEnabled', 'tvPreferredQuality', 'tvPreferHDR', 'tvAdaptationStrategy'], (stored) => {
        if (stored) {
          const enabled = stored.tvModeEnabled ?? true;
          globalObj.__tv_mode_controller.setEnabled(enabled);

          const prefRes = stored.tvPreferredQuality ? parseInt(stored.tvPreferredQuality, 10) : 2160;
          const prefHdr = stored.tvPreferHDR ?? true;
          const strategy = stored.tvAdaptationStrategy || 'tv-balanced';

          globalObj.__tv_mode_controller.updateProfile({
            preferredResolution: isNaN(prefRes) ? 2160 : prefRes,
            preferHDR: prefHdr,
            adaptationStrategy: strategy
          });
        }
      });

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
          if (changes.tvModeEnabled !== undefined) {
            globalObj.__tv_mode_controller.setEnabled(changes.tvModeEnabled.newValue);
          }
          if (changes.tvPreferredQuality !== undefined) {
            const val = parseInt(changes.tvPreferredQuality.newValue, 10);
            globalObj.__tv_mode_controller.updateProfile({
              preferredResolution: isNaN(val) ? 2160 : val
            });
          }
          if (changes.tvPreferHDR !== undefined) {
            globalObj.__tv_mode_controller.updateProfile({
              preferHDR: changes.tvPreferHDR.newValue
            });
          }
        }
      });
    }

    // Connect to video elements dynamically
    const attachToVideos = () => {
      document.querySelectorAll('video').forEach(v => {
        if (!(v as any).__tv_mode_attached) {
          (v as any).__tv_mode_attached = true;
          globalObj.__tv_mode_controller.attachVideo(v);
        }
      });
    };

    attachToVideos();
    setInterval(attachToVideos, 2000);
  }

  // Prime Video specific bootstrapping
  const isPrime = /primevideo\.|amazon\./i.test(window.location.hostname);
  if (isPrime && !globalObj.__prime_quality_controller) {
    // Inject fallback script tag into DOM for prime_bridge
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        const s = document.createElement('script');
        s.src = chrome.runtime.getURL('dist/prime_bridge.js');
        s.onload = () => s.remove();
        (document.head || document.documentElement).appendChild(s);
      }
    } catch (e) {}

    const primeCtrl = new PrimeQualityController();
    globalObj.__prime_quality_controller = primeCtrl;
    primeCtrl.start();

    // Listen for extension commands or hotkeys (Alt+Shift+P for Prime panel)
    window.addEventListener('keydown', (e) => {
      if (e.altKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        primeCtrl.toggleDebugPanel();
      }
    });

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'toggle_prime_debug') {
          primeCtrl.toggleDebugPanel();
        }
      });
    }
  }
}
