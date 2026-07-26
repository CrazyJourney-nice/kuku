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
→ mascot-eye adapter
→ two-stage local afplay voice adapter
→ MessagePack WebSocket
→ React camera and eyes UI
```

## Voice journey

```text
NEAR_ENTERED
→ PROXIMITY_GREETING
→ same near target ATTENDING continuously for 10 seconds
→ ATTENTION_FOLLOW_UP
```

The journey resets when the near-zone episode clears. Muting affects playback,
not the one-shot logical trigger.

The Kuku host resets the autonomous follow-up after the proximity greeting,
plays `quick_buy_prompt` at the actual transition into page two, and plays
`order_thanks` only after its order is accepted.

## Local boundary

The server binds to loopback, models and audio are local, and the runtime socket
guard rejects non-loopback Python network activity.
