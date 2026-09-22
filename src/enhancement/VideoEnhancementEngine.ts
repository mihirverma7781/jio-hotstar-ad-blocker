/**
 * VideoEnhancementEngine
 * Top-level controller for real-time video super-resolution and enhancement.
 * Mounts GPU presentation canvas over active video elements, manages render loop,
 * handles A/B comparison hotkey (Alt+Shift+E), side-by-side split screen, and debug HUD.
 */

import { FrameAccessManager } from './FrameAccessManager';
import { GpuVideoProcessor } from './GpuVideoProcessor';
import { VideoUpscalerEngine } from './VideoUpscalerEngine';
import { FrameRateInterpolator } from './FrameRateInterpolator';
import { HDRVisualEnhancer } from './HDRVisualEnhancer';
import { PresetEngine } from './PresetEngine';
import { EnhancementPerformanceController } from './EnhancementPerformanceController';
import { VideoElementTracker } from './VideoElementTracker';
import { EnhancementPipeline } from './EnhancementPipeline';
import { EnhancementConfig, EnhancementMetrics, PresetName } from './types';

export class VideoEnhancementEngine {
  private config: EnhancementConfig;
  private frameAccessManager: FrameAccessManager;
  private upscalerEngine: VideoUpscalerEngine;
  private interpolator: FrameRateInterpolator;
  private hdrEnhancer: HDRVisualEnhancer;
  private performanceController: EnhancementPerformanceController;
  private tracker: VideoElementTracker;
  private pipeline: EnhancementPipeline;
  private gpuProcessor: GpuVideoProcessor | null = null;

  private activeVideo: HTMLVideoElement | null = null;
  private presentationCanvas: HTMLCanvasElement | null = null;
  private hudElement: HTMLElement | null = null;
  private splitSliderElement: HTMLElement | null = null;

  private isRunning: boolean = false;
  private rvfcId: number | null = null;
  private rafId: number | null = null;

  constructor(customConfig?: Partial<EnhancementConfig>) {
    this.config = {
      enabled: true,
      upscalerMode: 'NEURAL',
      scale: 2,
      qualityTier: 'HIGH',
      sharpness: 30,
      denoise: 'LOW',
      deblock: 'LOW',
      contrast: 104,
      saturation: 104,
      hdrVisualEnhancement: true,
      hdrIntensity: 'BALANCED',
      motionSmoothing: 'SMOOTH_60', // 60 FPS motion smoothing
      gpuBackend: 'AUTO',
      preset: 'CINEMA',
      sideBySideComparison: false,
      compareSplitPosition: 0.5,
      bypassEnhancement: false,
      showDebugHud: true,
      tiledProcessing: false,
      tileSize: 512,
      ...customConfig
    };

    this.frameAccessManager = new FrameAccessManager();
    this.upscalerEngine = new VideoUpscalerEngine();
    this.interpolator = new FrameRateInterpolator(this.config.motionSmoothing);
    this.hdrEnhancer = new HDRVisualEnhancer();
    this.performanceController = new EnhancementPerformanceController(this.config.qualityTier);
    this.tracker = new VideoElementTracker();

    this.pipeline = new EnhancementPipeline(
      this.frameAccessManager,
      this.upscalerEngine,
      this.interpolator,
      this.hdrEnhancer,
      this.performanceController
    );

    this.initKeyboardShortcuts();
    this.tracker.onVideoChange((video) => this.attachToVideo(video));
  }

  private initKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      // Alt+Shift+E: Toggle A/B Comparison (Original vs Enhanced)
      if (e.altKey && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault();
        this.toggleBypass();
      }

      // Alt+Shift+S: Toggle Side-by-Side Split View
      if (e.altKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        this.toggleSideBySide();
      }

      // Alt+Shift+H: Toggle Debug HUD
      if (e.altKey && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
        e.preventDefault();
        this.config.showDebugHud = !this.config.showDebugHud;
        this.updateHudVisibility();
      }
    });
  }

  public async attachToVideo(video: HTMLVideoElement | null): Promise<void> {
    if (this.activeVideo === video) return;

    this.stopRenderLoop();
    this.activeVideo = video;

    if (!video) {
      this.removePresentationCanvas();
      this.removeHud();
      return;
    }

    // Ensure presentation canvas exists
    if (!this.presentationCanvas) {
      this.presentationCanvas = document.createElement('canvas');
      this.presentationCanvas.className = 'enhancement-presentation-canvas';
      this.presentationCanvas.style.position = 'absolute';
      this.presentationCanvas.style.pointerEvents = 'none';
      this.presentationCanvas.style.zIndex = '10';
      this.presentationCanvas.style.objectFit = 'contain';
      this.presentationCanvas.style.transition = 'opacity 0.2s ease';
    }

    // Initialize GPU processor with presentation canvas
    this.gpuProcessor = new GpuVideoProcessor(this.presentationCanvas);
    await this.gpuProcessor.initialize(this.config.gpuBackend);
    this.pipeline.setGpuProcessor(this.gpuProcessor);

    this.mountCanvasOverVideo(video);
    this.createOrUpdateHud();
    this.startRenderLoop();
  }

  private mountCanvasOverVideo(video: HTMLVideoElement): void {
    if (!this.presentationCanvas) return;

    const parent = video.parentElement;
    if (parent) {
      if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }
      if (this.presentationCanvas.parentElement !== parent) {
        parent.appendChild(this.presentationCanvas);
      }
      this.syncCanvasPosition();
    }
  }

  private syncCanvasPosition(): void {
    if (!this.activeVideo || !this.presentationCanvas) return;

    const v = this.activeVideo;
    const c = this.presentationCanvas;

    c.style.top = `${v.offsetTop}px`;
    c.style.left = `${v.offsetLeft}px`;
    c.style.width = `${v.offsetWidth}px`;
    c.style.height = `${v.offsetHeight}px`;
  }

  private startRenderLoop(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const renderTick = (now: number, metadata?: any) => {
      if (!this.isRunning || !this.activeVideo) return;

      if (metadata && metadata.mediaTime) {
        this.interpolator.onSourceFrame(metadata.mediaTime, metadata.expectedDisplayTime || now);
      }

      this.syncCanvasPosition();

      // Check if bypass mode is active (show original video)
      if (this.config.bypassEnhancement || !this.config.enabled) {
        if (this.presentationCanvas) this.presentationCanvas.style.opacity = '0';
      } else {
        if (this.presentationCanvas) this.presentationCanvas.style.opacity = '1';
        this.pipeline.processFrame(this.activeVideo, this.config, now);
      }

      this.updateHudMetrics(this.pipeline.getMetrics());

      // Schedule next frame
      if ('requestVideoFrameCallback' in this.activeVideo) {
        this.rvfcId = (this.activeVideo as any).requestVideoFrameCallback(renderTick);
      } else {
        this.rafId = requestAnimationFrame(renderTick);
      }
    };

    if (this.activeVideo) {
      if ('requestVideoFrameCallback' in this.activeVideo) {
        this.rvfcId = (this.activeVideo as any).requestVideoFrameCallback(renderTick);
      } else {
        this.rafId = requestAnimationFrame(renderTick);
      }
    }
  }

  private stopRenderLoop(): void {
    this.isRunning = false;
    if (this.rvfcId !== null && this.activeVideo && 'cancelVideoFrameCallback' in this.activeVideo) {
      (this.activeVideo as any).cancelVideoFrameCallback(this.rvfcId);
      this.rvfcId = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public toggleBypass(): boolean {
    this.config.bypassEnhancement = !this.config.bypassEnhancement;
    console.log(`[VideoEnhancement] A/B Mode: ${this.config.bypassEnhancement ? 'ORIGINAL' : 'ENHANCED'}`);
    return this.config.bypassEnhancement;
  }

  public toggleSideBySide(): boolean {
    this.config.sideBySideComparison = !this.config.sideBySideComparison;
    return this.config.sideBySideComparison;
  }

  public applyPreset(name: PresetName): void {
    this.config = PresetEngine.applyPresetToConfig(name, this.config);
  }

  public updateConfig(newConfig: Partial<EnhancementConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.interpolator.setMode(this.config.motionSmoothing);
    this.performanceController.setTier(this.config.qualityTier);
  }

  public getConfig(): EnhancementConfig {
    return { ...this.config };
  }

  public getMetrics(): EnhancementMetrics {
    return this.pipeline.getMetrics();
  }

  // ==========================================
  // On-Screen HUD & Diagnostic Presentation
  // ==========================================
  private createOrUpdateHud(): void {
    if (typeof document === 'undefined' || !this.activeVideo) return;

    if (!this.hudElement) {
      this.hudElement = document.createElement('div');
      this.hudElement.id = 'video-enhancement-hud';
      this.hudElement.style.position = 'absolute';
      this.hudElement.style.top = '16px';
      this.hudElement.style.left = '16px';
      this.hudElement.style.zIndex = '999999';
      this.hudElement.style.background = 'rgba(11, 15, 25, 0.88)';
      this.hudElement.style.border = '1px solid rgba(59, 130, 246, 0.4)';
      this.hudElement.style.borderRadius = '10px';
      this.hudElement.style.padding = '10px 14px';
      this.hudElement.style.color = '#f8fafc';
      this.hudElement.style.fontFamily = 'monospace';
      this.hudElement.style.fontSize = '11.5px';
      this.hudElement.style.lineHeight = '1.5';
      this.hudElement.style.backdropFilter = 'blur(10px)';
      this.hudElement.style.pointerEvents = 'none';
      this.hudElement.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.6)';
    }

    const container = this.activeVideo.parentElement || document.body;
    if (this.hudElement.parentElement !== container) {
      container.appendChild(this.hudElement);
    }
    this.updateHudVisibility();
  }

  private updateHudVisibility(): void {
    if (this.hudElement) {
      this.hudElement.style.display = this.config.showDebugHud ? 'block' : 'none';
    }
  }

  private updateHudMetrics(m: EnhancementMetrics): void {
    if (!this.hudElement || !this.config.showDebugHud) return;

    const sourceLabel = `${m.sourceResolution.width}×${m.sourceResolution.height}`;
    const outputLabel = `${m.outputResolution.width}×${m.outputResolution.height}`;
    const modeLabel = this.config.bypassEnhancement ? 'BYPASS (ORIGINAL)' : m.effectiveMode;
    const smoothingText = m.motionSmoothingActive ? `60 FPS (ACTIVE)` : `${m.outputFps} FPS`;

    this.hudElement.innerHTML = `
      <div style="font-weight:bold; color:#60a5fa; margin-bottom:4px; font-size:12px;">⚡ VIDEO ENHANCEMENT ENGINE</div>
      <div><strong>SOURCE:</strong> ${sourceLabel}</div>
      <div><strong>UPSCALE:</strong> ${m.scaleFactor.toFixed(1)}x</div>
      <div><strong>OUTPUT:</strong> ${outputLabel}</div>
      <div><strong>MODE:</strong> <span style="color:#34d399;">${modeLabel}</span> (${m.effectiveTier})</div>
      <div><strong>MOTION:</strong> ${smoothingText} (In: ${m.inputFps}fps)</div>
      <div><strong>GPU:</strong> ${m.gpuBackend} (${m.gpuProcessingTimeMs}ms)</div>
      <div><strong>SHARPNESS:</strong> ${m.sharpness}% | <strong>DENOISE:</strong> ${m.denoise}</div>
      <div><strong>HDR:</strong> SOURCE: ${m.hdrSource ? 'YES' : 'NO'} | VISUAL: ${m.hdrVisualEnhancement ? 'ON' : 'OFF'}</div>
      <div style="font-size:10px; color:#94a3b8; margin-top:4px;">Alt+Shift+E: A/B Toggle | Alt+Shift+S: Split</div>
    `;
  }

  private removePresentationCanvas(): void {
    if (this.presentationCanvas && this.presentationCanvas.parentElement) {
      this.presentationCanvas.parentElement.removeChild(this.presentationCanvas);
    }
    if (this.gpuProcessor) {
      this.gpuProcessor.destroy();
      this.gpuProcessor = null;
    }
  }

  private removeHud(): void {
    if (this.hudElement && this.hudElement.parentElement) {
      this.hudElement.parentElement.removeChild(this.hudElement);
      this.hudElement = null;
    }
  }

  public destroy(): void {
    this.stopRenderLoop();
    this.removePresentationCanvas();
    this.removeHud();
    this.tracker.destroy();
  }
}
