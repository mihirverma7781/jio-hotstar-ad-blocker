# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Streamers and power viewers of OTT video platforms (specifically JioHotstar, JioCinema, and Amazon Prime Video) who watch in modern desktop Chromium browsers and want zero interruptions from video ads, commercial audio spikes, or promo overlays without breaking playback streams or DRM.

## Product Purpose

HyperSkip is a zero-freeze, high-velocity streaming companion extension. It automates commercial handling by accelerating in-video advertisements to 16x speed, muting ad audio, clicking skip cues instantaneously, and purging ad CDN assets without breaking Widevine DRM pipelines or freezing the page.

## Positioning

Unlike conventional adblockers that block network chunks (frequently breaking encrypted DASH/HLS streams and triggering anti-adblock blackouts) or invasive scripts that freeze browsers, HyperSkip operates in a lightweight isolated content runtime. It drives real playback speed acceleration (up to 16x) and automated audio muting, transforming 30-second unskippable ad breaks into sub-second blips.

## Operating Context

- Browser toolbar extension popup (Manifest V3) on Chrome, Brave, Edge, and Arc.
- Real-time in-stream playback overlay HUD on JioHotstar and Amazon Prime Video.
- Web documentation, installation guide, and interactive live simulator on GitHub Pages.

## Capabilities and Constraints

- Capabilities: 16x/8x/4x video fast-forward, automatic audio silencing & restore, millisecond auto-click for skip buttons (including intros/recaps), cosmetic CDN asset suppression, stats tracking (ads skipped, seconds saved).
- Constraints: Manifest V3 compliant. Zero monkey-patching of DRM license exchanges (Widevine/PlayReady) or DASH manifests. No destructive CSS parent collapsing that breaks webapp page layouts.

## Brand Commitments

- Name: **HyperSkip**
- Identity & Aesthetic: **Minimalist Monochromatic Titanium**. Swiss typography, sharp geometric accents, high-contrast brutalist clarity, precise technical layout, monochrome palette (titanium white, cool metallic grays, deep carbon black) with micro-metered emerald status indicators. Zero generic gradient glow AI slop.
- Brand Glyph: Precision chevron-forward glyph with acceleration index bars.

## Evidence on Hand

- Chrome Extension codebase: Manifest V3 (`manifest.json`), isolated content scripts (`content/detector.js`, `content/styles.css`), service worker (`background/service_worker.js`), and popup (`popup/popup.html`, `popup/popup.js`, `popup/popup.css`).
- Live website repository: `index.html`, `style.css`, `script.js`, and `docs/index.html`.

## Product Principles

1. **Brutalist Precision over AI Slop**: Clean structural grids, high typographic contrast, tactile controls, and raw informational density rather than blurred purple/cyan gradients and generic marketing clichés.
2. **Zero-Friction Performance**: Sub-millisecond response time with near-0% CPU footprint. No bloat, no invasive telemetry.
3. **Respect Content Integrity**: Never corrupt user media pipelines, never break DRM, and never collapse legitimate user interface trees.
