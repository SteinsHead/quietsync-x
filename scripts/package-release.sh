#!/usr/bin/env bash
set -euo pipefail

version="$(node -p "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')).version")"
archive="release/quietsync-x-${version}.zip"

mkdir -p release
rm -f "$archive"
zip -q -r "$archive" \
  manifest.json \
  src \
  sample \
  assets/icons/icon-16.png \
  assets/icons/icon-32.png \
  assets/icons/icon-48.png \
  assets/icons/icon-128.png \
  LICENSE \
  PRIVACY.md \
  SECURITY.md \
  -x "*.DS_Store"

echo "$archive"
