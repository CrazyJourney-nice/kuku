#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME="$ROOT/runtime"; WHEELHOUSE="$RUNTIME/wheelhouse"; NPM_CACHE="$RUNTIME/npm-cache"
UV="$(command -v uv || true)"
export OPENVINO_TELEMETRY_OPT_OUT=1 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1
export PIP_DISABLE_PIP_VERSION_CHECK=1 npm_config_audit=false npm_config_fund=false
export UV_CONCURRENT_DOWNLOADS=1 UV_CONCURRENT_BUILDS=1 UV_CONCURRENT_INSTALLS=1
export MPLCONFIGDIR="$RUNTIME/matplotlib"
mkdir -p "$RUNTIME" "$WHEELHOUSE" "$NPM_CACHE" "$MPLCONFIGDIR"
[[ -n "$UV" ]] || { echo "UV is required." >&2; exit 1; }
echo "[1/4] Checking Python environment..."
if [[ ! -x "$ROOT/.venv/bin/python" ]]; then
  "$UV" venv --python 3.12 --seed "$ROOT/.venv"
fi
PYTHON="$ROOT/.venv/bin/python"
"$PYTHON" -c 'import sys; raise SystemExit(not ((3,11)<=sys.version_info[:2]<(3,13)))' ||
  { echo "Python 3.11 or 3.12 required; Python 3.11 is preferred." >&2; exit 1; }
if "$PYTHON" -c 'import cv2, fastapi, httpx, mediapipe, msgpack, openvino, pytest; from app.config import ConfigStore' >/dev/null 2>&1; then
  echo "Python dependencies are already ready; skipping reinstall."
else
  echo "Installing Python dependencies with limited UV concurrency..."
  if [[ -f "$RUNTIME/python-resolved.lock" ]] && find "$WHEELHOUSE" -name '*.whl' -print -quit|grep -q .; then
    "$UV" pip install --python "$PYTHON" --no-index --find-links "$WHEELHOUSE" -r "$RUNTIME/python-resolved.lock"
    "$UV" pip install --python "$PYTHON" --no-index --no-build-isolation --no-deps -e "$ROOT/backend"
  else
    "$UV" pip install --python "$PYTHON" -e "$ROOT/backend[test]"
    # Fresh Python 3.12 virtual environments do not include these PEP 517
    # build tools. Pin and cache them so the editable backend can also be
    # installed later with the network physically unavailable.
    "$UV" pip install --python "$PYTHON" setuptools wheel
    "$UV" pip freeze --python "$PYTHON" --exclude-editable >"$RUNTIME/python-resolved.lock"
    "$PYTHON" -m pip download --only-binary=:all: -r "$RUNTIME/python-resolved.lock" -d "$WHEELHOUSE"
  fi
fi
[[ ! -x "$ROOT/.venv/bin/opt_in_out" ]] || "$ROOT/.venv/bin/opt_in_out" --opt_out >/dev/null 2>&1 || true
echo "[2/4] Verifying local models and audio..."
"$PYTHON" "$ROOT/scripts/generate_welcome.py"
"$PYTHON" "$ROOT/scripts/assets.py" fetch
"$PYTHON" "$ROOT/scripts/assets.py" verify
"$PYTHON" -c 'import mediapipe; print(f"MediaPipe {mediapipe.__version__} ready")'
[[ -f "$ROOT/frontend/package-lock.json" ]] || { echo "frontend/package-lock.json required." >&2; exit 1; }
echo "[3/4] Checking frontend dependencies..."
if (cd "$ROOT/frontend" && npm ls --depth=0 >/dev/null 2>&1); then
  echo "Frontend dependencies are already ready; skipping reinstall."
else
  if [[ -f "$RUNTIME/frontend-node_modules.tgz" ]]; then
    echo "Restoring pinned frontend dependencies from the project-local archive..."
    (cd "$ROOT/frontend" && tar -xzf "$RUNTIME/frontend-node_modules.tgz")
  elif [[ -d "$NPM_CACHE/_cacache" ]]; then
    (cd "$ROOT/frontend" && npm ci --offline --cache "$NPM_CACHE")
  else
    (cd "$ROOT/frontend" && npm ci --cache "$NPM_CACHE")
  fi
fi
echo "[4/4] Building frontend..."
(cd "$ROOT/frontend" && npm run build)
echo "Bootstrap complete."
