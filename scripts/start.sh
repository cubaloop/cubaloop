#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export JOTA_DATA_DIR="${JOTA_DATA_DIR:-$PWD/.local/data}"
exec .venv/bin/python -m backend.app
