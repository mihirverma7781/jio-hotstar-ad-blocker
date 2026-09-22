/**
 * PrimeDebugPanel
 * Phase 9 & 10 Prime Video Player Debug Panel.
 * Shows: REAL PLAYBACK STATUS, full pipeline evidence, bitrate sparkline,
 * representation ladder, ABR decision log, and GetPlaybackResources capture.
 * All data is sourced from the live bridge — no simulated or fabricated values.
 */

import { PrimeDebugPanelData } from '../types/drm_research';
import { AbrDecision } from './PrimeTVAbrController';

const REAL_PLAYBACK_LABELS: Record<string, { label: string; cls: string }> = {
  'REAL_UHD_ACTIVE':             { label: 'REAL_UHD_ACTIVE',             cls: 'pv-pass pv-glow' },
  'REAL_HDR_UHD_ACTIVE':         { label: 'REAL_HDR_UHD_ACTIVE',         cls: 'pv-pass pv-glow-hdr' },
  '2160p HDR ACTIVE':            { label: 'REAL_HDR_UHD_ACTIVE',         cls: 'pv-pass pv-glow-hdr' },
  'UHD ACTIVE':                  { label: 'REAL_UHD_ACTIVE',             cls: 'pv-pass pv-glow' },
  'UHD_NOT_DELIVERED_TO_WEB_SESSION': { label: 'UHD_NOT_DELIVERED',      cls: 'pv-warn' },
  'PLAYER_REJECTED_UHD':         { label: 'UHD_PRESENT_BUT_REJECTED',    cls: 'pv-fail' },
  'UHD_PRESENT_BUT_NOT_SELECTED':{ label: 'UHD_PRESENT_BUT_NOT_SELECTED',cls: 'pv-warn' },
  'UNKNOWN':                     { label: 'UNKNOWN',                     cls: 'pv-dim' },
};

export class PrimeDebugPanel {
  private panelElement: HTMLElement | null = null;
  private isVisible: boolean = false;
  private bitrateSamples: number[] = [];
  private lastData: PrimeDebugPanelData | null = null;

  public render(data: PrimeDebugPanelData): void {
    if (typeof document === 'undefined') return;

    if (!this.panelElement) {
      this.createPanel();
    }
    if (!this.panelElement) return;

    this.lastData = data;

    // Track bitrate samples for sparkline
    const brVal = parseFloat(data.currentBitrate);
    if (!isNaN(brVal)) {
      this.bitrateSamples.push(brVal);
      if (this.bitrateSamples.length > 30) this.bitrateSamples.shift();
    }

    const status = REAL_PLAYBACK_LABELS[data.finalStatus] ?? { label: data.finalStatus, cls: 'pv-dim' };
    const isUhd = data.currentDecoded.includes('3840') || data.currentDecoded.includes('2160');

    this.panelElement.innerHTML = `
      <div class="pv-debug-header">
        <div class="pv-debug-title">
          <span class="pv-badge">PRIME VIDEO PLAYER</span>
          <span class="pv-sub">Web Pipeline Diagnostics</span>
        </div>
        <button id="pv-debug-close" class="pv-close-btn">&times;</button>
      </div>

      <!-- REAL PLAYBACK STATUS (Phase 9) -->
      <div class="pv-section-title">REAL PLAYBACK STATUS</div>
      <div class="pv-status-block ${status.cls}">${status.label}</div>

      <!-- CURRENT PLAYBACK -->
      <div class="pv-section-title">CURRENT PLAYBACK</div>
      <div class="pv-debug-grid">
        <div class="pv-row">
          <span class="pv-label">Decoded dimensions:</span>
          <span class="pv-val ${isUhd ? 'pv-pass' : 'pv-warn'}">${data.currentDecoded}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">Codec:</span>
          <span class="pv-val">${data.currentCodec}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">Bitrate:</span>
          <span class="pv-val">${data.currentBitrate}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">Dynamic range:</span>
          <span class="pv-val ${data.currentHDR.includes('HDR') ? 'pv-pass' : ''}">${data.currentHDR}</span>
        </div>
        ${data.abrTier ? `
        <div class="pv-row">
          <span class="pv-label">ABR tier:</span>
          <span class="pv-val pv-mono">${data.abrTier.toUpperCase()}</span>
        </div>` : ''}
      </div>

      <!-- BITRATE SPARKLINE -->
      ${this.renderSparkline()}

      <!-- CAPABILITY CHECKS -->
      <div class="pv-section-title">CAPABILITY CHECKS</div>
      <div class="pv-debug-grid">
        <div class="pv-row">
          <span class="pv-label">Chrome 4K decoder:</span>
          <span class="pv-val ${data.chromeDecoder === 'PASS' ? 'pv-pass' : 'pv-fail'}">${data.chromeDecoder}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">EME (Widevine):</span>
          <span class="pv-val ${data.eme === 'PASS' ? 'pv-pass' : 'pv-fail'}">${data.eme}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">Output (HDCP):</span>
          <span class="pv-val ${data.output === 'PASS' ? 'pv-pass' : 'pv-warn'}">${data.output}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">Player UHD API:</span>
          <span class="pv-val ${data.playerUhdSelection === 'PASS' ? 'pv-pass' : ''}">${data.playerUhdSelection}</span>
        </div>
      </div>

      <!-- PIPELINE EVIDENCE (Phase 10) -->
      <details class="pv-details" open>
        <summary class="pv-section-title" style="cursor:pointer;list-style:none">PIPELINE EVIDENCE ▾</summary>
        <div class="pv-debug-grid">
          <div class="pv-row">
            <span class="pv-label">2160p in manifest:</span>
            <span class="pv-val ${data.uhdRepresentation === 'FOUND' ? 'pv-pass' : 'pv-fail'}">${data.uhdRepresentation}</span>
          </div>
          <div class="pv-row">
            <span class="pv-label">2160p HDR in manifest:</span>
            <span class="pv-val ${data.uhdHdrRepresentation === 'FOUND' ? 'pv-pass' : 'pv-fail'}">${data.uhdHdrRepresentation}</span>
          </div>
          <div class="pv-row">
            <span class="pv-label">Max observed:</span>
            <span class="pv-val">${data.maxObservedRepresentation || '—'}</span>
          </div>
          <div class="pv-row">
            <span class="pv-label">Full ladder:</span>
            <span class="pv-val pv-mono" style="font-size:10px;word-break:break-all">${data.representationsObserved.join(', ') || 'Scanning...'}</span>
          </div>
          ${data.playbackResourcesInfo?.deviceTypeIdentifier ? `
          <div class="pv-row">
            <span class="pv-label">deviceTypeID:</span>
            <span class="pv-val pv-mono" style="font-size:10px">${data.playbackResourcesInfo.deviceTypeIdentifier}</span>
          </div>` : ''}
          ${data.playbackResourcesInfo?.maxResolutionFromResponse ? `
          <div class="pv-row">
            <span class="pv-label">Max res (response):</span>
            <span class="pv-val">${data.playbackResourcesInfo.maxResolutionFromResponse}</span>
          </div>` : ''}
          ${data.playbackResourcesInfo?.discoveredSdkApis?.length ? `
          <div class="pv-row">
            <span class="pv-label">SDK APIs found:</span>
            <span class="pv-val pv-mono" style="font-size:10px;word-break:break-all">${data.playbackResourcesInfo.discoveredSdkApis.slice(0,5).join(', ')}</span>
          </div>` : ''}
        </div>
      </details>

      <!-- ABR DECISION LOG -->
      ${data.abrDecisionLog?.length ? `
      <details class="pv-details">
        <summary class="pv-section-title" style="cursor:pointer;list-style:none">ABR LOG (last ${data.abrDecisionLog.length}) ▾</summary>
        <div class="pv-abr-log">
          ${(data.abrDecisionLog as AbrDecision[]).slice(-6).reverse().map(d => `
            <div class="pv-abr-row pv-abr-${d.action.toLowerCase()}">
              <span class="pv-abr-action">${d.action}</span>
              <span class="pv-abr-detail">${d.fromHeight}p→${d.toHeight}p buf=${d.bufferedAhead.toFixed(1)}s</span>
            </div>
          `).join('')}
        </div>
      </details>` : ''}

      <!-- ROOT CAUSE -->
      ${data.exactReason
        ? `<div class="pv-reason-box"><span class="pv-reason-title">Root Cause:</span> ${data.exactReason}</div>`
        : ''}

      <!-- FOOTER -->
      <div class="pv-footer">Alt+Shift+P — toggle panel &nbsp;|&nbsp; Alt+Shift+D — TV HUD</div>
    `;

    const closeBtn = this.panelElement.querySelector('#pv-debug-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
  }

  private renderSparkline(): string {
    if (this.bitrateSamples.length < 2) return '';

    const W = 200, H = 44;
    const max = Math.max(...this.bitrateSamples, 15); // always show 15 Mbps reference
    const min = 0;
    const range = max - min || 1;
    const pts = this.bitrateSamples.map((v, i) => {
      const x = (i / (this.bitrateSamples.length - 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const refY = H - ((15 - min) / range) * H;

    return `
      <div class="pv-section-title">BITRATE TIMELINE</div>
      <div class="pv-sparkline-wrap">
        <svg width="${W}" height="${H}" class="pv-sparkline">
          <line x1="0" y1="${refY.toFixed(1)}" x2="${W}" y2="${refY.toFixed(1)}"
            stroke="#ef4444" stroke-width="1" stroke-dasharray="3,3" opacity="0.6"/>
          <polyline points="${pts}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round"/>
          <text x="2" y="${Math.max(refY - 3, 10).toFixed(1)}" fill="#ef4444" font-size="8">15 Mbps (UHD min)</text>
        </svg>
        <span class="pv-sparkline-cur">${this.bitrateSamples[this.bitrateSamples.length-1].toFixed(1)} Mbps</span>
      </div>
    `;
  }

  private createPanel(): void {
    this.panelElement = document.createElement('div');
    this.panelElement.id = 'prime-video-debug-panel';
    this.panelElement.className = 'pv-debug-overlay';
    document.body.appendChild(this.panelElement);
  }

  public show(): void {
    if (this.panelElement) {
      this.panelElement.style.display = 'block';
      this.isVisible = true;
    }
  }

  public hide(): void {
    if (this.panelElement) {
      this.panelElement.style.display = 'none';
      this.isVisible = false;
    }
  }

  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public destroy(): void {
    if (this.panelElement && this.panelElement.parentNode) {
      this.panelElement.parentNode.removeChild(this.panelElement);
      this.panelElement = null;
    }
  }
}
