/**
 * HyperSkip — Overdrive Real-Time Simulator Engine
 * 60fps Audio Oscilloscope & Velocity Warp Particle Engine.
 * Features full progressive enhancement and zero CPU lock when idle.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Notion Loader Dismissal
  const notionLoader = document.getElementById('notionLoader');
  if (notionLoader) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        notionLoader.classList.add('loaded');
      }, 450);
    });
    // Fallback if load already fired or takes longer
    setTimeout(() => {
      if (!notionLoader.classList.contains('loaded')) {
        notionLoader.classList.add('loaded');
      }
    }, 1200);
  }

  // DOM Elements
  const btnSimulateAd = document.getElementById('btnSimulateAd');
  const demoContent = document.getElementById('demoContent');
  const demoAdLayer = document.getElementById('demoAdLayer');
  const demoAudioBars = document.getElementById('demoAudioBars');
  const demoProgress = document.getElementById('demoProgress');
  const demoAdBadge = document.getElementById('demoAdBadge');
  const demoSkipBtn = document.getElementById('demoSkipBtn');
  const demoCanvas = document.getElementById('demoCanvas');

  // Telemetry Readouts
  const demoStatus = document.getElementById('demoStatus');
  const demoSpeed = document.getElementById('demoSpeed');
  const demoAudio = document.getElementById('demoAudio');

  let isSimulationRunning = false;
  let totalDemoSkipped = 0;
  let totalDemoSeconds = 0;

  // ----------------------------------------------------
  // OVERDRIVE: Canvas Audio Oscilloscope & Warp Particles
  // ----------------------------------------------------
  let ctx = null;
  let animId = null;
  let particles = [];
  let phase = 0;
  let isAdActive = false;
  let warpSpeed = 1.0;

  if (demoCanvas && demoCanvas.getContext) {
    ctx = demoCanvas.getContext('2d');

    function resizeCanvas() {
      const rect = demoCanvas.parentElement.getBoundingClientRect();
      if (rect.width && rect.height) {
        demoCanvas.width = rect.width;
        demoCanvas.height = rect.height;
      }
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialise 70 warp particles
    const particleCount = 70;
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * demoCanvas.width,
        y: Math.random() * demoCanvas.height,
        z: Math.random() * demoCanvas.width,
        length: 1 + Math.random() * 3,
        alpha: 0.15 + Math.random() * 0.4
      });
    }

    function renderEngine() {
      if (!ctx) return;
      const w = demoCanvas.width;
      const h = demoCanvas.height;

      ctx.clearRect(0, 0, w, h);

      // 1. Draw Audio Oscilloscope (Reference Content Active)
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      const centerY = h * 0.76;
      const amplitude = isAdActive ? 0.8 : 16; // Flatlines to 0.8 during ad silence
      const freq = isAdActive ? 0.005 : 0.022;

      for (let x = 0; x < w; x += 4) {
        // Multi-frequency sine superposition
        const y = centerY +
          Math.sin(x * freq + phase) * amplitude +
          Math.cos(x * 0.012 - phase * 1.5) * (amplitude * 0.45);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.strokeStyle = isAdActive
        ? 'rgba(100, 116, 139, 0.25)' // Dim flatline
        : 'rgba(56, 189, 248, 0.45)'; // Vibrant cyan waveform
      ctx.stroke();

      // 2. Draw 16x Velocity Warp Particles (Overdrive Mode)
      if (warpSpeed > 1.2) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
        ctx.lineWidth = 1.8;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.z -= warpSpeed * 1.8;
          if (p.z <= 0) {
            p.z = w;
            p.x = Math.random() * w;
            p.y = Math.random() * h;
          }

          const k = 140 / p.z;
          const px = (p.x - w / 2) * k + w / 2;
          const py = (p.y - h / 2) * k + h / 2;

          if (px >= 0 && px <= w && py >= 0 && py <= h) {
            const tailLength = (warpSpeed * 2.2) * (1 - p.z / w);
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px - tailLength, py);
            ctx.strokeStyle = `rgba(56, 189, 248, ${Math.min(p.alpha * (warpSpeed / 8), 0.85)})`;
            ctx.stroke();
          }
        }
      }

      phase += isAdActive ? 0.03 : 0.07;
      animId = requestAnimationFrame(renderEngine);
    }

    renderEngine();
  }

  // ----------------------------------------------------
  // Interactive Simulation Trigger
  // ----------------------------------------------------
  btnSimulateAd.addEventListener('click', () => {
    if (isSimulationRunning) return;
    isSimulationRunning = true;
    btnSimulateAd.disabled = true;
    isAdActive = true;
    warpSpeed = 16.0; // Engage Overdrive warp particles

    // 1. Commercial break cues detected
    demoStatus.textContent = 'COMMERCIAL DETECTED // 16x';
    demoStatus.className = 'demo-stat-val';
    demoStatus.style.color = '#f59e0b'; // Amber cue

    demoSpeed.textContent = '16.0x (Hyper-Speed)';
    demoSpeed.style.color = '#38bdf8';

    demoAudio.textContent = 'MUTED (Silenced) 🔇';
    demoAudio.style.color = '#94a3b8';
    demoAudioBars.classList.add('muted');

    demoContent.classList.add('blurred');
    demoAdLayer.classList.add('active');
    demoProgress.classList.add('ad-active');

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

      // Fast automated skip trigger at midpoint
      if (secondsLeft <= 6) {
        demoSkipBtn.classList.add('clicked');
        demoSkipBtn.textContent = 'DISPATCHED ✓';
      }

      if (secondsLeft <= 0) {
        clearInterval(interval);

        // 2. Commercial break concluded -> Reference stream restored
        setTimeout(() => {
          isAdActive = false;
          warpSpeed = 1.0; // Return velocity to 1x

          demoAdLayer.classList.remove('active');
          demoContent.classList.remove('blurred');
          demoAudioBars.classList.remove('muted');
          demoProgress.classList.remove('ad-active');
          demoSkipBtn.classList.remove('clicked');
          demoSkipBtn.textContent = 'Skip Ad ❯';
          demoProgress.style.width = '35%';

          demoStatus.textContent = 'ACTIVE // MONITORING';
          demoStatus.className = 'demo-stat-val val-green';
          demoStatus.style.color = '#34d399';
          demoSpeed.textContent = '1.0x (Normal)';
          demoSpeed.style.color = '#fff';
          demoAudio.textContent = 'UNMUTED 🔊';
          demoAudio.style.color = '#34d399';

          totalDemoSkipped++;
          totalDemoSeconds += 15;

          isSimulationRunning = false;
          btnSimulateAd.disabled = false;
        }, 280);
      }
    }, 180); // 15-second commercial finishes in ~1.1 seconds!
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
        codeBox.innerHTML = '<code style="color: #34d399;">✓ Copied to clipboard!</code>';
        setTimeout(() => {
          codeBox.innerHTML = originalText;
        }, 1800);
      });
    });
  }
});
