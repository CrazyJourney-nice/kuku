# Known Limitations

- This is a capability demo, not a production accuracy claim.
- Face width is a screen-space proximity proxy, not metric depth.
- Low light, glare, small faces, occlusion and extreme pose can reduce accuracy.
- Anonymous tracking can switch IDs during crossing or occlusion.
- There is no liveness detection or identity recognition.
- The standalone visual algorithm cannot know the kiosk's exact page transition
  or infer a completed purchase. It
  bundles the `order_thanks` clip for an authorized kiosk host to trigger from
  its own confirmed order state.
- The Live camera/audio path is validated only on Apple Silicon macOS.
