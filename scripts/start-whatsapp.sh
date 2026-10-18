#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci --prefix sidecars/wa-gateway --cache "${TMPDIR:-/tmp}/jota-npm-cache"
exec node scripts/whatsapp.mjs
