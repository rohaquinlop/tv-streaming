#!/usr/bin/env python3
"""Resolve working HLS stream URLs into channels.json and js/sources.js.

For every channel in channels.json the script:

1. builds a candidate URL list (current URLs, IPTV-org API URLs, manual extras),
2. verifies each candidate: master playlist, variant playlist, one media segment,
3. orders working URLs by codec score (H.264 first), current URLs first on equal score,
4. rewrites channels.json with ``url`` (first entry) and ``urls`` (fallback list),
5. writes js/sources.js with the candidate URL pool used by the app.

Run: python3 scripts/resolve_streams.py [--dry-run]

Exit code is 0 when every channel keeps at least one working URL, 1 otherwise.
Requires curl. ffprobe is optional and improves ranking (H.264 above MPEG-2).
"""

import json
import shutil
import subprocess
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHANNELS_FILE = ROOT / "channels.json"
SOURCES_FILE = ROOT / "js" / "sources.js"
CONFIG_FILE = Path(__file__).resolve().parent / "streams-config.json"
IPTV_ORG_API = "https://iptv-org.github.io/api/streams.json"

REQUEST_TIMEOUT = 10   # seconds, hard limit for every HTTP request
FFPROBE_TIMEOUT = 25   # seconds, hard limit for one codec probe
USER_AGENT = "tv-streaming-stream-resolver/1.0"

VIDEO_SCORES = {"h264": 3, "hevc": 2, "mpeg2video": 0}
AUDIO_CODECS = {"aac", "mp2", "ac3", "eac3", "mp3"}


def http_text(url):
    """Return the response body as text, or None on any network error."""
    result = subprocess.run(
        ["curl", "-s", "-L", "--max-time", str(REQUEST_TIMEOUT), "-A", USER_AGENT, url],
        capture_output=True,
    )
    if result.returncode != 0:
        return None
    return result.stdout.decode("utf-8", "replace")


def http_ok(url):
    """Return True when the URL answers with HTTP 200."""
    result = subprocess.run(
        [
            "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
            "--max-time", str(REQUEST_TIMEOUT), "-A", USER_AGENT, url,
        ],
        capture_output=True, text=True,
    )
    return result.returncode == 0 and result.stdout.strip() == "200"


def first_entry(playlist):
    """Return the first URI line of a playlist, skipping comments."""
    return _entries(playlist)[0] if _entries(playlist) else None


def last_entry(playlist):
    """Return the newest URI line of a live playlist, skipping comments."""
    entries = _entries(playlist)
    return entries[-1] if entries else None


def _entries(playlist):
    result = []
    for line in playlist.splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            result.append(line)
    return result


def probe_codecs(url):
    """Return the codec names of a stream, or an empty list without ffprobe."""
    if not shutil.which("ffprobe"):
        return []
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error", "-rw_timeout", "20000000",
                "-show_entries", "stream=codec_name",
                "-of", "csv=p=0", url,
            ],
            capture_output=True, text=True, timeout=FFPROBE_TIMEOUT,
        )
    except (subprocess.SubprocessError, OSError):
        return []
    return [
        line.strip().rstrip(",")
        for line in result.stdout.splitlines()
        if line.strip().rstrip(",")
    ]


def score_codecs(codecs):
    """Rank codecs for webOS playback: H.264 video plus a known audio codec."""
    names = set(codecs)
    score = max((VIDEO_SCORES[name] for name in names if name in VIDEO_SCORES), default=0)
    if names & AUDIO_CODECS:
        score += 1
    return score


def probe_playlists(url):
    """Return (ok, detail) after checking both playlists and one media segment.

    Community streams fail transiently, so one failed check is retried once.
    """
    ok, detail = _probe_playlists_once(url)
    if ok:
        return (ok, detail)
    time.sleep(2)
    return _probe_playlists_once(url)


def _probe_playlists_once(url):
    master = http_text(url)
    if not master or "#EXTM3U" not in master:
        return (False, "master playlist")

    if "#EXTINF" in master:
        media_body, media_base = master, url
    else:
        variant = urllib.parse.urljoin(url, first_entry(master) or "")
        media_body = http_text(variant)
        if not media_body or "#EXTINF" not in media_body:
            return (False, "variant playlist")
        media_base = variant

    segment_entry = last_entry(media_body)
    if not segment_entry:
        return (False, "no media segment")
    if not http_ok(urllib.parse.urljoin(media_base, segment_entry)):
        return (False, "media segment")
    return (True, "stream works")


def iptv_org_entries():
    """Return [(channel-name, url)] from the IPTV-org API."""
    body = http_text(IPTV_ORG_API)
    if not body:
        print("warning: IPTV-org API is unreachable", file=sys.stderr)
        return []
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        print("warning: IPTV-org API returned invalid JSON", file=sys.stderr)
        return []
    return [
        (entry.get("channel"), entry["url"])
        for entry in data
        if entry.get("channel") and entry.get("url")
    ]


def dedupe(items):
    seen = set()
    result = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


def probe_candidates(candidates):
    """Check all candidates in parallel, print progress, return {index: ok}."""
    results = {}
    with ThreadPoolExecutor(max_workers=12) as pool:
        futures = {
            pool.submit(probe_playlists, url): (index, url)
            for index, url in enumerate(candidates)
        }
        for future in as_completed(futures):
            index, url = futures[future]
            ok, detail = future.result()
            results[index] = ok
            print("  {} {}  ({})".format("OK  " if ok else "FAIL", url, detail), flush=True)
    return results


def rank_working(candidates, is_existing, working_indexes):
    """Order working URLs by codec score, then current URLs first.

    H.264 streams rank above MPEG-2 streams, because webOS plays H.264 best.
    """
    scores = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(probe_codecs, candidates[i]): i for i in working_indexes}
        for future in as_completed(futures):
            index = futures[future]
            codecs = future.result()
            scores[index] = score_codecs(codecs)
            detail = ",".join(sorted(set(codecs))) if codecs else "no codec data"
            print("  codecs {} {}  ({})".format(candidates[index], detail, scores[index]),
                  flush=True)

    ordered = sorted(
        working_indexes,
        key=lambda i: (-scores.get(i, 0), not is_existing[i], i),
    )
    return dedupe([candidates[i] for i in ordered])


def resolve_channel(channel_id, channel, spec, api_entries):
    """Return (working_urls, candidates) for one channel."""
    existing = channel.get("urls") or ([channel["url"]] if channel.get("url") else [])
    names = set(spec.get("iptv_org", []))
    api_urls = [url for (name, url) in api_entries if name in names]
    candidates = dedupe(existing + list(spec.get("extra_urls", [])) + api_urls)

    print("channel: {} ({} candidates)".format(channel_id, len(candidates)), flush=True)
    results = probe_candidates(candidates)
    working_indexes = [i for i in range(len(candidates)) if results[i]]
    if not working_indexes:
        print("  no working URL found, keeping the previous list", flush=True)
        return ([], candidates)

    is_existing = [url in existing for url in candidates]
    return (rank_working(candidates, is_existing, working_indexes), candidates)


def write_sources_js(config, pools):
    """Write js/sources.js, the candidate URL pool the app ships with."""
    data = {
        "api": IPTV_ORG_API,
        "apiChannelNames": {
            channel_id: spec.get("iptv_org", [])
            for channel_id, spec in config.get("channels", {}).items()
        },
        "urls": pools,
    }
    content = (
        "// Generated by scripts/resolve_streams.py. Do not edit by hand.\n"
        "// Candidate HLS stream URLs per channel. The app tries them in order\n"
        "// after the configured URLs fail, and refreshes the list at runtime\n"
        "// from the IPTV-org API.\n"
        "var StreamSources = "
        + json.dumps(data, indent=2, ensure_ascii=False)
        + ";\n"
    )
    if not SOURCES_FILE.exists() or SOURCES_FILE.read_text() != content:
        SOURCES_FILE.write_text(content)
        print("js/sources.js updated")
    else:
        print("js/sources.js unchanged")


def main():
    if not shutil.which("curl"):
        print("curl is required.", file=sys.stderr)
        return 1
    dry_run = "--dry-run" in sys.argv

    config = json.loads(CONFIG_FILE.read_text())
    max_urls = config.get("max_urls_per_channel", 4)
    max_pool = config.get("max_pool_per_channel", 12)
    channel_specs = config.get("channels", {})

    document = json.loads(CHANNELS_FILE.read_text())
    channels = document["channels"]

    wanted = set()
    for spec in channel_specs.values():
        wanted.update(spec.get("iptv_org", []))
    api_entries = [entry for entry in iptv_org_entries() if entry[0] in wanted]

    failed_channels = []
    pools = {}
    for channel in channels:
        channel_id = channel["id"]
        working, candidates = resolve_channel(
            channel_id, channel, channel_specs.get(channel_id, {}), api_entries
        )
        if not working:
            failed_channels.append(channel_id)
            working = channel.get("urls") or ([channel["url"]] if channel.get("url") else [])
        else:
            channel["url"] = working[0]
            channel["urls"] = working[:max_urls]
            print("  kept: {}".format(", ".join(channel["urls"])), flush=True)
        reserve = [url for url in candidates if url not in working]
        pools[channel_id] = (working + reserve)[:max_pool]

    output = json.dumps(document, indent=2, ensure_ascii=False) + "\n"
    if output != CHANNELS_FILE.read_text():
        if dry_run:
            print("\ndry run: channels.json would change")
        else:
            CHANNELS_FILE.write_text(output)
            print("\nchannels.json updated")
    else:
        print("\nchannels.json unchanged")

    if dry_run:
        print("dry run: js/sources.js would be rewritten for {} channel(s)".format(len(pools)))
    else:
        write_sources_js(config, pools)

    if failed_channels:
        print("failed channels: {}".format(", ".join(failed_channels)), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
