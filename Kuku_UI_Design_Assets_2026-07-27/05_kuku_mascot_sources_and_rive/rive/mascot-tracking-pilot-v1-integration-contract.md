# Mascot Rive Tracking Pilot v1 — Integration Contract

## Delivery status

This package contains a working Web Canvas pilot and an exported runtime
`mascot-tracking-pilot-v1.riv`.

The runtime has been loaded successfully by `@rive-app/canvas` in the supplied
Vite harness. The controller, filtering, lifecycle, eye-lead/body-follow
behaviour, fault handling, reset, randomized idle blink, and nine-point pose
controls are implemented.

Two planned authoring items are not represented as production-grade Rive
content:

1. The current Rive MCP authoring surface could create animation timelines and
   State Machine layers, but could not create a valid `Blend 1D` state or attach
   a timeline to a newly created animation state. Lifecycle and blending
   therefore run in the TypeScript controller and drive Rive through Data
   Binding.
2. Horizontal aim is a topology-preserving 2.5D transform/parallax rig. It is
   not a completed hand-authored ±45° perspective vertex morph.

The editable `.rev` backup was not exported. The desktop editor exposed runtime
export, but its backup-export menu was not available to the automation surface.
Do not rename the `.riv` file to `.rev`; the formats are not interchangeable.

## ML input

```ts
export interface NormalizedTrackingSample {
  targetPresent: boolean
  targetX: number       // -1 viewer-left → +1 viewer-right
  targetY: number       // -1 down → +1 up
  confidence: number    // 0...1
  timestampMs: number
}
```

Contract rules:

- `targetX` and `targetY` must be finite. The controller clamps them to
  `-1...1`.
- `timestampMs` must be monotonic for the selected stream.
- `confidence < 0.65` does not replace the current locked target.
- `targetPresent=false` declares loss immediately.
- Camera mirroring must be corrected upstream. `targetX=-1` always means the
  viewer's left side of the physical screen.
- The adapter supplies one already-selected person. Multi-person policy and
  identity tracking are outside this package.

## Rive runtime names

```text
Artboard:        MascotTracking_1254
State Machine:   SM_MascotTracking
ViewModel:       VM_MascotTracking
Default instance:MascotTracking_Default
```

Public ViewModel properties:

```text
mode:      String = IDLE
bodyYaw:   Number = 0   // normalized -1...1; maps to ±45°
bodyPitch: Number = 0   // normalized -1...1; maps to ±18°
eyeX:      Number = 0   // normalized -1...1 residual gaze
eyeY:      Number = 0   // normalized -1...1 residual gaze
blink:     Trigger
reset:     Trigger
```

`mode` is a String in this pilot. The connected MCP authoring API did not
expose creation of a Rive `DataEnum`, so consumers must not assume an Enum
property.

Allowed mode values:

```text
IDLE | ACQUIRE | TRACK | HOLD | RETURN | FAULT
```

Internal ViewModel properties:

```text
_bodyScaleX
_faceOffsetX
_bodyScaleY
_faceOffsetY
_pupilLX
_pupilRX
_pupilLY
_pupilRY
_blinkScale
```

Names beginning with `_` are renderer implementation details. ML adapters must
never write them.

## Controller ownership

`TrackingController` owns:

- confidence gating;
- One Euro Filter input smoothing;
- dead zones;
- lifecycle timing;
- eye lead and body damping;
- lost-target hold and return;
- stale-stream detection;
- fault recovery;
- randomized idle blink.

Rive owns:

- vector drawing;
- hierarchy and pivots;
- transform application through Data Binding;
- fixed background;
- fixed feet;
- eye, face, and body visual response.

The State Machine contains the required layer names as an authoring scaffold:

```text
LIFECYCLE
BODY_YAW_BLEND
BODY_PITCH_BLEND
EYE_X_BLEND
EYE_Y_BLEND
BLINK
```

Only the default neutral state is connected inside the `.riv`. Do not move the
controller lifecycle into Rive without first authoring and validating real
Blend States and transition conditions in the Rive Editor.

## Timing defaults

```text
Confidence threshold: 0.65
Horizontal dead zone: 0.08
Vertical dead zone:   0.10
Acquire stability:    300 ms
Lost-target hold:     650 ms
Return centre:        700 ms
Stale sample:         400 ms
Fault recovery:       150 ms
Eye response:         ~100 ms
Body response:        ~350 ms
Idle blink:           randomized every 4–8 s
```

Lifecycle:

```text
IDLE → ACQUIRE → TRACK
TRACK → HOLD → RETURN → IDLE
HOLD/RETURN → TRACK on valid reacquisition
Any controller state → FAULT on malformed input
FAULT → IDLE after safe recovery
Any controller state → IDLE on reset
```

## Aim mapping

The controller computes:

```text
desiredYaw   = filteredX × 45°
desiredPitch = filteredY × 18°

bodyYawGoal:
  0 inside ±8°
  smoothstep to ±1 outside the dead zone

bodyPitchGoal:
  0 inside ±6°
  smoothstep to ±1 outside the dead zone

eyeYawGoal:
  clamp(desiredYaw - currentBodyYaw, -12°, +12°) / 12°

eyePitchGoal:
  clamp(desiredPitch - currentBodyPitch, -10°, +10°) / 10°
```

The renderer converts normalized public values into internal transforms:

```text
body scale X = 1 - 0.14 × abs(bodyYaw)
face offset X = 32 × bodyYaw
body scale Y = 1 + 0.04 × bodyPitch
face offset Y = -18 × bodyPitch
pupil X travel = ±18 px
pupil Y travel = ±12 px
```

This produces a readable pilot turn while preserving path topology. It is not a
substitute for manually authored perspective poses.

## Web integration

The supplied harness uses:

```ts
new Rive({
  buffer,
  canvas,
  artboard: "MascotTracking_1254",
  stateMachines: "SM_MascotTracking",
  autoplay: true,
  autoBind: true,
  layout: new Layout({
    fit: Fit.Contain,
    alignment: Alignment.Center,
  }),
})
```

Use `TrackingSource` as the adapter boundary:

```ts
export interface TrackingSource {
  start(onSample: (sample: NormalizedTrackingSample) => void): void
  stop(): void
}
```

`WebSocketTrackingSource` is included as a production transport starting point.
The WebSocket message must deserialize to `NormalizedTrackingSample`.

## Screen and hardware rules

- Preserve the 1254×1254 artboard ratio.
- Use `contain` and letterbox non-square displays; do not crop.
- Calibrate camera coordinates to the physical screen before emitting samples.
- Keep the camera adapter responsible for mirroring and person selection.
- Validate final FPS on the actual vending-machine hardware. The desktop
  harness reports FPS and frame time but does not define a hardware threshold.

## Known visual limitations

- No Rive clipping mask was authored for pupils. Travel is constrained and the
  supplied 3×3 screenshots show no overflow, but a production file should add
  explicit sclera clipping.
- The Rive recreation is not pixel-identical to the Illustrator master.
  Compound cable/bezel highlight details are visibly simplified at runtime.
- The current body yaw is transform/parallax based. True ±45° side geometry
  still requires manual topology-preserving path authoring against the supplied
  directional references.

