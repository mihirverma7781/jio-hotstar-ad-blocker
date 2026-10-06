/**
 * HyperSkip — Interactive Landing Simulator
 * Telemetry animation, fast-forward scrubber, and real-time state machine.
 */

document.addEventListener('DOMContentLoaded', () => {
  const btnSimulateAd = document.getElementById('btnSimulateAd');
  const demoContent = document.getElementById('demoContent');
  const demoAdLayer = document.getElementById('demoAdLayer');
  const demoAudioBars = document.getElementById('demoAudioBars');
  const demoProgress = document.getElementById('demoProgress');
  const demoAdBadge = document.getElementById('demoAdBadge');
  const demoSkipBtn = document.getElementById('demoSkipBtn');

  const demoStatus = document.getElementById('demoStatus');
  const demoSpeed = document.getElementById('demoSpeed');
  const demoAudio = document.getElementById('demoAudio');

  let isSimulationRunning = false;

  btnSimulateAd.addEventListener('click', () => {
    if (isSimulationRunning) return;
    isSimulationRunning = true;
    btnSimulateAd.disabled = true;

    // 1. Commercial break cues detected
    demoStatus.textContent = 'COMMERCIAL DETECTED // 16x';
    demoStatus.style.color = '#f59e0b'; // Amber telemetry cue

    demoSpeed.textContent = '16.0x VELOCITY';
    demoSpeed.style.color = '#ffffff';

    demoAudio.textContent = 'MUTED // ATTENUATED';
    demoAudio.style.color = '#606973';
    demoAudioBars.classList.add('muted');

    demoContent.classList.add('blurred');
    demoAdLayer.classList.add('active');
    demoProgress.classList.add('ad-active');

    let secondsLeft = 15;
    demoAdBadge.textContent = `Ad · 00:${secondsLeft < 10 ? '0' : ''}${secondsLeft}`;

    let progressScale = 0.35;

    const interval = setInterval(() => {
      secondsLeft -= 3;
      progressScale += 0.13;
      demoProgress.style.transform = `scaleX(${Math.min(progressScale, 1)})`;

      if (secondsLeft > 0) {
        demoAdBadge.textContent = `Ad · 00:${secondsLeft < 10 ? '0' : ''}${secondsLeft}`;
      }

      // Fast automated skip trigger
      if (secondsLeft <= 6) {
        demoSkipBtn.classList.add('clicked');
        demoSkipBtn.textContent = 'DISPATCHED ✓';
      }

      if (secondsLeft <= 0) {
        clearInterval(interval);

        // 2. Commercial break concluded -> Reference stream restored
        setTimeout(() => {
          demoAdLayer.classList.remove('active');
          demoContent.classList.remove('blurred');
          demoAudioBars.classList.remove('muted');
          demoProgress.classList.remove('ad-active');
          demoSkipBtn.classList.remove('clicked');
          demoSkipBtn.textContent = 'Skip Ad ❯';
          demoProgress.style.transform = 'scaleX(0.35)';

          demoStatus.textContent = 'READY // MONITORING';
          demoStatus.style.color = '#22c55e'; // Emerald laser
          demoSpeed.textContent = '1.0x';
          demoSpeed.style.color = '#ffffff';
          demoAudio.textContent = 'ACTIVE // 0.0dB';
          demoAudio.style.color = '#ffffff';

          isSimulationRunning = false;
          btnSimulateAd.disabled = false;
        }, 280);
      }
    }, 180); // 15s commercial finishes in ~1.1 seconds
  });

  // Code Terminal Click-to-Copy
  const codeTerminal = document.querySelector('.code-terminal');
  if (codeTerminal) {
    codeTerminal.addEventListener('click', () => {
      const text = codeTerminal.textContent.trim();
      navigator.clipboard.writeText(text).then(() => {
        const original = codeTerminal.innerHTML;
        codeTerminal.innerHTML = '<code style="color: #22c55e;">COPIED TO CLIPBOARD ✓</code>';
        setTimeout(() => {
          codeTerminal.innerHTML = original;
        }, 1800);
      });
    });
  }
});
