# TV Colombia

LG Smart TV app that plays Colombian free-to-air TV channels. Built for elderly users who can't navigate streaming websites — open the app, watch TV.

## Channels

| # | Channel | Source |
|---|---------|--------|
| 1 | Caracol TV | HLS (HD) |
| 2 | RCN TV | HLS (HD) |

Channels are configured in `channels.json`. The app fetches the file from GitHub on each launch when the repository is public; with a private repository it uses the packaged copy.

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
./scripts/build.sh
ares-install --device "TV Casa" com.family.tvcolombia_1.0.0_all.ipk
ares-launch --device "TV Casa" com.family.tvcolombia
```

### 4. Redeploy after changes

```bash
./scripts/build.sh && ares-install --device "TV Casa" com.family.tvcolombia_1.0.0_all.ipk && ares-launch --device "TV Casa" com.family.tvcolombia
```

## Updating Stream URLs

Stream URLs come from IPTV community sources and can go offline. The app heals itself at runtime:

1. **Fallback list** — each channel lists up to 4 URLs in `channels.json`. On a stream error the app tries the next URL.
2. **Candidate pool** — `js/sources.js` ships 12 candidate URLs per channel. The app tries them after the fallback list.
3. **Runtime discovery** — when every known URL fails, the app asks the IPTV-org API for new URLs and tries those.
4. **Learning** — the app remembers the URL that played last per channel and tries it first on the next launch.

To refresh the URL lists before a deploy:

```bash
python3 scripts/resolve_streams.py   # rewrite channels.json and js/sources.js
./scripts/check-streams.sh           # verify every URL in channels.json
```

The GitHub Actions workflow in `.github/workflows/refresh-streams.yml` keeps both files fresh in the repository. With a private repository the TV cannot fetch the remote config, so the packaged files are the source of truth.

## Architecture

Plain HTML/CSS/JS — no framework, no build step, no dependencies.

```
appinfo.json      webOS app manifest
index.html        App shell (video, overlay, loading/error layers)
channels.json     Channel list (id, name, type, url, urls fallback list)
js/
  app.js          Main loop: key handling, channel switching, URL fallback and discovery
  channels.js     Channel index tracking with wrap-around
  config.js       Remote config fetch with local fallback
  resolver.js     Runtime URL discovery from the IPTV-org API
  sources.js      Generated candidate URL pool (do not edit by hand)
  storage.js      Last-watched channel and learned URL persistence (localStorage)
scripts/
  build.sh            Builds the .ipk without development files (--debug for Web Inspector)
  check-streams.sh    Local HLS stream validator
  resolve_streams.py  Resolves working stream URLs into channels.json and js/sources.js
  streams-config.json Resolver settings (sources per channel)
.github/workflows/
  refresh-streams.yml Scheduled stream URL refresh (every 6 hours)
```

Video plays natively via `<video>` tag with HLS m3u8 streams. No iframes — official streaming providers block third-party embedding.

## Known Limitations

- **Developer Mode expires every ~50 hours** on the TV. Re-enable it in the Developer Mode app; the installed app persists.
- **IPTV streams are community-sourced** and may go offline without notice. The app self-heals: fallback list, candidate pool, then runtime discovery from the IPTV-org API.
- **webOS 4.0 runs Chromium 53** — ES5-compatible JavaScript only.
