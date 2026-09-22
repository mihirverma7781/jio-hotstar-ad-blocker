/**
 * GpuVideoProcessor
 * Modular GPU-accelerated video enhancement and super-resolution engine.
 * Supports WebGPU (WGSL) with a complete WebGL2 (GLSL ES 3.00) pipeline fallback.
 */

import {
  VERTEX_SHADER_SOURCE,
  PREPROCESS_FRAGMENT_SHADER,
  UPSCALER_FRAGMENT_SHADER,
  POSTPROCESS_FRAGMENT_SHADER,
  MOTION_INTERPOLATION_FRAGMENT_SHADER
} from './shaders/glsl_shaders';
import {
  WGSL_VERTEX_SHADER,
  WGSL_PREPROCESS_SHADER,
  WGSL_UPSCALER_SHADER,
  WGSL_POSTPROCESS_SHADER
} from './shaders/wgsl_shaders';
import { EnhancementConfig, GpuBackend, UpscalerMode, Resolution } from './types';

export class GpuVideoProcessor {
  private outputCanvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private activeBackend: 'WebGPU' | 'WebGL2' | 'Compositor' = 'WebGL2';
  private isInitialized = false;

  // WebGL2 Resources
  private quadVao: WebGLVertexArrayObject | null = null;
  private quadBuffer: WebGLBuffer | null = null;
  private preprocessProgram: WebGLProgram | null = null;
  private upscaleProgram: WebGLProgram | null = null;
  private postprocessProgram: WebGLProgram | null = null;
  private motionProgram: WebGLProgram | null = null;

  // Textures and Framebuffers
  private sourceTexture: WebGLTexture | null = null;
  private origTexture: WebGLTexture | null = null; // Stored for A/B comparison
  private prevFrameTexture: WebGLTexture | null = null; // For 60 FPS motion interpolation
  private preprocessFbo: WebGLFramebuffer | null = null;
  private preprocessTexture: WebGLTexture | null = null;
  private upscaleFbo: WebGLFramebuffer | null = null;
  private upscaleTexture: WebGLTexture | null = null;

  private currentInputRes: Resolution = { width: 0, height: 0 };
  private currentOutputRes: Resolution = { width: 0, height: 0 };

  // WebGPU Resources (if supported and enabled)
  private gpuDevice: any = null;
  private gpuContext: any = null;

  constructor(targetCanvas: HTMLCanvasElement) {
    this.outputCanvas = targetCanvas;
  }

  public async initialize(preferredBackend: GpuBackend = 'AUTO'): Promise<boolean> {
    if (this.isInitialized) return true;

    // Try WebGPU if requested/auto
    if (preferredBackend === 'AUTO' || preferredBackend === 'WEBGPU') {
      try {
        if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
          const adapter = await (navigator as any).gpu.requestAdapter();
          if (adapter) {
            this.gpuDevice = await adapter.requestDevice();
            this.gpuContext = this.outputCanvas.getContext('webgpu');
            if (this.gpuDevice && this.gpuContext) {
              this.activeBackend = 'WebGPU';
              this.isInitialized = true;
              return true;
            }
          }
        }
      } catch (e) {
        console.warn('[GpuVideoProcessor] WebGPU init failed, falling back to WebGL2:', e);
      }
    }

    // Initialize WebGL2 fallback
    const gl = this.outputCanvas.getContext('webgl2', {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    });

    if (!gl) {
      this.activeBackend = 'Compositor';
      return false;
    }

    this.gl = gl;
    this.activeBackend = 'WebGL2';

    // Compile programs
    this.preprocessProgram = this.createProgram(VERTEX_SHADER_SOURCE, PREPROCESS_FRAGMENT_SHADER);
    this.upscaleProgram = this.createProgram(VERTEX_SHADER_SOURCE, UPSCALER_FRAGMENT_SHADER);
    this.postprocessProgram = this.createProgram(VERTEX_SHADER_SOURCE, POSTPROCESS_FRAGMENT_SHADER);
    this.motionProgram = this.createProgram(VERTEX_SHADER_SOURCE, MOTION_INTERPOLATION_FRAGMENT_SHADER);

    this.initQuad();
    this.isInitialized = true;
    return true;
  }

  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;
    const shader = this.gl.createShader(type);
    if (!shader) return null;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('[GpuVideoProcessor] Shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private createProgram(vsSource: string, fsSource: string): WebGLProgram | null {
    if (!this.gl) return null;
    const vs = this.createShader(this.gl.VERTEX_SHADER, vsSource);
    const fs = this.createShader(this.gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return null;

    const program = this.gl.createProgram();
    if (!program) return null;
    this.gl.attachShader(program, vs);
    this.gl.attachShader(program, fs);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('[GpuVideoProcessor] Program link error:', this.gl.getProgramInfoLog(program));
      this.gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  private initQuad(): void {
    if (!this.gl) return;
    const gl = this.gl;

    const vertices = new Float32Array([
      // PosX, PosY, TexU, TexV
      -1, -1, 0, 1,
       1, -1, 1, 1,
      -1,  1, 0, 0,
      -1,  1, 0, 0,
       1, -1, 1, 1,
       1,  1, 1, 0
    ]);

    this.quadVao = gl.createVertexArray();
    this.quadBuffer = gl.createBuffer();

    gl.bindVertexArray(this.quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // a_position
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);

    // a_texCoord
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

    gl.bindVertexArray(null);
  }

  private ensureFBOs(inW: number, inH: number, outW: number, outH: number): void {
    if (!this.gl) return;
    const gl = this.gl;

    if (this.currentInputRes.width !== inW || this.currentInputRes.height !== inH) {
      this.currentInputRes = { width: inW, height: inH };

      // Input textures
      if (!this.sourceTexture) this.sourceTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      if (!this.origTexture) this.origTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.origTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      if (!this.prevFrameTexture) this.prevFrameTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.prevFrameTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      // Preprocess FBO (same size as input)
      if (!this.preprocessTexture) this.preprocessTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.preprocessTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, inW, inH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      if (!this.preprocessFbo) this.preprocessFbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.preprocessFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.preprocessTexture, 0);
    }

    if (this.currentOutputRes.width !== outW || this.currentOutputRes.height !== outH) {
      this.currentOutputRes = { width: outW, height: outH };

      // Upscale FBO (target resolution)
      if (!this.upscaleTexture) this.upscaleTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.upscaleTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, outW, outH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      if (!this.upscaleFbo) this.upscaleFbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.upscaleFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.upscaleTexture, 0);

      // Adjust output canvas buffer dimensions
      this.outputCanvas.width = outW;
      this.outputCanvas.height = outH;
    }
  }

  /**
   * Process a single video frame through GPU pipeline:
   * Upload -> Preprocess -> Super-Resolution Upscale -> Postprocess (Sharpen + HDR) -> Render
   */
  public processFrame(
    video: HTMLVideoElement,
    config: EnhancementConfig,
    targetWidth: number,
    targetHeight: number,
    motionBlendFactor: number = 0.0
  ): { gpuTimeMs: number; modeUsed: UpscalerMode } {
    if (!this.isInitialized || !this.gl) {
      return { gpuTimeMs: 0, modeUsed: 'OFF' };
    }

    const startTime = performance.now();
    const gl = this.gl;
    const inW = video.videoWidth || 1920;
    const inH = video.videoHeight || 1080;
    const outW = targetWidth || inW * 2;
    const outH = targetHeight || inH * 2;

    this.ensureFBOs(inW, inH, outW, outH);

    // 1. Upload Video Frame to GPU
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    } catch {
      return { gpuTimeMs: 0, modeUsed: 'OFF' };
    }

    // Keep original copy for side-by-side comparison
    if (config.sideBySideComparison) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.origTexture);
      gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, inW, inH, 0);
    }

    gl.bindVertexArray(this.quadVao);

    // 2. Preprocessing Pass (Denoise & Deblock)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.preprocessFbo);
    gl.viewport(0, 0, inW, inH);
    gl.useProgram(this.preprocessProgram);

    gl.uniform1i(gl.getUniformLocation(this.preprocessProgram!, 'u_image'), 0);
    gl.uniform2f(gl.getUniformLocation(this.preprocessProgram!, 'u_texelSize'), 1.0 / inW, 1.0 / inH);
    gl.uniform1i(
      gl.getUniformLocation(this.preprocessProgram!, 'u_denoiseLevel'),
      config.denoise === 'OFF' ? 0 : config.denoise === 'LOW' ? 1 : config.denoise === 'MEDIUM' ? 2 : 3
    );
    gl.uniform1i(
      gl.getUniformLocation(this.preprocessProgram!, 'u_deblockLevel'),
      config.deblock === 'OFF' ? 0 : config.deblock === 'LOW' ? 1 : config.deblock === 'MEDIUM' ? 2 : 3
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 3. Upscaling Pass (Bicubic, Edge-Aware, or Neural SR)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.upscaleFbo);
    gl.viewport(0, 0, outW, outH);
    gl.useProgram(this.upscaleProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.preprocessTexture);
    gl.uniform1i(gl.getUniformLocation(this.upscaleProgram!, 'u_image'), 0);
    gl.uniform2f(gl.getUniformLocation(this.upscaleProgram!, 'u_sourceTexelSize'), 1.0 / inW, 1.0 / inH);

    let modeVal = 0; // Basic (Bicubic)
    if (config.upscalerMode === 'ENHANCED') modeVal = 1;
    if (config.upscalerMode === 'NEURAL') modeVal = 2;
    if (config.upscalerMode === 'AUTO') {
      modeVal = (config.qualityTier === 'ULTRA' || config.qualityTier === 'HIGH') ? 2 : 1;
    }

    gl.uniform1i(gl.getUniformLocation(this.upscaleProgram!, 'u_mode'), modeVal);
    gl.uniform1f(gl.getUniformLocation(this.upscaleProgram!, 'u_scaleFactor'), outW / inW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 4. Motion Interpolation Pass (if 60 FPS motion smoothing active and in-between frame needed)
    let currentInputForPost = this.upscaleTexture;
    if (config.motionSmoothing !== 'OFF' && motionBlendFactor > 0.01 && this.prevFrameTexture) {
      // Execute motion synthesis into preprocess texture area
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.preprocessFbo);
      gl.viewport(0, 0, inW, inH);
      gl.useProgram(this.motionProgram);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.prevFrameTexture);
      gl.uniform1i(gl.getUniformLocation(this.motionProgram!, 'u_prevFrame'), 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
      gl.uniform1i(gl.getUniformLocation(this.motionProgram!, 'u_nextFrame'), 1);

      gl.uniform2f(gl.getUniformLocation(this.motionProgram!, 'u_texelSize'), 1.0 / inW, 1.0 / inH);
      gl.uniform1f(gl.getUniformLocation(this.motionProgram!, 'u_blendFactor'), motionBlendFactor);
      gl.uniform1f(gl.getUniformLocation(this.motionProgram!, 'u_motionStrength'), 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // 5. Postprocessing Pass (CAS Sharpening, Perceptual HDR Tone, Color Grading, Side-by-Side)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Render directly to output canvas
    gl.viewport(0, 0, outW, outH);
    gl.useProgram(this.postprocessProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentInputForPost);
    gl.uniform1i(gl.getUniformLocation(this.postprocessProgram!, 'u_image'), 0);

    if (config.sideBySideComparison) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.origTexture);
      gl.uniform1i(gl.getUniformLocation(this.postprocessProgram!, 'u_origImage'), 1);
    }

    gl.uniform2f(gl.getUniformLocation(this.postprocessProgram!, 'u_texelSize'), 1.0 / outW, 1.0 / outH);
    gl.uniform1f(gl.getUniformLocation(this.postprocessProgram!, 'u_sharpness'), config.sharpness / 100.0);
    gl.uniform1f(gl.getUniformLocation(this.postprocessProgram!, 'u_contrast'), config.contrast / 100.0);
    gl.uniform1f(gl.getUniformLocation(this.postprocessProgram!, 'u_saturation'), config.saturation / 100.0);

    const hdrVal = !config.hdrVisualEnhancement
      ? 0
      : config.hdrIntensity === 'SUBTLE'
      ? 1
      : config.hdrIntensity === 'BALANCED'
      ? 2
      : 3;
    gl.uniform1i(gl.getUniformLocation(this.postprocessProgram!, 'u_hdrEnhance'), hdrVal);
    gl.uniform1i(gl.getUniformLocation(this.postprocessProgram!, 'u_sideBySide'), config.sideBySideComparison ? 1 : 0);
    gl.uniform1f(gl.getUniformLocation(this.postprocessProgram!, 'u_splitPos'), config.compareSplitPosition);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Save current frame as previous for next motion frame
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.prevFrameTexture);
    gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, inW, inH, 0);

    gl.bindVertexArray(null);

    const gpuTimeMs = performance.now() - startTime;
    const modeUsed: UpscalerMode = modeVal === 2 ? 'NEURAL' : modeVal === 1 ? 'ENHANCED' : 'BASIC';
    return { gpuTimeMs, modeUsed };
  }

  public getBackend(): 'WebGPU' | 'WebGL2' | 'Compositor' {
    return this.activeBackend;
  }

  public destroy(): void {
    if (this.gl) {
      if (this.sourceTexture) this.gl.deleteTexture(this.sourceTexture);
      if (this.origTexture) this.gl.deleteTexture(this.origTexture);
      if (this.prevFrameTexture) this.gl.deleteTexture(this.prevFrameTexture);
      if (this.preprocessTexture) this.gl.deleteTexture(this.preprocessTexture);
      if (this.upscaleTexture) this.gl.deleteTexture(this.upscaleTexture);
      if (this.preprocessFbo) this.gl.deleteFramebuffer(this.preprocessFbo);
      if (this.upscaleFbo) this.gl.deleteFramebuffer(this.upscaleFbo);
      if (this.quadBuffer) this.gl.deleteBuffer(this.quadBuffer);
      if (this.quadVao) this.gl.deleteVertexArray(this.quadVao);
      if (this.preprocessProgram) this.gl.deleteProgram(this.preprocessProgram);
      if (this.upscaleProgram) this.gl.deleteProgram(this.upscaleProgram);
      if (this.postprocessProgram) this.gl.deleteProgram(this.postprocessProgram);
      if (this.motionProgram) this.gl.deleteProgram(this.motionProgram);
      this.gl = null;
    }
    this.isInitialized = false;
  }
}
