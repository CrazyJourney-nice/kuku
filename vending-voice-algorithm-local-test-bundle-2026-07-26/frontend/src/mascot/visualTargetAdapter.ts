import type { DemoFramePacket } from "../contracts";
import { clampUnit } from "./tracking/math";
import type { NormalizedTrackingSample } from "./tracking/types";

export function packetToVisualTargetSample(
  packet: DemoFramePacket | null,
  timestampMs: number,
): NormalizedTrackingSample {
  const track = packet?.tracks.find(
    (candidate) => candidate.track_id === packet.visual_target_id,
  );
  const targetPresent = Boolean(
    packet &&
      packet.visual_target_id !== null &&
      packet.mascot_state.command_id !== null,
  );
  const target = packet?.mascot_state.target ?? { x: 0, y: 0 };

  return {
    targetPresent,
    // ScreenEyeAdapter already publishes the backend-selected face centre in
    // normalized coordinates. Mirror it exactly like the camera preview.
    targetX: targetPresent ? clampUnit(-target.x) : 0,
    // Backend screen coordinates are positive-down; the animation is positive-up.
    targetY: targetPresent ? clampUnit(-target.y) : 0,
    // During the backend's target-loss grace period the selected track may be
    // absent from this frame, but mascot_state.target intentionally stays held.
    confidence: targetPresent ? (track?.face_confidence ?? 1) : 0,
    timestampMs,
  };
}
