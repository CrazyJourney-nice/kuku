import { describe, expect, it } from "vitest";
import { makeFixturePacket } from "../fixture";
import { packetToVisualTargetSample } from "./visualTargetAdapter";

describe("backend visual target → mascot adapter", () => {
  it("uses the existing backend face-centre target and mirrors it into animation space", () => {
    const packet = makeFixturePacket();
    packet.mascot_state.target = { x: -0.4, y: 0.25 };

    expect(packetToVisualTargetSample(packet, 1234)).toEqual({
      targetPresent: true,
      targetX: 0.4,
      targetY: -0.25,
      confidence: 0.96,
      timestampMs: 1234,
    });
  });

  it("does not depend on the selected person's gaze result", () => {
    const packet = makeFixturePacket();
    packet.tracks[0]!.gaze = null;

    expect(packetToVisualTargetSample(packet, 99)).toMatchObject({
      targetPresent: true,
      targetX: -packet.mascot_state.target.x,
      targetY: -packet.mascot_state.target.y,
    });
  });

  it("preserves the backend target during its existing loss-grace hold", () => {
    const packet = makeFixturePacket();
    packet.tracks = packet.tracks.filter((track) => track.track_id !== 17);

    expect(packetToVisualTargetSample(packet, 100)).toMatchObject({
      targetPresent: true,
      confidence: 1,
    });
  });
});
