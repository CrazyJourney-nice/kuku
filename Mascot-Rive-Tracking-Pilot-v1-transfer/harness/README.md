# Mascot Rive Tracking Harness

Interactive Vite + TypeScript validation harness for the vending-machine mascot.
It implements the approved ML-to-animation controller independently from the
Rive artwork, so lifecycle and gaze behavior can be tested before the final
`.riv` is available.

## Run

```bash
npm ci
npm run dev
```

Node.js `^20.19.0` or `>=22.12.0` is required for development and rebuilds.
The production build bundles the matching Rive WASM locally and does not depend
on a CDN at runtime.

The Vite public directory points to `../rive`. When
`../rive/mascot-tracking-pilot-v1.riv` exists, the page loads it automatically
at `./mascot-tracking-pilot-v1.riv`. If it is missing, invalid, or does not expose
the required ViewModel properties, the harness displays its built-in SVG
fallback and keeps all simulation controls active.

## Verify

```bash
npm test
npm run build
npm run preview
```

The test suite uses deterministic timestamps and covers coordinate direction,
confidence rejection, acquisition, tracking, stale input, hold, return,
reacquisition, fault recovery, reset, dead zones, One Euro filtering,
eye-leading/body-follow behavior, and idle blinking.

## ML input

```ts
interface NormalizedTrackingSample {
  targetPresent: boolean;
  targetX: number; // -1 viewer-left → +1 viewer-right
  targetY: number; // -1 down → +1 up
  confidence: number;
  timestampMs: number;
}
```

Implement `TrackingSource` from `src/tracking/types.ts` for the production ML
transport. A minimal `WebSocketTrackingSource` adapter is included in
`src/tracking/sources.ts`.

## Required Rive contract

- Artboard: `MascotTracking_1254`
- State Machine: `SM_MascotTracking`
- ViewModel: `VM_MascotTracking`
- Default instance: `MascotTracking_Default`
- String: `mode`
- Numbers: `bodyYaw`, `bodyPitch`, `eyeX`, `eyeY`
- Triggers: `blink`, `reset`

All four number properties use a normalized `-1...1` range.

The runtime file also contains internal, underscore-prefixed numeric bindings
used to convert the public normalized contract into Rive transforms:
`_bodyScaleX`, `_faceOffsetX`, `_bodyScaleY`, `_faceOffsetY`, `_pupilLX`,
`_pupilRX`, `_pupilLY`, `_pupilRY`, and `_blinkScale`. They are implementation
details and must not be written by an ML adapter.
