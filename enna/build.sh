#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"
git merge-base --is-ancestor 7d14f385435a8bb11a4c0cfc7015e18cf19b7841 HEAD
export TZ=Europe/Berlin
# Identify this candidate separately from the previously validated P2P-only image.
export LIB_JITSI_MEET_COMMIT_HASH=7d14f385-enna-safari-preview
npm ci --no-audit --no-fund
node --check enna/image-inputs.mjs
npm run gen-version
npm run lint
npm run test:native -- --reporters dots
npm run test:polyfill -- --reporters dots
npm run build
node enna/image-inputs.mjs
