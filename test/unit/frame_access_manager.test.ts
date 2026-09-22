import { describe, it, expect } from 'vitest';
import { FrameAccessManager } from '../../src/enhancement/FrameAccessManager';

describe('FrameAccessManager', () => {
  it('identifies null or unready video and returns NONE capability', () => {
    const manager = new FrameAccessManager();
    const reportNull = manager.probeVideoFrameAccess(null);
    expect(reportNull.capability).toBe('NONE');
    expect(reportNull.diagnosticReason).toBe('NO_ACTIVE_VIDEO_ELEMENT');

    const mockUnready = {
      readyState: 0,
      videoWidth: 0,
      videoHeight: 0
    } as unknown as HTMLVideoElement;

    const reportUnready = manager.probeVideoFrameAccess(mockUnready);
    expect(reportUnready.capability).toBe('COMPOSITOR_ENHANCEMENT');
    expect(reportUnready.diagnosticReason).toBe('VIDEO_PIXELS_INACCESSIBLE');
  });

  it('safely catches DRM SecurityError and falls back to COMPOSITOR_ENHANCEMENT without throwing', () => {
    const manager = new FrameAccessManager();

    // Inject a test canvas context that throws SecurityError on read (simulating DRM protected EME surface)
    (manager as any).testCtx = {
      drawImage: () => {},
      getImageData: () => {
        const err = new Error('Tainted canvas: The element cannot be drawn due to DRM protection');
        err.name = 'SecurityError';
        throw err;
      }
    };

    const mockVideo = {
      readyState: 4,
      videoWidth: 1920,
      videoHeight: 1080
    } as unknown as HTMLVideoElement;

    const report = manager.probeVideoFrameAccess(mockVideo);
    expect(report.capability).toBe('COMPOSITOR_ENHANCEMENT');
    expect(report.isTainted).toBe(true);
    expect(report.diagnosticReason).toBe('DRM_PROTECTED_MEDIA_SURFACE_RESTRICTED');
    expect(report.recommendedFallback).toBe('COMPOSITOR_ENHANCEMENT');
  });

  it('detects successful frame access when canvas drawImage and read succeed', () => {
    const manager = new FrameAccessManager();

    // Inject a working canvas context
    (manager as any).testCtx = {
      drawImage: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(4) })
    };

    const mockVideo = {
      readyState: 4,
      videoWidth: 1920,
      videoHeight: 1080
    } as unknown as HTMLVideoElement;

    const report = manager.probeVideoFrameAccess(mockVideo);
    expect(report.isTainted).toBe(false);
    expect(report.supportsCanvasDraw).toBe(true);
    expect(report.capability).toBe('CANVAS');
  });
});
