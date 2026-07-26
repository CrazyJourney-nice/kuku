import { describe, expect, it } from "vitest";
import { isDemoFramePacket } from "./contracts";
import { makeFixturePacket } from "./fixture";

describe("DemoFramePacket contract guard", () => {
  it("accepts the typed fixture packet", () => {
    expect(isDemoFramePacket(makeFixturePacket())).toBe(true);
  });

  it("rejects stale or malformed cross-frame payloads", () => {
    const packet = makeFixturePacket();
    expect(isDemoFramePacket({ ...packet, frame_id: "1842" })).toBe(false);
    expect(isDemoFramePacket({ ...packet, queue_depth: 2 })).toBe(false);
    expect(isDemoFramePacket({ ...packet, visual_target_id: "17" })).toBe(false);
    expect(isDemoFramePacket({ ...packet, visual_target_reason: null })).toBe(false);
    expect(isDemoFramePacket({ ...packet, proximity: { ...packet.proximity, state: "CLOSE" } })).toBe(false);
    expect(isDemoFramePacket({ ...packet, proximity: { ...packet.proximity, entered: 1 } })).toBe(false);
    expect(isDemoFramePacket({ ...packet, voice_journey: { ...packet.voice_journey, state: "WAITING" } })).toBe(false);
    expect(isDemoFramePacket({ ...packet, voice_journey: { ...packet.voice_journey, triggered_stage: "FOLLOW_UP" } })).toBe(false);
    expect(isDemoFramePacket({ ...packet, voice_journey: { ...packet.voice_journey, attention_followup_triggered: 1 } })).toBe(false);
    expect(isDemoFramePacket({ ...packet, voice_journey: { ...packet.voice_journey, completed_stages: ["PROXIMITY_GREETING", "UNKNOWN"] } })).toBe(false);
    expect(isDemoFramePacket({ ...packet, voice_journey: { ...packet.voice_journey, attention_dwell_ms: -1 } })).toBe(false);
    expect(isDemoFramePacket({ ...packet, tracks: [{ ...packet.tracks[0], gaze: { x: NaN, y: 0 } }] })).toBe(false);
  });

  it("accepts a one-shot attention follow-up trigger", () => {
    const packet = makeFixturePacket();
    const triggered = {
      ...packet,
      voice_journey: {
        ...packet.voice_journey,
        state: "FOLLOWED_UP",
        triggered_stage: "ATTENTION_FOLLOW_UP",
      },
    };
    expect(isDemoFramePacket(triggered)).toBe(true);
  });
});
