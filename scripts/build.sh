#!/bin/bash
# Builds the webOS package without development files.
#
# Usage: ./scripts/build.sh [--debug]
#   --debug  keeps the code readable for Web Inspector (no minifying)
set -e

cd "$(dirname "$0")/.."

EXCLUDES=(
  -e "*.git*"
  -e "*github*"
  -e "*gitignore*"
  -e "*scripts*"
  -e "*arespackageignore*"
  -e "*sdd*"
  -e "*.md"
  -e "*.ipk"
)

if [ "${1:-}" = "--debug" ]; then
  ares-package --no-minify "${EXCLUDES[@]}" .
else
  ares-package "${EXCLUDES[@]}" .
fi
