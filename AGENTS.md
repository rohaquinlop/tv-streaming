# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A webOS 4.0 app for LG Smart TVs (target: LG 49UK6200PDA) that plays Colombian live TV channels via native HLS video. Designed for elderly users — channel-flip UX with remote control, no web navigation required.

## Build & Deploy

```bash
# Package the app (produces .ipk in project root)
./scripts/build.sh

# Install on TV (device name from ares-setup-device)
ares-install --device "TV Casa" com.family.tvcolombia_1.0.0_all.ipk

# Launch
ares-launch --device "TV Casa" com.family.tvcolombia

# Debug (opens Chrome DevTools for the app)
ares-inspect --device "TV Casa" --app com.family.tvcolombia --open
```

`./scripts/build.sh` excludes development files (`.git`, `scripts`, docs) from the package. Use `./scripts/build.sh --debug` to keep the code readable for Web Inspector.

No build step, no bundler, no dependencies. Plain HTML/CSS/JS packaged by the webOS CLI.

## Stream URL Maintenance

```bash
./scripts/check-streams.sh           # validate every URL in channels.json
python3 scripts/resolve_streams.py   # rewrite channels.json and js/sources.js
```

`scripts/resolve_streams.py` needs curl; ffprobe is optional and improves ranking. Candidate URLs come from the IPTV-org API plus `extra_urls` in `scripts/streams-config.json`. The workflow `.github/workflows/refresh-streams.yml` runs the resolver every 6 hours and commits both output files. The TV gets them at the next app deploy.

## Architecture

Single-page app with a `<video>` element playing HLS m3u8 streams. No frameworks.

- `index.html` — app shell: video element, channel overlay, loading/error layers
- `js/app.js` — main loop: remote control key handling, channel switching, URL fallback and discovery, UI state
- `js/channels.js` — channel list state: current index, next/previous with wrap-around
- `js/config.js` — loads channel list from GitHub raw URL on startup, falls back to local `channels.json`, then hardcoded `FALLBACK_CHANNELS`
- `js/resolver.js` — runtime URL discovery from the IPTV-org API when all known URLs fail
- `js/sources.js` — generated candidate URL pool (written by `scripts/resolve_streams.py`, do not edit by hand)
- `js/storage.js` — last-watched channel and learned URL persistence via `localStorage`
- `channels.json` — channel definitions (id, name, type, `url` for old app builds, `urls` fallback list tried in order)
- `appinfo.json` — webOS app manifest

## Key Constraints

- **webOS 4.0 / Chromium 53** — use `var`, no ES modules, no modern CSS (custom properties unreliable). `XMLHttpRequest` over `fetch` for safety.
- **HLS streams are community-sourced (iptv-org)** — they can go offline. The app self-heals at runtime: `urls` fallback list, `js/sources.js` candidate pool, then IPTV-org API discovery. The repo is private, so the remote config fetch fails and the packaged `channels.json` is the source of truth.
- **No iframe embedding** — official stream providers (Mediastream for Caracol, TBX for RCN) block embedding via domain allowlists and DRM. Native `<video>` with direct m3u8 URLs is the only working approach.
- **Developer Mode expires every ~50 hours** on the TV and must be re-enabled manually.

## Remote Control Key Codes

Up (38), Down (40), Channel Up (427), Channel Down (428), Back (461), Enter (13).
