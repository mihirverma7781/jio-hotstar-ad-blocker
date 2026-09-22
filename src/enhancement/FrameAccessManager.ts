/**
 * FrameAccessManager
 * Evaluates the environment and active HTMLVideoElement to determine the strongest
 * available GPU frame-ingestion mechanism without violating browser security or DRM.
 */

import { FrameAccessCapability, FrameAccessReport } from './types';

export class FrameAccessManager {
  private lastReport: FrameAccessReport | null = null;
  private testCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  private testCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;

  constructor() {
    this.initTestCanvas();
  }

  private initTestCanvas(): void {
    if (typeof OffscreenCanvas !== 'undefined') {
      try {
        this.testCanvas = new OffscreenCanvas(16, 16);
        this.testCtx = this.testCanvas.getContext('2d', { willReadFrequently: true });
        return;
      } catch {
        // Fallback to DOM canvas
      }
    }

    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      this.testCanvas = c;
      this.testCtx = c.getContext('2d', { willReadFrequently: true });
    }
  }

  /**
   * Probes active video element to determine frame readability and GPU capability.
   */
  public probeVideoFrameAccess(video: HTMLVideoElement | null): FrameAccessReport {
    if (!video) {
      const report: FrameAccessReport = {
        capability: 'NONE',
        isTainted: false,
        supportsWebGPUTexture: false,
        supportsVideoFrame: false,
        supportsCanvasDraw: false,
        diagnosticReason: 'NO_ACTIVE_VIDEO_ELEMENT',
        recommendedFallback: 'NONE'
      };
      this.lastReport = report;
      return report;
    }

    const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
    const hasRequestVideoFrameCallback = typeof HTMLVideoElement !== 'undefined' && 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
    const hasVideoFrame = typeof (window as any) !== 'undefined' && typeof (window as any).VideoFrame !== 'undefined';

    // Step 1: Probe whether video pixels can be read without cross-origin or DRM security exceptions
    let isTainted = false;
    let canvasDrawable = false;
    let diagnosticReason = 'DIRECT_FRAME_ACCESS_AVAILABLE';

    if (video.readyState >= 2 && video.videoWidth > 0 && this.testCtx) {
      try {
        this.testCtx.drawImage(video, 0, 0, 16, 16);
        // Attempt a 1-pixel read to verify canvas is not tainted by DRM or cross-origin restrictions
        this.testCtx.getImageData(0, 0, 1, 1);
        canvasDrawable = true;
      } catch (err: any) {
        isTainted = true;
        canvasDrawable = false;
        if (err.name === 'SecurityError' || (err.message && err.message.includes('tainted'))) {
          diagnosticReason = 'DRM_PROTECTED_MEDIA_SURFACE_RESTRICTED';
        } else {
          diagnosticReason = `FRAME_READ_ERROR: ${err.message || 'UNKNOWN'}`;
        }
      }
    } else {
      // Video not ready yet
      canvasDrawable = video.readyState >= 1;
    }

    // If DRM or browser security prevents raw frame access, fall back gracefully to compositor enhancement
    if (isTainted) {
      const report: FrameAccessReport = {
        capability: 'COMPOSITOR_ENHANCEMENT',
        isTainted: true,
        supportsWebGPUTexture: false,
        supportsVideoFrame: false,
        supportsCanvasDraw: false,
        diagnosticReason,
        recommendedFallback: 'COMPOSITOR_ENHANCEMENT'
      };
      this.lastReport = report;
      return report;
    }

    // Step 2: Determine strongest available GPU mechanism
    let capability: FrameAccessCapability = 'CANVAS';

    if (hasWebGPU && canvasDrawable) {
      capability = 'DIRECT_GPU_TEXTURE';
      diagnosticReason = 'WEBGPU_DIRECT_TEXTURE_INGESTION';
    } else if (hasRequestVideoFrameCallback && hasVideoFrame && canvasDrawable) {
      capability = 'VIDEO_FRAME';
      diagnosticReason = 'WEBCODECS_VIDEO_FRAME_CALLBACK';
    } else if (canvasDrawable) {
      capability = 'CANVAS';
      diagnosticReason = 'WEBGL2_CANVAS_FRAME_CAPTURE';
    } else {
      capability = 'COMPOSITOR_ENHANCEMENT';
      diagnosticReason = 'VIDEO_PIXELS_INACCESSIBLE';
    }

    const report: FrameAccessReport = {
      capability,
      isTainted: false,
      supportsWebGPUTexture: hasWebGPU,
      supportsVideoFrame: hasRequestVideoFrameCallback && hasVideoFrame,
      supportsCanvasDraw: canvasDrawable,
      diagnosticReason,
      recommendedFallback: capability === 'COMPOSITOR_ENHANCEMENT' ? 'COMPOSITOR_ENHANCEMENT' : 'NONE'
    };

    this.lastReport = report;
    return report;
  }

  public getLastReport(): FrameAccessReport | null {
    return this.lastReport;
  }
}
