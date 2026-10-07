#!/usr/bin/env bash
# Launch Electron from the repo root. On Linux, use --no-sandbox when the
# bundled chrome-sandbox is not setuid (common in local dev). Packaged installs
# use /opt/vssh/chrome-sandbox — see README (fix-linux-sandbox / .deb postinst).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ELECTRON="$ROOT/node_modules/.bin/electron"
if [[ ! -x "$ELECTRON" ]]; then
  echo "Electron not found. Run: make install" >&2
  exit 127
fi

EXTRA=()
SANDBOX="$ROOT/node_modules/electron/dist/chrome-sandbox"
if [[ "$(uname -s)" == Linux ]] && [[ -f "$SANDBOX" ]] && [[ ! -u "$SANDBOX" ]]; then
  EXTRA=(--no-sandbox)
fi

exec "$ELECTRON" "${EXTRA[@]}" "$@"
