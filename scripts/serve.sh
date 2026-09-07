#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "Saudade needs Node.js and npm installed before it can start."
  exit 1
fi

# A partial installation can leave the folder present but omit build tools.
if [[ ! -x node_modules/.bin/vite || ! -x node_modules/.bin/tsc || ! -x node_modules/.bin/tsx ]]; then
  echo "Installing Saudade's missing development tools…"
  npm install --include=dev
fi

if [[ ! -d public/audio/nz ]] || [[ -z "$(ls -A public/audio/nz 2>/dev/null || true)" ]]; then
  npm run download:audio
fi

npm run build
exec npm run serve
