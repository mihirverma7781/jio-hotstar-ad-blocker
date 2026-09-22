/**
 * PrimePlayerAdapter
 * Communicates with Prime Video's native player SDK to request track changes or set resolution caps.
 * Interacts through the page-context bridge via window.postMessage.
 */

export class PrimePlayerAdapter {
  /**
   * Finds the primary playback video element on Prime Video.
   */
  public getVideoElement(): HTMLVideoElement | null {
    if (typeof document === 'undefined') return null;

    return (
      (document.querySelector('.webPlayerUIContainer video') as HTMLVideoElement) ||
      (document.querySelector('.rendererContainer video') as HTMLVideoElement) ||
      (document.querySelector('video') as HTMLVideoElement) ||
      null
    );
  }

  /**
   * Sends a track selection command to the page-context bridge.
   */
  public selectTrack(trackId: string): void {
    if (typeof window === 'undefined') return;

    window.postMessage(
      {
        target: 'PV_PAGE_BRIDGE',
        command: 'SELECT_TRACK',
        trackId
      },
      '*'
    );
  }

  /**
   * Requests the highest available quality constraints.
   */
  public requestMaxQuality(): void {
    if (typeof window === 'undefined') return;

    window.postMessage(
      {
        target: 'PV_PAGE_BRIDGE',
        command: 'SELECT_TRACK',
        trackId: 'MAX_UHD'
      },
      '*'
    );
  }
}
