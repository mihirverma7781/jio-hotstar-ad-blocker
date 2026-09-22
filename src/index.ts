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
export { PrimeTVAbrController } from './prime/PrimeTVAbrController';
export type { AbrDecision, AbrTier } from './prime/PrimeTVAbrController';

// Real Video Enhancement & Super-Resolution Engine
export * from './enhancement';

import { TVModeController } from './core/TVModeController';
import { PrimeQualityController } from './prime/PrimeQualityController';
import { VideoEnhancementEngine } from './enhancement/VideoEnhancementEngine';

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

  // Initialize Real Video Enhancement & Super-Resolution Engine
  if (!globalObj.__video_enhancement_engine) {
    const enhancer = new VideoEnhancementEngine();
    globalObj.__video_enhancement_engine = enhancer;

    // Load storage settings
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([
        'enhancementEnabled',
        'upscalerMode',
        'enhancementScale',
        'enhancementQuality',
        'enhancementSharpness',
        'enhancementDenoise',
        'enhancementDeblock',
        'hdrVisualEnhancement',
        'motionSmoothing',
        'enhancementPreset',
        'showDebugHud'
      ], (stored) => {
        if (stored) {
          enhancer.updateConfig({
            enabled: stored.enhancementEnabled ?? true,
            upscalerMode: stored.upscalerMode || 'NEURAL',
            scale: stored.enhancementScale || 2,
            qualityTier: stored.enhancementQuality || 'HIGH',
            sharpness: stored.enhancementSharpness !== undefined ? stored.enhancementSharpness : 30,
            denoise: stored.enhancementDenoise || 'LOW',
            deblock: stored.enhancementDeblock || 'LOW',
            hdrVisualEnhancement: stored.hdrVisualEnhancement ?? true,
            motionSmoothing: stored.motionSmoothing || 'SMOOTH_60',
            preset: stored.enhancementPreset || 'CINEMA',
            showDebugHud: stored.showDebugHud ?? true
          });
        }
      });

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
          const updates: any = {};
          if (changes.enhancementEnabled !== undefined) updates.enabled = changes.enhancementEnabled.newValue;
          if (changes.upscalerMode !== undefined) updates.upscalerMode = changes.upscalerMode.newValue;
          if (changes.enhancementScale !== undefined) updates.scale = changes.enhancementScale.newValue;
          if (changes.enhancementQuality !== undefined) updates.qualityTier = changes.enhancementQuality.newValue;
          if (changes.enhancementSharpness !== undefined) updates.sharpness = changes.enhancementSharpness.newValue;
          if (changes.enhancementDenoise !== undefined) updates.denoise = changes.enhancementDenoise.newValue;
          if (changes.enhancementDeblock !== undefined) updates.deblock = changes.enhancementDeblock.newValue;
          if (changes.hdrVisualEnhancement !== undefined) updates.hdrVisualEnhancement = changes.hdrVisualEnhancement.newValue;
          if (changes.motionSmoothing !== undefined) updates.motionSmoothing = changes.motionSmoothing.newValue;
          if (changes.enhancementPreset !== undefined) updates.preset = changes.enhancementPreset.newValue;
          if (changes.showDebugHud !== undefined) updates.showDebugHud = changes.showDebugHud.newValue;
          enhancer.updateConfig(updates);
        }
      });
    }
  }
}

