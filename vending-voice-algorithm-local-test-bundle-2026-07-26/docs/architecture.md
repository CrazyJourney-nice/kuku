# Core Architecture

```text
MacBook camera
→ capacity-one latest-frame queue
→ MediaPipe Face Landmarker
→ anonymous geometric tracker
→ normalized face-width proximity evaluator
→ OpenCV solvePnP head pose
→ OpenVINO gaze estimation
→ filtered attention and target arbitration
→ two-stage local afplay voice adapter
→ MessagePack WebSocket
→ existing backend visual-target adapter
→ eye-lead/body-follow tracking controller
→ Rive Data Binding renderer
→ React camera-left / mascot-right UI
```

The frontend maps the existing backend-selected face-centre target to the
animation controller's normalized `-1...1` coordinate space. It does not
replace or reinterpret the backend's anonymous tracking, first-stable-face
selection, loss grace or handoff policy. The animation layer applies only
visual smoothing: fast eye damping and slower body damping. Only anonymous
frame telemetry crosses the localhost WebSocket boundary.

## Voice journey

```text
NEAR_ENTERED
→ PROXIMITY_GREETING
→ same near target ATTENDING continuously for 10 seconds
→ ATTENTION_FOLLOW_UP
```

The journey resets when the near-zone episode clears. Muting affects playback,
not the one-shot logical trigger.

The two visual stages use separate project-provided recordings:
`proximity_greeting.wav` for a nearby visitor and
`quick_buy_prompt.wav` for the page-two prompt. `order_thanks.wav` is also bundled
and routed by the local player, but the standalone algorithm does not invent a
purchase signal; the kiosk host must trigger it only after order confirmation.

## Local boundary

The server binds to loopback, models and audio are local, and the runtime socket
guard rejects non-loopback Python network activity.
