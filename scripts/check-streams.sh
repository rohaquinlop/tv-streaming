#!/bin/bash
# Validates every HLS stream URL in channels.json.
# It checks the master playlist, the variant playlist, one media segment,
# and (when ffprobe is installed) the audio and video codecs.
#
# Usage:
#   ./scripts/check-streams.sh [path-to-channels.json]
#
# To watch a stream on this computer, run:
#   ffplay <url>
#
# Exit code is 0 when all URLs pass, 1 otherwise.

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="${1:-$ROOT/channels.json}"

if [ ! -f "$FILE" ]; then
  echo "File not found: $FILE" >&2
  exit 1
fi

if ! command -v curl > /dev/null; then
  echo "curl is required." >&2
  exit 1
fi

TIMEOUT=10
FAILURES=0
CHECKED=0

# Prints one line per stream URL: <channel-id><TAB><position><TAB><url>
URL_LIST=$(python3 - "$FILE" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
for channel in data.get('channels', []):
    cid = channel.get('id', '?')
    urls = channel.get('urls') or ([channel['url']] if channel.get('url') else [])
    for i, url in enumerate(urls):
        print('\t'.join([cid, str(i + 1), url]))
PY
)

resolve() {
  # resolve <base-url> <playlist-entry>
  case "$2" in
    http://*|https://*) echo "$2" ;;
    /*) echo "${1%%://*}://$(echo "$1" | sed -E 's#^[a-z]+://([^/]+)/.*#\1#')$2" ;;
    *) echo "$(dirname "$1")/$2" ;;
  esac
}

first_entry() {
  # first_entry <playlist-body>  -> first non-comment, non-empty line
  echo "$1" | grep -v '^#' | grep -v '^[[:space:]]*$' | head -1
}

while IFS=$'\t' read -r cid pos url; do
  [ -z "$url" ] && continue
  CHECKED=$((CHECKED + 1))
  label="$cid #$pos $url"

  master=$(curl -s --max-time "$TIMEOUT" "$url")
  if ! echo "$master" | grep -q '#EXTM3U'; then
    echo "FAIL (master playlist)  $label"
    FAILURES=$((FAILURES + 1))
    continue
  fi

  variant=$(resolve "$url" "$(first_entry "$master")")
  variant_body=$(curl -s --max-time "$TIMEOUT" "$variant")
  if ! echo "$variant_body" | grep -q '#EXTINF'; then
    echo "FAIL (variant playlist) $label"
    FAILURES=$((FAILURES + 1))
    continue
  fi

  segment=$(resolve "$variant" "$(echo "$variant_body" | grep -v '^#' | grep -v '^[[:space:]]*$' | tail -1)")
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$segment")
  if [ "$code" != "200" ]; then
    echo "FAIL (segment $code)      $label"
    FAILURES=$((FAILURES + 1))
    continue
  fi

  codec=""
  if command -v ffprobe > /dev/null; then
    codec=$(timeout 25 ffprobe -v error \
      -show_entries stream=codec_type,codec_name,width,height \
      -of csv=p=0 "$url" 2> /dev/null | grep -v '^$' | sort -u | tr '\n' ' ')
  fi

  if [ -n "$codec" ]; then
    echo "OK   $label"
    echo "       codecs: $codec"
  else
    echo "OK   $label"
  fi
done <<< "$URL_LIST"

echo
echo "Checked $CHECKED stream URLs, $FAILURES failed."
[ "$FAILURES" -eq 0 ] || exit 1
