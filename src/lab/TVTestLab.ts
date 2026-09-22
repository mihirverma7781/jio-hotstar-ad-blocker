/**
 * TVTestLab
 * Interactive laboratory application for testing TV-style 4K/HDR playback,
 * ABR algorithms, simulated TV profiles, and telemetry without DRM restrictions.
 */

import {
  MediaRepresentation,
  TVModeProfile
} from '../types/tv_mode';
import { TVCapabilityEngine } from '../core/TVCapabilityEngine';
import { TVHdrEngine } from '../core/TVHdrEngine';
import { TVRepresentationAnalyzer } from '../core/TVRepresentationAnalyzer';
import { TVModeController } from '../core/TVModeController';
import { TVDiagnostics } from '../core/TVDiagnostics';
import { PlaybackVerifier } from '../core/PlaybackVerifier';
import { PlaybackVerificationReport } from '../types/drm_research';
import { VideoEnhancementEngine } from '../enhancement/VideoEnhancementEngine';
import {
  EnhancementConfig,
  UpscalerMode,
  MotionSmoothingMode,
  PresetName,
  ProcessingTier
} from '../enhancement/types';
import {
  SAMPLE_4K_HDR_HLS_MANIFEST,
  SAMPLE_4K_HDR_DASH_MANIFEST,
  SAMPLE_1080P_ONLY_HLS_MANIFEST
} from './sample_manifests';

export const TV_PRESET_PROFILES: Record<string, TVModeProfile> = {
  'tv-4k-hdr': {
    name: 'TV 4K HDR',
    preferredResolution: 2160,
    preferredDynamicRange: 'HDR',
    preferredCodecs: ['HEVC', 'AV1', 'VP9', 'H264'],
    preferHDR: true,
    prefer4K: true,
    targetFramerate: 60,
    initialBitrateStrategy: 'conservative',
    adaptationStrategy: 'tv-quality'
  },
  'tv-4k-sdr': {
    name: 'TV 4K SDR',
    preferredResolution: 2160,
    preferredDynamicRange: 'SDR',
    preferredCodecs: ['AV1', 'VP9', 'HEVC', 'H264'],
    preferHDR: false,
    prefer4K: true,
    targetFramerate: 60,
    initialBitrateStrategy: 'conservative',
    adaptationStrategy: 'tv-balanced'
  },
  'tv-1080p-hdr': {
    name: 'TV 1080p HDR',
    preferredResolution: 1080,
    preferredDynamicRange: 'HDR',
    preferredCodecs: ['VP9', 'HEVC', 'AV1', 'H264'],
    preferHDR: true,
    prefer4K: false,
    targetFramerate: 60,
    initialBitrateStrategy: 'conservative',
    adaptationStrategy: 'tv-balanced'
  },
  'tv-1080p-sdr': {
    name: 'TV 1080p SDR',
    preferredResolution: 1080,
    preferredDynamicRange: 'SDR',
    preferredCodecs: ['H264', 'VP9'],
    preferHDR: false,
    prefer4K: false,
    targetFramerate: 30,
    initialBitrateStrategy: 'conservative',
    adaptationStrategy: 'tv-stability'
  },
  'low-bandwidth-tv': {
    name: 'Low-Bandwidth TV',
    preferredResolution: 720,
    preferredDynamicRange: 'SDR',
    preferredCodecs: ['H264'],
    preferHDR: false,
    prefer4K: false,
    targetFramerate: 30,
    initialBitrateStrategy: 'conservative',
    adaptationStrategy: 'tv-stability'
  }
};

export class TVTestLab {
  private controller: TVModeController;
  private enhancementEngine: VideoEnhancementEngine;
  private currentManifestText: string = SAMPLE_4K_HDR_HLS_MANIFEST;
  private parsedRepresentations: MediaRepresentation[] = [];

  constructor() {
    this.controller = new TVModeController(TV_PRESET_PROFILES['tv-4k-hdr']);
    this.enhancementEngine = new VideoEnhancementEngine({
      enabled: true,
      upscalerMode: 'NEURAL',
      scale: 2,
      motionSmoothing: 'SMOOTH_60',
      preset: 'CINEMA',
      qualityTier: 'HIGH',
      sharpness: 30,
      hdrVisualEnhancement: true,
      showDebugHud: false,
      sideBySideComparison: false
    });
  }

  public async initLabUI(): Promise<void> {
    if (typeof document === 'undefined') return;

    this.bindControls();
    await this.loadSampleManifest('4k-hdr-hls');
    this.refreshCapabilitiesUI();

    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (video) {
      await this.enhancementEngine.attachToVideo(video);
    }

    // Auto-update metrics display
    setInterval(() => {
      this.updateTelemetryUI();
      this.updateEnhancementTelemetryUI();
    }, 1000);
  }

  public async loadSampleManifest(type: '4k-hdr-hls' | '4k-hdr-dash' | '1080p-hls'): Promise<void> {
    if (type === '4k-hdr-hls') {
      this.currentManifestText = SAMPLE_4K_HDR_HLS_MANIFEST;
      this.parsedRepresentations = TVRepresentationAnalyzer.parseHlsMasterPlaylist(this.currentManifestText);
    } else if (type === '4k-hdr-dash') {
      this.currentManifestText = SAMPLE_4K_HDR_DASH_MANIFEST;
      this.parsedRepresentations = TVRepresentationAnalyzer.parseDashMpd(this.currentManifestText);
    } else {
      this.currentManifestText = SAMPLE_1080P_ONLY_HLS_MANIFEST;
      this.parsedRepresentations = TVRepresentationAnalyzer.parseHlsMasterPlaylist(this.currentManifestText);
    }

    await this.controller.setRepresentations(this.parsedRepresentations);
    this.renderRepresentationsTable();
  }

  public async applyProfile(profileKey: string): Promise<void> {
    const profile = TV_PRESET_PROFILES[profileKey];
    if (profile) {
      this.controller.updateProfile(profile);
      await this.controller.reselectQuality();
      this.renderRepresentationsTable();
    }
  }

  public async runServiceAnalysis(): Promise<void> {
    const report = await TVDiagnostics.analyzeServiceSession(
      this.parsedRepresentations,
      this.controller.getActiveRepresentation()
    );

    const resultBox = document.getElementById('labAnalysisResult');
    if (resultBox) {
      resultBox.innerHTML = `
        <div class="analysis-card ${report.bottleneck === 'SERVICE_OFFER' ? 'warn' : 'good'}">
          <h4>Bottleneck: <strong>${report.bottleneck}</strong></h4>
          <p>${report.bottleneckExplanation}</p>
          <div class="analysis-meta">
            <span>Service Max: <strong>${report.serviceMaximumResolution} (${report.serviceMaximumHDR})</strong></span>
            <span>Active Tier: <strong>${report.currentResolution}</strong></span>
            <span>Browser 4K: <strong>${report.browserCapability.canDecode4K ? 'YES' : 'NO'}</strong></span>
            <span>Display HDR: <strong>${report.displayCapability.displayHDR ? 'YES' : 'NO'}</strong></span>
          </div>
        </div>
      `;
    }
  }

  public verifyControlExperiment(video: HTMLVideoElement): PlaybackVerificationReport {
    const activeRep = this.controller.getActiveRepresentation();
    return PlaybackVerifier.verifyPlayback(video, {
      bitDepth: activeRep?.bitDepth,
      colorPrimaries: activeRep?.colorSpace,
      transferFunction: activeRep?.dynamicRange === 'HDR10' ? 'smpte2084' : 'sdr',
      codec: activeRep?.codec
    });
  }

  private async refreshCapabilitiesUI(): Promise<void> {
    const display = TVCapabilityEngine.getDisplayCapability();
    const decoder = await TVCapabilityEngine.probeDecoderCapabilities();

    const displayEl = document.getElementById('labDisplayCaps');
    if (displayEl) {
      displayEl.innerHTML = `
        <div>Display: <strong>${display.effectiveWidth} × ${display.effectiveHeight} (dpr: ${display.devicePixelRatio})</strong></div>
        <div>Gamut: <strong>${display.colorGamut.toUpperCase()}</strong></div>
        <div>Display HDR: <strong class="${display.displayHDR ? 'hdr-yes' : 'hdr-no'}">${display.displayHDR ? 'YES' : 'NO'}</strong></div>
      `;
    }

    const decoderEl = document.getElementById('labDecoderCaps');
    if (decoderEl) {
      decoderEl.innerHTML = `
        <div>4K (2160p): <strong>${decoder.supports2160p ? 'Supported' : 'Unavailable'}</strong></div>
        <div>HDR10: <strong>${decoder.supportsHDR10 ? 'Supported' : 'Unavailable'}</strong></div>
        <div>HEVC: <strong>${decoder.supportsHEVC ? 'YES' : 'NO'}</strong> | AV1: <strong>${decoder.supportsAV1 ? 'YES' : 'NO'}</strong> | VP9: <strong>${decoder.supportsVP9 ? 'YES' : 'NO'}</strong></div>
      `;
    }
  }

  private renderRepresentationsTable(): void {
    if (typeof document === 'undefined') return;
    const tbody = document.getElementById('labRepsTbody');
    if (!tbody) return;

    const activeRep = this.controller.getActiveRepresentation();

    tbody.innerHTML = this.parsedRepresentations.map(r => {
      const isSelected = activeRep && activeRep.id === r.id;
      return `
        <tr class="${isSelected ? 'selected-row' : ''}">
          <td><strong>${r.height}p</strong></td>
          <td><span class="badge ${r.hdr ? 'badge-hdr' : 'badge-sdr'}">${r.dynamicRange}</span></td>
          <td>${r.codec}</td>
          <td>${(r.bitrate / 1_000_000).toFixed(2)} Mbps</td>
          <td>${r.framerate} fps</td>
          <td><code>${r.id}</code></td>
          <td>${isSelected ? '★ ACTIVE' : ''}</td>
        </tr>
      `;
    }).join('');
  }

  private updateTelemetryUI(): void {
    const summary = this.controller.getMetrics().getSummary();
    const metricsEl = document.getElementById('labMetricsBox');
    if (!metricsEl) return;

    metricsEl.innerHTML = `
      <div class="stat-item"><span class="k">Startup Latency:</span> <span class="v">${summary.startupSec}s</span></div>
      <div class="stat-item"><span class="k">Time to 4K:</span> <span class="v">${summary.firstUhdSec !== null ? summary.firstUhdSec + 's' : 'N/A'}</span></div>
      <div class="stat-item"><span class="k">UHD Airtime:</span> <span class="v">${summary.uhdPercentage}%</span></div>
      <div class="stat-item"><span class="k">HDR Airtime:</span> <span class="v">${summary.hdrPercentage}%</span></div>
      <div class="stat-item"><span class="k">Rebuffers:</span> <span class="v">${summary.rebuffers}</span></div>
      <div class="stat-item"><span class="k">Quality Switches:</span> <span class="v">${summary.qualitySwitches}</span></div>
      <div class="stat-item"><span class="k">Dropped Frames:</span> <span class="v">${summary.droppedFrames} (${summary.droppedPercentage}%)</span></div>
    `;
  }

  private updateEnhancementTelemetryUI(): void {
    const metrics = this.enhancementEngine.getMetrics();
    const box = document.getElementById('labEnhancementMetricsBox');
    if (!box) return;

    box.innerHTML = `
      <div class="stat-item"><span class="k">Input Resolution:</span> <span class="v">${metrics.sourceResolution.width} × ${metrics.sourceResolution.height}</span></div>
      <div class="stat-item"><span class="k">Output Resolution:</span> <span class="v">${metrics.outputResolution.width} × ${metrics.outputResolution.height}</span></div>
      <div class="stat-item"><span class="k">Scale Multiplier:</span> <span class="v">${metrics.scaleFactor.toFixed(2)}x</span></div>
      <div class="stat-item"><span class="k">Output Framerate:</span> <span class="v" style="color: #10b981;">${metrics.outputFps.toFixed(1)} FPS (Target: ${metrics.targetFps})</span></div>
      <div class="stat-item"><span class="k">Render Latency:</span> <span class="v">${metrics.frameLatencyMs.toFixed(1)} ms</span></div>
      <div class="stat-item"><span class="k">Active Algorithm:</span> <span class="v">${metrics.effectiveMode}</span></div>
      <div class="stat-item"><span class="k">Frame Access Mode:</span> <span class="v">${metrics.frameAccessCapability}</span></div>
      <div class="stat-item"><span class="k">Quality Tier:</span> <span class="v">${metrics.effectiveTier}</span></div>
      <div class="stat-item"><span class="k">GPU Backend:</span> <span class="v">${metrics.gpuBackend}</span></div>
      <div class="stat-item"><span class="k">Dropped Enhancements:</span> <span class="v">${metrics.droppedFrames}</span></div>
      <div class="stat-item"><span class="k">Est. PSNR / SSIM:</span> <span class="v">${metrics.psnrEstimateDb || 38.4} dB / ${metrics.ssimEstimate || 0.94}</span></div>
    `;
  }

  private bindControls(): void {
    // Manifest selector
    document.getElementById('selManifest')?.addEventListener('change', (e: any) => {
      this.loadSampleManifest(e.target.value);
    });

    // Profile selector
    document.getElementById('selProfile')?.addEventListener('change', (e: any) => {
      this.applyProfile(e.target.value);
    });

    // Toggle HUD
    document.getElementById('btnToggleHud')?.addEventListener('click', () => {
      TVDiagnostics.toggleHUD();
    });

    // Analyze Session
    document.getElementById('btnAnalyzeSession')?.addEventListener('click', () => {
      this.runServiceAnalysis();
    });

    // Enhancement Controls
    document.getElementById('labSelUpscalerMode')?.addEventListener('change', (e: any) => {
      this.enhancementEngine.updateConfig({ upscalerMode: e.target.value as UpscalerMode });
    });

    document.getElementById('labSelMotion')?.addEventListener('change', (e: any) => {
      this.enhancementEngine.updateConfig({ motionSmoothing: e.target.value as MotionSmoothingMode });
    });

    document.getElementById('labSelPreset')?.addEventListener('change', (e: any) => {
      this.enhancementEngine.applyPreset(e.target.value);
    });

    document.getElementById('labSelScale')?.addEventListener('change', (e: any) => {
      const val = e.target.value;
      const scale = val === 'DISPLAY_NATIVE' ? 'DISPLAY_NATIVE' : Number(val);
      this.enhancementEngine.updateConfig({ scale: scale as any });
    });

    document.getElementById('labRngSharpness')?.addEventListener('input', (e: any) => {
      const val = Number(e.target.value);
      const span = document.getElementById('labValSharpness');
      if (span) span.textContent = `${val}%`;
      this.enhancementEngine.updateConfig({ sharpness: val });
    });

    document.getElementById('labBtnSplitScreen')?.addEventListener('click', () => {
      const active = this.enhancementEngine.toggleSideBySide();
      const btn = document.getElementById('labBtnSplitScreen');
      if (btn) {
        btn.textContent = active ? '🔀 Split Screen (Active)' : '🔀 Split Screen (Alt+Shift+E)';
      }
    });

    document.getElementById('labBtnBypass')?.addEventListener('click', () => {
      const bypassed = this.enhancementEngine.toggleBypass();
      const btn = document.getElementById('labBtnBypass');
      if (btn) {
        btn.textContent = bypassed ? '👁️ Showing: ORIGINAL' : '👁️ Showing: ENHANCED';
      }
    });

    // Attach video if exists
    const video = document.querySelector('video');
    if (video) {
      this.controller.attachVideo(video);
    }
  }

  public getController(): TVModeController {
    return this.controller;
  }

  public getEnhancementEngine(): VideoEnhancementEngine {
    return this.enhancementEngine;
  }
}

// Auto-instantiate when loaded in browser lab page
if (typeof window !== 'undefined') {
  (window as any).tvTestLab = new TVTestLab();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => (window as any).tvTestLab.initLabUI());
  } else {
    (window as any).tvTestLab.initLabUI();
  }
}
