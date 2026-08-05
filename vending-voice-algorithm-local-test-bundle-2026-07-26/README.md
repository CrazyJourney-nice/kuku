# Local Vision and Voice Demo

A focused, fully local Apple Silicon macOS demo:

```text
Live camera
→ MediaPipe face landmarks
→ anonymous geometric tracking
→ face-scale proximity
→ OpenCV head pose + OpenVINO gaze
→ attention and visual target decisions
→ MessagePack telemetry
→ linked Rive mascot eyes/body + two-stage local voice
→ local side-by-side React interface
```

The project contains no face recognition, identity matching, cloud inference,
replay mode, calibration workflow, transaction simulator, payment logic or
dispensing controls.

## Core behaviour

- The visual target acquires the first stable face after 250ms; the selected
  anonymous face centre drives the mascot.
- Mascot eyes respond first (~100ms) and the body follows with slower damping
  (~350ms), producing an eye-lead/body-follow turn.
- The local preview, overlays and Rive mascot direction are mirrored
  together; inference continues to use the original camera frame.
- A lost face target returns the whole mascot smoothly to neutral.
- A lost visual target is held for 500ms before a stable handoff.
- Proximity uses smoothed normalized face width, not physical distance.
- Entering the near zone for 700ms triggers `PROXIMITY_GREETING`.
- The same near target continuously attending for 10 seconds triggers
  `ATTENTION_FOLLOW_UP`.
- Each stage is consumed once per near-zone interaction.
- Sound starts muted and can be explicitly enabled in the UI.
- The proximity stage uses `proximity_greeting.wav`.
- The 10-second follow-up uses `quick_buy_prompt.wav`; the Kuku host plays it
  exactly when the visitor enters page two.
- `order_thanks.wav` is bundled for a kiosk host to trigger after confirmed
  order acceptance; this standalone visual demo does not infer purchases.

## Requirements

- Apple Silicon macOS 14+
- Python 3.11 or 3.12
- Node.js 22/npm
- Network access only for the first dependency bootstrap

## Start

```bash
chmod +x scripts/*.sh
make bootstrap
make preflight
npm run dev
```

Open `http://127.0.0.1:5173`, press `Open demo`, then use `Enable sound` if
audio playback is desired. `npm run dev` starts both the frontend and the
visual/voice backend at `127.0.0.1:8765`. If another Kuku development project
already owns that backend, startup reuses it instead of opening the camera a
second time.

The packaged production-style command remains available as `make start`.

To use another port:

```bash
VENDING_ATTENTION_PORT=9000 make start
```

Startup checks the requested port first. If it is already occupied or invalid,
the command exits with an error and does not reuse or terminate the existing
service.

## Test

```bash
make test
make build
```

Browser E2E automatically selects a free loopback port:

```bash
cd frontend
npm run test:e2e:install:safari
npm run test:e2e
```

The default E2E command runs Safari-compatible WebKit. Use
`npm run test:e2e:chrome` for Chrome or `npm run test:e2e:all` for both.
Playwright WebKit tests Safari-engine compatibility; it does not control the
installed Safari application.

## Structure

- `backend/app/perception.py` — face, head-pose and gaze inference.
- `backend/app/tracking.py` — anonymous session-only tracking.
- `backend/app/decision.py` — proximity, attention, target and voice decisions.
- `backend/app/runtime.py` — Live frame pipeline and MessagePack telemetry.
- `backend/app/api.py` — localhost health, session, sound and WebSocket API.
- `frontend/src/` — side-by-side camera, face-linked mascot, sound and
  status UI.
- `frontend/public/mascot-tracking-pilot-v1.riv` — local mascot runtime asset.
- `models/` — bundled local MediaPipe and OpenVINO models.
- `demo_assets/audio/` — three project-provided local voice files.

See `docs/architecture.md` and `docs/known-limitations.md`.
