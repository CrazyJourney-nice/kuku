#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export OPENVINO_TELEMETRY_OPT_OUT=1 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1
export MPLCONFIGDIR="$ROOT/runtime/matplotlib"
mkdir -p "$MPLCONFIGDIR"
[[ -x "$ROOT/.venv/bin/python" ]] || { echo "Run bootstrap first." >&2; exit 1; }
exec "$ROOT/.venv/bin/python" "$ROOT/scripts/preflight.py" "$@"
