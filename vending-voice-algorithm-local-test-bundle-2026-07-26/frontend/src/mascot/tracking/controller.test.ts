import { describe, expect, it } from "vitest";
import { TrackingController } from "./controller";

describe("face-target-linked mascot controller", () => {
  it("moves eyes ahead of the slower body, then lets the body catch up", () => {
    const controller = new TrackingController({}, () => 0);
    for (let now = 0; now <= 330; now += 30) {
      controller.ingest({
        targetPresent: true,
        targetX: 1,
        targetY: 0,
        confidence: 0.96,
        timestampMs: now,
      });
      controller.tick(now);
    }
    const early = controller.output;
    expect(early.mode).toBe("TRACK");
    expect(Math.abs(early.eyeX)).toBeGreaterThan(Math.abs(early.bodyYaw));

    for (let now = 360; now <= 2400; now += 30) {
      controller.ingest({
        targetPresent: true,
        targetX: 1,
        targetY: 0,
        confidence: 0.96,
        timestampMs: now,
      });
      controller.tick(now);
    }
    expect(controller.output.bodyYaw).toBeGreaterThan(0.98);
    expect(Math.abs(controller.output.eyeX)).toBeLessThan(0.05);
  });

  it("holds, then returns the whole mascot to neutral after gaze loss", () => {
    const controller = new TrackingController({}, () => 0);
    for (let now = 0; now <= 330; now += 30) {
      controller.ingest({
        targetPresent: true,
        targetX: -0.8,
        targetY: 0.5,
        confidence: 0.96,
        timestampMs: now,
      });
      controller.tick(now);
    }
    controller.ingest({
      targetPresent: false,
      targetX: 0,
      targetY: 0,
      confidence: 0,
      timestampMs: 350,
    });
    expect(controller.tick(350).mode).toBe("HOLD");
    expect(controller.tick(1000).mode).toBe("RETURN");
    expect(controller.tick(1700)).toMatchObject({
      mode: "IDLE",
      bodyYaw: 0,
      bodyPitch: 0,
      eyeX: 0,
      eyeY: 0,
    });
  });
});
