# Core Bundle Verification

The focused bundle is verified by:

```bash
shasum -a 256 -c BUNDLE_CONTENTS.sha256
make preflight
make test
make build
```

Current verification result:

- Backend: 42 tests passed.
- Frontend: 11 tests passed and production build completed.
- Safari compatibility: Playwright WebKit E2E passed.
- Live preflight: camera, models, audio and frontend all passed.
- Port guard: occupied ports are rejected and released ports are accepted.

Expected capabilities:

- Live local camera inference.
- Local MediaPipe face landmarks and OpenVINO gaze model loading.
- Anonymous geometric tracking.
- Proximity and attention decisions.
- Mascot eye movement.
- Muted-by-default proximity greeting and 10-second attention follow-up.
- Local host hooks for the exact page-two prompt and confirmed-order thanks.
- Chrome and Playwright WebKit E2E with automatic free-port selection.

Replay, calibration, simulated transactions and autonomous
purchase/dispensing detection are intentionally not part of this bundle. The
host-triggered `order_thanks` clip does not infer or simulate a transaction.
