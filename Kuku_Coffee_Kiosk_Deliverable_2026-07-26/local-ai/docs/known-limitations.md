# Known Limitations

- This is a capability demo, not a production accuracy claim.
- Face width is a screen-space proximity proxy, not metric depth.
- Low light, glare, small faces, occlusion and extreme pose can reduce accuracy.
- Anonymous tracking can switch IDs during crossing or occlusion.
- There is no liveness detection or identity recognition.
- The proximity greeting, page-two prompt and confirmed-order thanks use
  separate local WAV files. The Kuku host supplies exact page and order events.
- The Live camera/audio path is validated only on Apple Silicon macOS.
