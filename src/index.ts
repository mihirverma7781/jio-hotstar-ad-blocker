/**
 * TV Mode — UHD/HDR Playback Emulator
 * Entrypoint for extension content script and global API
 */

export * from './types/tv_mode';
export { TVCapabilityEngine } from './core/TVCapabilityEngine';
export { TVHdrEngine } from './core/TVHdrEngine';
export { TVRepresentationAnalyzer } from './core/TVRepresentationAnalyzer';
export { TVQualitySelector } from './core/TVQualitySelector';
export { TVAdaptationController } from './core/TVAdaptationController';
export { TVMetrics } from './core/TVMetrics';
export { TVDiagnostics } from './core/TVDiagnostics';
export { TVModeController } from './core/TVModeController';

import { TVModeController } from './core/TVModeController';
import { TVDiagnostics } from './core/TVDiagnostics';

// Auto-bootstrap on streaming pages
if (typeof window !== 'undefined') {
  const globalObj = window as any;

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
}
