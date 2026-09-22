/**
 * Real Video Enhancement + Super-Resolution Engine Types
 * Defines interfaces for GPU acceleration, upscaling, frame access,
 * 60 FPS motion interpolation, HDR processing, and performance tiers.
 */

export type UpscalerMode = 'OFF' | 'BASIC' | 'ENHANCED' | 'NEURAL' | 'AUTO';

export type ScaleFactor = 2 | 3 | 4 | 'DISPLAY_NATIVE' | 'AUTO';

export type ProcessingTier = 'PERFORMANCE' | 'BALANCED' | 'HIGH' | 'ULTRA';

export type FrameAccessCapability =
  | 'DIRECT_GPU_TEXTURE'
  | 'VIDEO_FRAME'
  | 'CANVAS'
  | 'COMPOSITOR_ENHANCEMENT'
  | 'NONE';

export type DenoiseMode = 'OFF' | 'LOW' | 'MEDIUM' | 'HIGH';

export type DeblockMode = 'OFF' | 'LOW' | 'MEDIUM' | 'HIGH';

export type MotionSmoothingMode = 'OFF' | 'CINEMATIC_48' | 'SMOOTH_60' | 'AUTO';

export type GpuBackend = 'AUTO' | 'WEBGPU' | 'WEBGL2';

export type PresetName =
  | 'NATURAL'
  | 'CINEMA'
  | 'CLEAN'
  | 'HDR_ENHANCE'
  | 'VIVID'
  | 'ANIME'
  | 'SPORTS'
  | 'CUSTOM';

export interface Resolution {
  width: number;
  height: number;
}

export interface EnhancementPreset {
  name: PresetName;
  displayName: string;
  description: string;
  upscalerMode: UpscalerMode;
  scale: ScaleFactor;
  qualityTier: ProcessingTier;
  sharpness: number; // 0 - 100
  denoise: DenoiseMode;
  deblock: DeblockMode;
  contrast: number;  // 80 - 140 (100 = neutral)
  saturation: number; // 80 - 140 (100 = neutral)
  hdrVisualEnhancement: boolean;
  hdrIntensity: 'SUBTLE' | 'BALANCED' | 'VIVID';
  motionSmoothing: MotionSmoothingMode;
}

export interface EnhancementConfig {
  enabled: boolean;
  upscalerMode: UpscalerMode;
  scale: ScaleFactor;
  qualityTier: ProcessingTier;
  sharpness: number; // 0 - 100
  denoise: DenoiseMode;
  deblock: DeblockMode;
  contrast: number;  // 80 - 140
  saturation: number; // 80 - 140
  hdrVisualEnhancement: boolean;
  hdrIntensity: 'SUBTLE' | 'BALANCED' | 'VIVID';
  motionSmoothing: MotionSmoothingMode; // 60 FPS feature
  gpuBackend: GpuBackend;
  preset: PresetName;
  sideBySideComparison: boolean;
  compareSplitPosition: number; // 0.0 - 1.0 (0.5 = 50/50 split)
  bypassEnhancement: boolean;   // Hotkey Alt+Shift+E toggles this
  showDebugHud: boolean;
  tiledProcessing: boolean;
  tileSize: number; // 256 or 512
}

export interface EnhancementMetrics {
  sourceResolution: Resolution;
  outputResolution: Resolution;
  scaleFactor: number;
  effectiveMode: UpscalerMode;
  effectiveTier: ProcessingTier;
  inputFps: number;
  outputFps: number;
  targetFps: number;
  motionSmoothingActive: boolean;
  gpuBackend: 'WebGPU' | 'WebGL2' | 'Compositor';
  gpuProcessingTimeMs: number;
  inferenceTimeMs: number;
  frameLatencyMs: number;
  droppedFrames: number;
  processingLoadPercent: number;
  frameAccessCapability: FrameAccessCapability;
  diagnosticReason: string;
  hdrSource: boolean;
  hdrVisualEnhancement: boolean;
  sharpness: number;
  denoise: DenoiseMode;
  deblock: DeblockMode;
  tileCount?: number;
  psnrEstimateDb?: number;
  ssimEstimate?: number;
}

export interface FrameAccessReport {
  capability: FrameAccessCapability;
  isTainted: boolean;
  supportsWebGPUTexture: boolean;
  supportsVideoFrame: boolean;
  supportsCanvasDraw: boolean;
  diagnosticReason: string;
  recommendedFallback: 'NONE' | 'COMPOSITOR_ENHANCEMENT';
}

export interface VideoDimensions {
  videoWidth: number;
  videoHeight: number;
  displayWidth: number;
  displayHeight: number;
  devicePixelRatio: number;
}
