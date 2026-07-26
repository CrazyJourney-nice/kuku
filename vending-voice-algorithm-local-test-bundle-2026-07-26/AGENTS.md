# AGENTS.md — Core Local Vision and Voice Demo

## Scope

Preserve only this runtime path:

```text
Live camera → local face/head/gaze inference → anonymous tracking
→ proximity and attention decisions → mascot eyes → two-stage local voice
```

Do not add replay, biometric identity, cloud inference, calibration UI,
transaction/payment logic, dispensing controls or remote audio.

## Supported environment

- Apple Silicon macOS 14+
- Python 3.11/3.12
- Node.js 22/npm
- Localhost-only runtime

Use UV for Python environment management:

```bash
uv python install 3.12
uv venv --python 3.12 --seed .venv
make bootstrap
```

## Core files

- `backend/app/perception.py` — MediaPipe, OpenCV and OpenVINO inference.
- `backend/app/tracking.py` — anonymous geometric track continuity.
- `backend/app/decision.py` — proximity, attention, target and voice policy.
- `backend/app/runtime.py` — Live orchestration and telemetry.
- `backend/app/api.py` — localhost core API.
- `frontend/src/` — focused visual and sound interface.
- `config/demo.defaults.json` — fixed core policy.

## Safety

- Never describe face-width ratio as metric distance.
- Never persist faces, embeddings or biometric identifiers.
- Keep inference and audio local.
- Keep sound muted until the operator explicitly enables it.
- Reset visual, proximity and voice state on stale frames, fault and stop.

## Verification

```bash
make preflight
make test
make build
cd frontend && npm run test:e2e
```

E2E startup must select a free loopback port and must not reuse an occupied
service.
