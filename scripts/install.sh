#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python -m venv .venv
.venv/bin/pip install -r backend/requirements-dev.txt
npm ci --prefix frontend --cache /tmp/jota-npm-cache
npm run build --prefix frontend
