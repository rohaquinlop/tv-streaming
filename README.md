# TV Colombia

LG Smart TV app that plays Colombian free-to-air TV channels. Built for elderly users who can't navigate streaming websites — open the app, watch TV.

## Channels

| # | Channel | Source |
|---|---------|--------|
| 1 | Caracol TV | HLS (HD) |
| 2 | RCN TV | HLS (HD) |

Channels are configured in `channels.json` and fetched from GitHub on each launch, so stream URLs can be updated without redeploying.

## How It Works

- App launches → plays last-watched channel automatically
- **Up/Down** or **Channel Up/Down** on the remote → switch channel
- **Back** → show channel info overlay; press again within 3s to exit
- Channel name overlay fades after 3 seconds

No menus, no typing, no web browsing. Just TV.

## Requirements

- LG Smart TV with webOS 4.0+ (tested on LG 49UK6200PDA)
- [webOS TV CLI tools](https://webostv.developer.lge.com/develop/tools/cli-installation) (`ares-*` commands)
- Developer Mode enabled on the TV

## Setup

### 1. Enable Developer Mode on the TV

1. Install the **Developer Mode** app from the LG Content Store
2. Sign in with an LG account and enable Developer Mode
3. Enable **Key Server**

### 2. Register the TV

```bash
ares-setup-device
# Add your TV: name, IP, port 9922, user "prisoner"

ares-novacom --device "TV Casa" --getkey
# Enter the passphrase shown on the TV
```

### 3. Deploy

```bash
ares-package .
ares-install --device "TV Casa" com.family.tvcolombia_1.0.0_all.ipk
ares-launch --device "TV Casa" com.family.tvcolombia
```

### 4. Redeploy after changes

```bash
ares-package . && ares-install --device "TV Casa" com.family.tvcolombia_1.0.0_all.ipk && ares-launch --device "TV Casa" com.family.tvcolombia
```

## Updating Stream URLs

Stream URLs come from IPTV community sources and can go offline. To update without redeploying:

1. Edit `channels.json` on GitHub (works from any device, including your phone)
2. The app fetches the latest config on next launch

If the remote config is unreachable, the app falls back to the hardcoded URLs in `js/config.js`.

## Architecture

Plain HTML/CSS/JS — no framework, no build step, no dependencies.

```
appinfo.json      webOS app manifest
index.html        App shell (video, overlay, loading/error layers)
channels.json     Channel list (id, name, type, HLS url)
js/
  app.js          Main loop: key handling, channel switching, UI state
  channels.js     Channel index tracking with wrap-around
  config.js       Remote config fetch with local fallback
  storage.js      Last-watched channel persistence (localStorage)
```

Video plays natively via `<video>` tag with HLS m3u8 streams. No iframes — official streaming providers block third-party embedding.

## Known Limitations

- **Developer Mode expires every ~50 hours** on the TV. Re-enable it in the Developer Mode app; the installed app persists.
- **IPTV streams are community-sourced** and may go offline without notice. The remote config system is designed for this — update `channels.json` on GitHub.
- **webOS 4.0 runs Chromium 53** — ES5-compatible JavaScript only.
