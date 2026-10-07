#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SANDBOX="$ROOT/node_modules/electron/dist/chrome-sandbox"

if [[ "$(uname -s)" != Linux ]]; then
  echo "Only needed on Linux."
  exit 0
fi
if [[ ! -f "$SANDBOX" ]]; then
  echo "Missing $SANDBOX — run make install first." >&2
  exit 1
fi

sudo chown root:root "$SANDBOX"
sudo chmod 4755 "$SANDBOX"
echo "OK: $SANDBOX (root:root, mode 4755)"
