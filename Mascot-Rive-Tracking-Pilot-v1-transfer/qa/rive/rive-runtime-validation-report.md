# Rive Runtime Validation Report

## Result

**PASS for the Web tracking pilot; PARTIAL against the full authoring plan.**

The exported `.riv` loads in the official Web Canvas runtime, resolves the
specified Artboard, State Machine, ViewModel, and default instance, and responds
to all four normalized aim values.

## Runtime artifact

```text
File:   rive/mascot-tracking-pilot-v1.riv
Size:   30,963 bytes
SHA-256:b8ceb9406be38bc780af6fb49dbde9009c8a3009ffbd683b0564836fb2cd12a9
```

Runtime names found in the exported binary:

```text
MascotTracking_1254
SM_MascotTracking
VM_MascotTracking
MascotTracking_Default
mode
bodyYaw
bodyPitch
eyeX
eyeY
blink
reset
```

The export also contains a legacy ViewModel definition created during authoring
recovery. It is not bound or used by the harness. The connected document was
cleaned after this runtime export, but a second reliable export could not be
completed through the desktop automation surface.

## Web Canvas load

Environment:

```text
Harness: Vite + TypeScript
Runtime: @rive-app/canvas
Layout:  Fit.Contain + Alignment.Center
Browser: Chromium via Playwright CLI
```

Observed status:

```text
Rive runtime active
MascotTracking_1254 · SM_MascotTracking · VM_MascotTracking
```

The only browser console error was a missing `favicon.ico` (HTTP 404). It does
not affect Rive loading or animation.

## Automated tests

```text
Test files: 3 passed
Tests:      18 passed
Build:      PASS
```

Covered behaviours:

- `IDLE → ACQUIRE → TRACK`;
- last-pose `HOLD`, timed `RETURN`, neutral `IDLE`;
- reacquisition interrupting `HOLD` and `RETURN`;
- low-confidence rejection;
- stale-stream loss detection;
- malformed-input `FAULT` and safe recovery;
- deterministic reset;
- viewer-left/viewer-right coordinate direction;
- eye lead followed by reduced residual as body catches up;
- dead-zone jitter suppression;
- idle-only randomized blink;
- One Euro Filter stability, step response, and reset;
- clamp, dead-zone, smoothstep, and frame-rate-independent damping.

## Nine-point visual QA

Captured files:

```text
pose-up-left.png
pose-up.png
pose-up-right.png
pose-left.png
pose-centre.png
pose-right.png
pose-down-left.png
pose-down.png
pose-down-right.png
```

Additional fallback pose:

```text
pose-neutral.png
```

Observed:

- all nine poses render;
- horizontal and vertical direction signs are correct;
- pupils remain inside the visible sclera for the tested range;
- no path tearing, black-fill corruption, cable side swap, or full-character
  snap was observed;
- feet remain fixed while the body scales/translates around its baseline;
- body reaches the intended normalized extrema;
- Web Canvas remains active during all preset changes.

## Check matrix

| Check | Status | Evidence |
| --- | --- | --- |
| `.riv` loads in Web Canvas | PASS | Playwright runtime status |
| Required runtime names resolve | PASS | Active Data Binding and binary strings |
| `bodyYaw/bodyPitch/eyeX/eyeY` respond | PASS | Harness live outputs and 3×3 poses |
| Left/right sign convention | PASS | Unit test and visual pose |
| Eye leads body | PASS | Unit test with early/late residual |
| Dead-zone jitter suppression | PASS | Unit test |
| Low-confidence gating | PASS | Unit test |
| HOLD/RETURN reacquisition | PASS | Unit test |
| Fault/reset neutral fallback | PASS | Unit test |
| Low-frequency idle blink | PASS | Unit test and renderer binding |
| Pupil overflow in 3×3 set | PASS | Screenshot inspection |
| Explicit pupil clipping | NOT IMPLEMENTED | Travel is constrained only |
| State Machine transition graph | NOT IMPLEMENTED | Lifecycle is in TypeScript |
| Rive Blend 1D states | NOT IMPLEMENTED | Internal Data Binding workaround |
| True ±45° perspective morph | NOT IMPLEMENTED | 2.5D transform/parallax pilot |
| `.rev` editable backup | BLOCKED | Desktop backup export unavailable |
| Vending hardware FPS | PENDING | Requires target hardware/spec |

## Production decision

This package is ready for ML-to-screen integration testing and camera
calibration on a desktop or vending-machine prototype.

It is not ready for final character-art sign-off. Before production release:

1. author real topology-preserving left/right path poses in Rive;
2. add explicit sclera clipping;
3. decide whether lifecycle remains in the host controller or is duplicated in
   a fully authored Rive State Machine;
4. export and archive a `.rev` backup;
5. run FPS and thermal validation on the target vending hardware.

