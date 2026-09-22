import { describe, it, expect, vi } from 'vitest';
import { EnhancementPipeline } from '../../src/enhancement/EnhancementPipeline';
import { FrameAccessManager } from '../../src/enhancement/FrameAccessManager';
import { VideoUpscalerEngine } from '../../src/enhancement/VideoUpscalerEngine';
import { FrameRateInterpolator } from '../../src/enhancement/FrameRateInterpolator';
import { HDRVisualEnhancer } from '../../src/enhancement/HDRVisualEnhancer';
import { EnhancementPerformanceController } from '../../src/enhancement/EnhancementPerformanceController';
import { EnhancementConfig } from '../../src/enhancement/types';

describe('EnhancementPipeline Integration', () => {
  const defaultConfig: EnhancementConfig = {
    enabled: true,
    upscalerMode: 'NEURAL',
    scale: 2,
    qualityTier: 'HIGH',
    sharpness: 35,
    denoise: 'LOW',
    deblock: 'LOW',
    contrast: 104,
    saturation: 104,
    hdrVisualEnhancement: true,
    hdrIntensity: 'SUBTLE',
    motionSmoothing: 'SMOOTH_60',
    preset: 'CINEMA',
    gpuBackend: 'WEBGL2',
    bypassEnhancement: false,
    sideBySideComparison: false,
    compareSplitPosition: 0.5,
    showDebugHud: false,
    tiledProcessing: false,
    tileSize: 256
  };

  it('runs complete pipeline processing pass for 1080p source', () => {
    const frameAccessManager = new FrameAccessManager();
    const upscalerEngine = new VideoUpscalerEngine();
    const interpolator = new FrameRateInterpolator('SMOOTH_60');
    const hdrEnhancer = new HDRVisualEnhancer();
    const performanceController = new EnhancementPerformanceController('HIGH');

    // Mock GPU video processor
    const mockGpuProcessor = {
      processFrame: vi.fn().mockReturnValue({
        rendered: true,
        gpuTimeMs: 2.4,
        modeUsed: 'NEURAL'
      }),
      getBackend: () => 'WebGL2' as const
    } as any;

    const pipeline = new EnhancementPipeline(
      frameAccessManager,
      upscalerEngine,
      interpolator,
      hdrEnhancer,
      performanceController,
      mockGpuProcessor
    );

    // Mock video element
    const mockVideo = {
      videoWidth: 1920,
      videoHeight: 1080,
      readyState: 4
    } as HTMLVideoElement;

    // Spy probeVideoFrameAccess to return direct access
    vi.spyOn(frameAccessManager, 'probeVideoFrameAccess').mockReturnValue({
      capability: 'DIRECT_GPU_TEXTURE',
      isTainted: false,
      supportsWebGPUTexture: true,
      supportsVideoFrame: true,
      supportsCanvasDraw: true,
      diagnosticReason: 'Probed direct WebGL/WebGPU texture binding',
      recommendedFallback: 'NONE'
    });

    const now = 1000;
    const { rendered, metrics } = pipeline.processFrame(mockVideo, defaultConfig, now);

    expect(rendered).toBe(true);
    expect(metrics.sourceResolution).toEqual({ width: 1920, height: 1080 });
    expect(metrics.outputResolution).toEqual({ width: 3840, height: 2160 });
    expect(metrics.scaleFactor).toBe(2.0);
    expect(metrics.targetFps).toBe(60);
    expect(metrics.effectiveMode).toBe('NEURAL');
    expect(metrics.gpuBackend).toBe('WebGL2');
    expect(metrics.psnrEstimateDb).toBeGreaterThan(35);
  });

  it('gracefully falls back to COMPOSITOR_ENHANCEMENT when DRM prevents direct GPU texture access', () => {
    const frameAccessManager = new FrameAccessManager();
    const upscalerEngine = new VideoUpscalerEngine();
    const interpolator = new FrameRateInterpolator('OFF');
    const hdrEnhancer = new HDRVisualEnhancer();
    const performanceController = new EnhancementPerformanceController('BALANCED');

    const pipeline = new EnhancementPipeline(
      frameAccessManager,
      upscalerEngine,
      interpolator,
      hdrEnhancer,
      performanceController,
      null
    );

    const mockVideo = {
      videoWidth: 1920,
      videoHeight: 1080,
      readyState: 4
    } as HTMLVideoElement;

    // Simulate DRM restricted access
    vi.spyOn(frameAccessManager, 'probeVideoFrameAccess').mockReturnValue({
      capability: 'COMPOSITOR_ENHANCEMENT',
      isTainted: true,
      supportsWebGPUTexture: false,
      supportsVideoFrame: false,
      supportsCanvasDraw: false,
      diagnosticReason: 'Hardware DRM/EME active',
      recommendedFallback: 'COMPOSITOR_ENHANCEMENT'
    });

    const { rendered, metrics } = pipeline.processFrame(mockVideo, {
      ...defaultConfig,
      motionSmoothing: 'OFF'
    }, 2000);

    expect(rendered).toBe(true);
    expect(metrics.gpuBackend).toBe('Compositor');
    expect(metrics.frameAccessCapability).toBe('COMPOSITOR_ENHANCEMENT');
    expect(metrics.effectiveMode).toBe('ENHANCED');
  });

  it('does not re-render if motion interpolator decides frame interval has not elapsed', () => {
    const frameAccessManager = new FrameAccessManager();
    const upscalerEngine = new VideoUpscalerEngine();
    const interpolator = new FrameRateInterpolator('SMOOTH_60');
    const hdrEnhancer = new HDRVisualEnhancer();
    const performanceController = new EnhancementPerformanceController('HIGH');

    const pipeline = new EnhancementPipeline(
      frameAccessManager,
      upscalerEngine,
      interpolator,
      hdrEnhancer,
      performanceController,
      null
    );

    const mockVideo = {
      videoWidth: 1920,
      videoHeight: 1080,
      readyState: 4
    } as HTMLVideoElement;

    // First frame at t=1000
    pipeline.processFrame(mockVideo, defaultConfig, 1000);

    // Immediate second frame at t=1002 (only 2ms later, 60fps requires ~16.6ms)
    const result2 = pipeline.processFrame(mockVideo, defaultConfig, 1002);
    expect(result2.rendered).toBe(false);
  });
});
