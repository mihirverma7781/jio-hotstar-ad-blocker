/**
 * TVDiagnostics
 * Renders the collapsible TV Debug HUD overlay, keyboard shortcut handler (Alt+Shift+D),
 * and performs deep Service Analysis to diagnose 4K/HDR bottlenecks without falsification.
 */

import {
  BottleneckCategory,
  DisplayCapability,
  MediaRepresentation,
  ServiceAnalysisReport
} from '../types/tv_mode';
import { TVCapabilityEngine } from './TVCapabilityEngine';
import { TVHdrEngine } from './TVHdrEngine';

export interface TVHudData {
  resolution: string;
  quality: string;
  codec: string;
  bitrateMbps: number;
  framerate: number;
  dynamicRange: string;
  bufferSec: number;
  bandwidthMbps: number;
  droppedFrames: number;
  displayHDR: boolean;
  canDecode2160p: boolean;
  currentRepresentationId: string;
  reasonForSelection: string;
}

export class TVDiagnostics {
  private static hudElement: HTMLElement | null = null;
  private static isVisible: boolean = false;
  private static lastHudData: TVHudData | null = null;

  /**
   * Initializes or updates the on-screen TV Mode HUD
   */
  public static renderHUD(data: TVHudData, container?: HTMLElement): void {
    this.lastHudData = data;

    if (typeof document === 'undefined') return;

    const parent = container || document.fullscreenElement || document.body;
    if (!parent) return;

    if (!this.hudElement) {
      this.hudElement = document.createElement('div');
      this.hudElement.id = 'tv-mode-hud';
      this.hudElement.className = 'tv-hud-container';
      parent.appendChild(this.hudElement);
      this.attachKeyboardShortcut();
    } else if (this.hudElement.parentElement !== parent) {
      parent.appendChild(this.hudElement);
    }

    if (!this.isVisible) {
      this.hudElement.style.display = 'none';
      return;
    }

    this.hudElement.style.display = 'block';
    this.hudElement.innerHTML = `
      <div class="tv-hud-box">
        <div class="tv-hud-header">
          <div class="tv-hud-title">
            <span class="tv-hud-dot"></span>
            <strong>TV MODE — DIAGNOSTICS</strong>
          </div>
          <button type="button" class="tv-hud-close" id="btnTvHudClose" title="Hide HUD (Alt+Shift+D)">×</button>
        </div>
        <div class="tv-hud-divider">─────────────────────────</div>
        <div class="tv-hud-grid">
          <div class="tv-hud-row"><span class="k">Resolution:</span><span class="v val-highlight">${data.resolution}</span></div>
          <div class="tv-hud-row"><span class="k">Quality:</span><span class="v val-accent">${data.quality}</span></div>
          <div class="tv-hud-row"><span class="k">Codec:</span><span class="v">${data.codec}</span></div>
          <div class="tv-hud-row"><span class="k">Bitrate:</span><span class="v">${data.bitrateMbps.toFixed(2)} Mbps</span></div>
          <div class="tv-hud-row"><span class="k">Framerate:</span><span class="v">${data.framerate.toFixed(2)} FPS</span></div>
          <div class="tv-hud-row"><span class="k">Dynamic Range:</span><span class="v ${data.dynamicRange.includes('HDR') ? 'val-hdr' : ''}">${data.dynamicRange}</span></div>
          <div class="tv-hud-row"><span class="k">Buffer:</span><span class="v ${data.bufferSec < 3 ? 'val-warn' : 'val-good'}">${data.bufferSec.toFixed(1)} sec</span></div>
          <div class="tv-hud-row"><span class="k">Bandwidth Est:</span><span class="v">${data.bandwidthMbps.toFixed(1)} Mbps</span></div>
          <div class="tv-hud-row"><span class="k">Dropped Frames:</span><span class="v ${data.droppedFrames > 30 ? 'val-warn' : ''}">${data.droppedFrames}</span></div>
          <div class="tv-hud-row"><span class="k">Display HDR:</span><span class="v">${data.displayHDR ? 'YES' : 'NO'}</span></div>
          <div class="tv-hud-row"><span class="k">2160p Decode:</span><span class="v">${data.canDecode2160p ? 'YES' : 'NO'}</span></div>
          <div class="tv-hud-row"><span class="k">Current Rep:</span><span class="v font-mono">${data.currentRepresentationId}</span></div>
          <div class="tv-hud-row full-width"><span class="k">Selection Reason:</span><span class="v desc">${data.reasonForSelection}</span></div>
        </div>
      </div>
    `;

    const closeBtn = this.hudElement.querySelector('#btnTvHudClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.toggleHUD(false));
    }
  }

  public static toggleHUD(forceState?: boolean): boolean {
    this.isVisible = forceState !== undefined ? forceState : !this.isVisible;
    if (this.hudElement) {
      this.hudElement.style.display = this.isVisible ? 'block' : 'none';
      if (this.isVisible && this.lastHudData) {
        this.renderHUD(this.lastHudData);
      }
    }
    return this.isVisible;
  }

  public static isHudVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Global keyboard shortcut (Alt+Shift+D) to toggle HUD
   */
  private static attachKeyboardShortcut(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        this.toggleHUD();
      }
    });
  }

  /**
   * Service Analysis (Prime Web Research Mode):
   * Inspects the active web session and classifies bottlenecks truthfully.
   */
  public static async analyzeServiceSession(
    observedReps: MediaRepresentation[],
    activeRep: MediaRepresentation | null,
    displayOverride?: DisplayCapability
  ): Promise<ServiceAnalysisReport> {
    const display = displayOverride || TVCapabilityEngine.getDisplayCapability();
    const decoder = await TVCapabilityEngine.probeDecoderCapabilities();
    const hdrReport = TVHdrEngine.evaluateHdr(observedReps, activeRep, display);

    // 1. Identify Service Offers
    let maxServiceHeight = 0;
    let maxServiceHdr = 'SDR';
    observedReps.forEach(r => {
      if (r.height > maxServiceHeight) maxServiceHeight = r.height;
      if (r.hdr) maxServiceHdr = r.dynamicRange;
    });

    // 2. Classify Bottleneck
    let bottleneck: BottleneckCategory = 'UNKNOWN';
    let bottleneckExplanation = 'Playback operating normally.';

    if (maxServiceHeight > 0 && maxServiceHeight < 2160) {
      bottleneck = 'SERVICE_OFFER';
      bottleneckExplanation = `The streaming service only offered up to ${maxServiceHeight}p (${maxServiceHdr}) to this web browser session. No 2160p (4K) manifest representations exist.`;
    } else if (maxServiceHeight >= 2160 && !decoder.supports2160p) {
      bottleneck = 'BROWSER_CAPABILITY';
      bottleneckExplanation = `The service exposes 2160p representations, but the current browser/GPU configuration cannot decode 2160p smoothly.`;
    } else if (maxServiceHdr !== 'SDR' && !display.displayHDR) {
      bottleneck = 'HDR_CAPABILITY';
      bottleneckExplanation = `The stream contains ${maxServiceHdr} streams, but the connected display or OS reports Standard Dynamic Range (SDR) only.`;
    } else if (activeRep && maxServiceHeight >= 2160 && activeRep.height < 2160) {
      bottleneck = 'BANDWIDTH';
      bottleneckExplanation = `4K is available and supported, but player ABR algorithm selected ${activeRep.height}p due to current throughput or buffer constraints.`;
    } else if (maxServiceHeight >= 2160 && decoder.supports2160p && activeRep?.height === 2160) {
      bottleneck = 'PLAYER_SELECTION';
      bottleneckExplanation = `Optimal TV mode playback achieved: streaming at full 2160p (${activeRep.dynamicRange}) on capable hardware.`;
    }

    return {
      serviceMaximumResolution: maxServiceHeight ? `${maxServiceHeight}p` : 'Unknown / DRM Restricted',
      serviceMaximumHDR: maxServiceHdr,
      representationsObserved: observedReps,
      currentResolution: activeRep ? `${activeRep.height}p` : 'Unknown',
      currentBitrateBps: activeRep ? activeRep.bitrate : 0,
      currentCodec: activeRep ? `${activeRep.codec} (${activeRep.codecString})` : 'Unknown',
      browserCapability: {
        canDecode4K: decoder.supports2160p,
        canDecodeHDR: decoder.supportsHDR10,
        supportedCodecs: decoder.profiles.filter(p => p.supported).map(p => p.codec)
      },
      displayCapability: display,
      bottleneck,
      bottleneckExplanation
    };
  }
}
