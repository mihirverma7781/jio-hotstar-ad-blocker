/**
 * PrimeDebugPanel
 * Implements the Phase 10 Prime Video Player Debug Panel.
 * Renders real decoded dimensions, codecs, bitrates, observed representations, and exact ceiling reasons.
 */

import { PrimeDebugPanelData } from '../types/drm_research';

export class PrimeDebugPanel {
  private panelElement: HTMLElement | null = null;
  private isVisible: boolean = false;

  public render(data: PrimeDebugPanelData): void {
    if (typeof document === 'undefined') return;

    if (!this.panelElement) {
      this.createPanel();
    }

    if (!this.panelElement) return;

    this.panelElement.innerHTML = `
      <div class="pv-debug-header">
        <div class="pv-debug-title">
          <span class="pv-badge">PRIME VIDEO PLAYER</span>
          <span class="pv-sub">Web Pipeline Diagnostics</span>
        </div>
        <button id="pv-debug-close" class="pv-close-btn">&times;</button>
      </div>

      <div class="pv-debug-grid">
        <div class="pv-row">
          <span class="pv-label">Current decoded:</span>
          <span class="pv-val ${data.currentDecoded.includes('3840') ? 'pv-pass' : 'pv-warn'}">${data.currentDecoded}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">Current codec:</span>
          <span class="pv-val">${data.currentCodec}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">Current bitrate:</span>
          <span class="pv-val">${data.currentBitrate}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">Current HDR:</span>
          <span class="pv-val ${data.currentHDR.includes('HDR') ? 'pv-pass' : ''}">${data.currentHDR}</span>
        </div>

        <div class="pv-divider"></div>

        <div class="pv-row">
          <span class="pv-label">Representations observed:</span>
          <span class="pv-val">${data.representationsObserved.join(', ') || 'Scanning...'}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">2160p representation:</span>
          <span class="pv-val ${data.uhdRepresentation === 'FOUND' ? 'pv-pass' : 'pv-fail'}">${data.uhdRepresentation}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">2160p HDR:</span>
          <span class="pv-val ${data.uhdHdrRepresentation === 'FOUND' ? 'pv-pass' : 'pv-fail'}">${data.uhdHdrRepresentation}</span>
        </div>

        <div class="pv-divider"></div>

        <div class="pv-row">
          <span class="pv-label">Chrome decoder:</span>
          <span class="pv-val ${data.chromeDecoder === 'PASS' ? 'pv-pass' : 'pv-fail'}">${data.chromeDecoder}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">EME:</span>
          <span class="pv-val ${data.eme === 'PASS' ? 'pv-pass' : 'pv-fail'}">${data.eme}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">Output (HDCP):</span>
          <span class="pv-val ${data.output === 'PASS' ? 'pv-pass' : 'pv-warn'}">${data.output}</span>
        </div>
        <div class="pv-row">
          <span class="pv-label">Player UHD selection:</span>
          <span class="pv-val ${data.playerUhdSelection === 'PASS' ? 'pv-pass' : ''}">${data.playerUhdSelection}</span>
        </div>

        <div class="pv-divider"></div>

        <div class="pv-row pv-final-row">
          <span class="pv-label">Final:</span>
          <span class="pv-val pv-final ${data.finalStatus.includes('ACTIVE') ? 'pv-pass' : 'pv-accent'}">${data.finalStatus}</span>
        </div>
        ${
          data.exactReason
            ? `<div class="pv-reason-box"><span class="pv-reason-title">Root Cause:</span> ${data.exactReason}</div>`
            : ''
        }
      </div>
    `;

    const closeBtn = this.panelElement.querySelector('#pv-debug-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
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
