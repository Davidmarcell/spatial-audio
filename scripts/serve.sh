#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d node_modules ]]; then
  npm install
fi

if [[ ! -d public/audio/nz ]] || [[ -z "$(ls -A public/audio/nz 2>/dev/null || true)" ]]; then
  npm run download:audio
fi

npm run build
exec npm run serve
