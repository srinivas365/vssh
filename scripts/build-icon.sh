#!/bin/bash
# Build macOS .icns and a 512x512 PNG from build/icon.svg.
# Requires: rsvg-convert (brew install librsvg), iconutil (built-in macOS).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SVG="$ROOT/build/icon.svg"
ICONSET="$ROOT/build/icon.iconset"
ICNS="$ROOT/build/icon.icns"
PNG="$ROOT/build/icon.png"

if [ ! -f "$SVG" ]; then
  echo "Missing $SVG" >&2
  exit 1
fi

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "rsvg-convert not found. Install with: brew install librsvg" >&2
  exit 1
fi

rm -rf "$ICONSET" "$ICNS" "$PNG"
mkdir -p "$ICONSET"

# macOS iconset requires these exact filenames and sizes.
declare -a SIZES=(
  "16:icon_16x16.png"
  "32:icon_16x16@2x.png"
  "32:icon_32x32.png"
  "64:icon_32x32@2x.png"
  "128:icon_128x128.png"
  "256:icon_128x128@2x.png"
  "256:icon_256x256.png"
  "512:icon_256x256@2x.png"
  "512:icon_512x512.png"
  "1024:icon_512x512@2x.png"
)

for entry in "${SIZES[@]}"; do
  size="${entry%%:*}"
  name="${entry##*:}"
  echo "  rendering $name at ${size}px"
  rsvg-convert -w "$size" -h "$size" "$SVG" -o "$ICONSET/$name"
done

# Standalone 512x512 PNG for Linux / dev use.
cp "$ICONSET/icon_256x256@2x.png" "$PNG"

# Compile the iconset into an .icns.
iconutil -c icns -o "$ICNS" "$ICONSET"

echo ""
echo "✓ Wrote $ICNS"
echo "✓ Wrote $PNG"
ls -lh "$ICNS" "$PNG"
