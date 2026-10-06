/**
 * JioHotstar Ad Skipper - Landing Page Interactive Script
 * Powers the real-time ad bypass simulator and micro-interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Demo Elements
  const btnSimulateAd = document.getElementById('btnSimulateAd');
  const demoContent = document.getElementById('demoContent');
  const demoAdLayer = document.getElementById('demoAdLayer');
  const demoAudioBars = document.getElementById('demoAudioBars');
  const demoProgress = document.getElementById('demoProgress');
  const demoAdBadge = document.getElementById('demoAdBadge');
  const demoSkipBtn = document.getElementById('demoSkipBtn');

  // Stats in Demo
  const demoStatus = document.getElementById('demoStatus');
  const demoSpeed = document.getElementById('demoSpeed');
  const demoAudio = document.getElementById('demoAudio');

  let isSimulationRunning = false;
  let totalDemoSkipped = 0;
  let totalDemoSeconds = 0;

  // Simulate In-Video Ad Break
  btnSimulateAd.addEventListener('click', () => {
    if (isSimulationRunning) return;
    isSimulationRunning = true;
    btnSimulateAd.disabled = true;

    // 1. Ad Starts
    demoStatus.textContent = 'Ad Detected! Accelerating...';
    demoStatus.className = 'demo-stat-val';
    demoStatus.style.color = '#f59e0b'; // Amber warning

    demoSpeed.textContent = '16.0x (Hyper-Speed)';
    demoSpeed.style.color = '#38bdf8';

    demoAudio.textContent = 'Muted (Silenced) 🔇';
    demoAudio.style.color = '#94a3b8';
    demoAudioBars.classList.add('muted');

    demoContent.classList.add('blurred');
    demoAdLayer.classList.add('active');
    demoProgress.classList.add('ad-active');

    // Countdown animation simulation at 16x speed
    let secondsLeft = 15;
    demoAdBadge.textContent = `Ad · 00:${secondsLeft < 10 ? '0' : ''}${secondsLeft}`;

    let progressWidth = 30;

    const interval = setInterval(() => {
      secondsLeft -= 3;
      progressWidth += 14;
      demoProgress.style.width = `${Math.min(progressWidth, 100)}%`;

      if (secondsLeft > 0) {
        demoAdBadge.textContent = `Ad · 00:${secondsLeft < 10 ? '0' : ''}${secondsLeft}`;
      }

      // Halfway: Auto-click skip button
      if (secondsLeft <= 6) {
        demoSkipBtn.classList.add('clicked');
        demoSkipBtn.textContent = 'Skipped! ✓';
      }

      if (secondsLeft <= 0) {
        clearInterval(interval);

        // 2. Ad Finished -> Restore normal playback
        setTimeout(() => {
          demoAdLayer.classList.remove('active');
          demoContent.classList.remove('blurred');
          demoAudioBars.classList.remove('muted');
          demoProgress.classList.remove('ad-active');
          demoSkipBtn.classList.remove('clicked');
          demoSkipBtn.textContent = 'Skip Ad ❯';
          demoProgress.style.width = '35%';

          demoStatus.textContent = 'Content Restored ⚡';
          demoStatus.className = 'demo-stat-val val-green';
          demoSpeed.textContent = '1.0x (Normal)';
          demoSpeed.style.color = '#fff';
          demoAudio.textContent = 'Unmuted 🔊';
          demoAudio.style.color = '#34d399';

          totalDemoSkipped++;
          totalDemoSeconds += 15;

          isSimulationRunning = false;
          btnSimulateAd.disabled = false;
        }, 300);
      }
    }, 200); // 15s ad completes in ~1 second!
  });

  // Code Box Click-to-Copy
  const codeBox = document.querySelector('.code-box');
  if (codeBox) {
    codeBox.style.cursor = 'pointer';
    codeBox.title = 'Click to copy';
    codeBox.addEventListener('click', () => {
      const text = codeBox.querySelector('code').textContent;
      navigator.clipboard.writeText(text).then(() => {
        const originalText = codeBox.innerHTML;
        codeBox.innerHTML = '<code>✓ Copied to clipboard!</code>';
        setTimeout(() => {
          codeBox.innerHTML = originalText;
        }, 1800);
      });
    });
  }
});
