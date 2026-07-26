# Portable Local Vision and Voice Bundle

This package contains the source, local models, audio asset and tests required
to run the focused Live-camera vision and two-stage voice demo on Apple Silicon
macOS. The package bundles separate nearby, no-purchase follow-up and
order-thanks recordings; purchase confirmation remains the responsibility of
the integrating kiosk host.

## Quick start

```bash
make bootstrap
make preflight
make test
make build
make start
```

Open `http://127.0.0.1:8765`.

Use `VENDING_ATTENTION_PORT=9000 make start` to select another port. An
occupied port is rejected without touching the service already using it.

Only the core flow is included: Live camera, anonymous face tracking, proximity,
head pose, gaze, attention, mascot eyes, proximity greeting and attention
follow-up. A localhost host hook can play the bundled page-two and order-thanks
clips, but it does not infer or simulate a transaction. Replay, calibration,
simulated vending transactions and diagnostic operator tools are intentionally
absent.

Generated `.venv`, `node_modules`, `frontend/dist` and runtime caches are not
source artifacts and may be rebuilt by `make bootstrap`.
