#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="$ROOT/.venv/bin/python"; HOST="${VENDING_ATTENTION_HOST:-127.0.0.1}"; PORT="${VENDING_ATTENTION_PORT:-8765}"
[[ "$HOST" == "127.0.0.1" || "$HOST" == "localhost" ]] || { echo "localhost bind required" >&2; exit 1; }
[[ -x "$PYTHON" ]] || { echo "Run bootstrap first." >&2; exit 1; }
[[ -f "$ROOT/frontend/dist/index.html" ]] || { echo "Local frontend build missing." >&2; exit 1; }
"$PYTHON" "$ROOT/scripts/check_port.py" "$HOST" "$PORT"
export OPENVINO_TELEMETRY_OPT_OUT=1 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1
export VENDING_ATTENTION_OFFLINE_GUARD=1 VENDING_ATTENTION_ROOT="$ROOT"
export MPLCONFIGDIR="$ROOT/runtime/matplotlib"
export PYTHONPATH="$ROOT/scripts/offline_guard:$ROOT/backend${PYTHONPATH:+:$PYTHONPATH}"
mkdir -p "$MPLCONFIGDIR"; "$PYTHON" "$ROOT/scripts/assets.py" verify >/dev/null
cd "$ROOT/backend"; exec "$PYTHON" -m uvicorn app.main:app --host "$HOST" --port "$PORT"
