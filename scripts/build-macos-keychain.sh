#!/bin/bash
# Build the macOS Touch ID keychain helper (darwin only).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/native/macos-keychain/main.swift"
OUT="$ROOT/native/macos-keychain/vssh-keychain"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Skipping macOS keychain helper (not on Darwin)." >&2
  exit 0
fi

if ! command -v swiftc >/dev/null 2>&1; then
  echo "swiftc not found. Install Xcode Command Line Tools." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"
swiftc -O \
  -framework Security \
  -framework LocalAuthentication \
  -o "$OUT" \
  "$SRC"

echo "✓ Wrote $OUT"
