# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A webOS 4.0 app for LG Smart TVs (target: LG 49UK6200PDA) that plays Colombian live TV channels via native HLS video. Designed for elderly users — channel-flip UX with remote control, no web navigation required.

## Build & Deploy

```bash
# Package the app (produces .ipk in project root)
ares-package .

# Install on TV (device name from ares-setup-device)
ares-install --device "TV Casa" com.family.tvcolombia_1.0.0_all.ipk

# Launch
ares-launch --device "TV Casa" com.family.tvcolombia

# Debug (opens Chrome DevTools for the app)
ares-inspect --device "TV Casa" --app com.family.tvcolombia --open
```

No build step, no bundler, no dependencies. Plain HTML/CSS/JS packaged by the webOS CLI.

## Architecture

Single-page app with a `<video>` element playing HLS m3u8 streams. No frameworks.

- `index.html` — app shell: video element, channel overlay, loading/error layers
- `js/app.js` — main loop: remote control key handling, channel switching, UI state
- `js/channels.js` — channel list state: current index, next/previous with wrap-around
- `js/config.js` — loads channel list from GitHub raw URL on startup, falls back to local `channels.json`, then hardcoded `FALLBACK_CHANNELS`
- `js/storage.js` — last-watched channel persistence via `localStorage`
- `channels.json` — channel definitions (id, name, type, HLS url)
- `appinfo.json` — webOS app manifest

## Key Constraints

- **webOS 4.0 / Chromium 53** — use `var`, no ES modules, no modern CSS (custom properties unreliable). `XMLHttpRequest` over `fetch` for safety.
- **HLS streams are community-sourced (iptv-org)** — they can go offline. Update `channels.json` on GitHub; the app fetches it on each launch. Fallback servers are hardcoded in `config.js`.
- **No iframe embedding** — official stream providers (Mediastream for Caracol, TBX for RCN) block embedding via domain allowlists and DRM. Native `<video>` with direct m3u8 URLs is the only working approach.
- **Developer Mode expires every ~50 hours** on the TV and must be re-enabled manually.

## Remote Control Key Codes

Up (38), Down (40), Channel Up (427), Channel Down (428), Back (461), Enter (13).
