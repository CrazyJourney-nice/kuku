import { describe, expect, it } from "vitest";
import { TrackingController } from "../src/tracking/controller";
import type { NormalizedTrackingSample } from "../src/tracking/types";

const sample = (
  timestampMs: number,
  overrides: Partial<NormalizedTrackingSample> = {},
): NormalizedTrackingSample => ({
  targetPresent: true,
  targetX: 0,
  targetY: 0,
  confidence: 0.92,
  timestampMs,
  ...overrides,
});

const acquire = (
  controller: TrackingController,
  targetX = 0,
  targetY = 0,
): void => {
  for (let timestampMs = 0; timestampMs <= 330; timestampMs += 30) {
    controller.ingest(sample(timestampMs, { targetX, targetY }));
    controller.tick(timestampMs);
  }
};

describe("TrackingController lifecycle", () => {
  it("moves IDLE → ACQUIRE → TRACK after stable evidence", () => {
    const controller = new TrackingController({}, () => 0);
    controller.ingest(sample(0, { targetX: -0.8 }));
    expect(controller.tick(0).mode).toBe("ACQUIRE");
    controller.ingest(sample(299, { targetX: -0.8 }));
    expect(controller.tick(299).mode).toBe("ACQUIRE");
    controller.ingest(sample(300, { targetX: -0.8 }));
    expect(controller.tick(300).mode).toBe("TRACK");
  });

  it("holds the last pose, returns, then settles at neutral", () => {
    const controller = new TrackingController({}, () => 0);
    acquire(controller, 1, 0.5);
    const beforeLoss = controller.tick(340);

    controller.ingest(sample(350, { targetPresent: false }));
    expect(controller.tick(350).mode).toBe("HOLD");
    expect(controller.tick(999).mode).toBe("HOLD");
    expect(controller.tick(1_000).mode).toBe("RETURN");
    expect(controller.tick(1_699).mode).toBe("RETURN");
    const neutral = controller.tick(1_700);
    expect(neutral.mode).toBe("IDLE");
    expect(neutral.bodyYaw).toBe(0);
    expect(neutral.bodyPitch).toBe(0);
    expect(neutral.eyeX).toBe(0);
    expect(neutral.eyeY).toBe(0);
    expect(beforeLoss.bodyYaw).toBeGreaterThan(0);
  });

  it("interrupts HOLD and RETURN immediately when the target is reacquired", () => {
    const controller = new TrackingController({}, () => 0);
    acquire(controller, -1);
    controller.ingest(sample(350, { targetPresent: false }));
    controller.tick(1_000);
    expect(controller.output.mode).toBe("RETURN");

    controller.ingest(sample(1_010, { targetX: 0.6 }));
    expect(controller.tick(1_010).mode).toBe("TRACK");
  });

  it("does not replace a locked target with a low-confidence sample", () => {
    const controller = new TrackingController({}, () => 0);
    acquire(controller, 0.7);
    const locked = controller.output.targetX;
    controller.ingest(
      sample(350, {
        targetX: -1,
        targetY: -1,
        confidence: 0.4,
      }),
    );
    const afterRejectedSample = controller.tick(350);
    expect(afterRejectedSample.mode).toBe("TRACK");
    expect(afterRejectedSample.targetX).toBe(locked);
    expect(afterRejectedSample.targetY).toBe(0);
  });

  it("treats a stopped ML stream as a lost target", () => {
    const controller = new TrackingController(
      { staleSampleMs: 100 },
      () => 0,
    );
    acquire(controller, 0.5);
    expect(controller.tick(431).mode).toBe("HOLD");
  });

  it("enters FAULT for malformed values and automatically reaches safe IDLE", () => {
    const controller = new TrackingController({}, () => 0);
    controller.ingest(sample(0, { targetX: Number.NaN }));
    expect(controller.tick(0).mode).toBe("FAULT");
    expect(controller.tick(149).mode).toBe("FAULT");
    expect(controller.tick(150).mode).toBe("IDLE");
  });

  it("reset is deterministic from any state", () => {
    const controller = new TrackingController({}, () => 0);
    acquire(controller, 1, 1);
    controller.tick(500);
    controller.reset(510);
    expect(controller.output).toMatchObject({
      mode: "IDLE",
      bodyYaw: 0,
      bodyPitch: 0,
      eyeX: 0,
      eyeY: 0,
      targetPresent: false,
    });
  });
});

describe("TrackingController gaze behavior", () => {
  it("preserves the coordinate convention: negative is viewer-left", () => {
    const left = new TrackingController({}, () => 0);
    const right = new TrackingController({}, () => 0);
    acquire(left, -1);
    acquire(right, 1);
    expect(left.output.bodyYaw).toBeLessThan(0);
    expect(left.output.eyeX).toBeLessThan(0);
    expect(right.output.bodyYaw).toBeGreaterThan(0);
    expect(right.output.eyeX).toBeGreaterThan(0);
  });

  it("lets the eyes lead, then reduces eye residual as the body catches up", () => {
    const controller = new TrackingController({}, () => 0);
    acquire(controller, 1);
    const early = controller.output;
    expect(Math.abs(early.eyeX)).toBeGreaterThan(Math.abs(early.bodyYaw));

    let late = early;
    for (let timestampMs = 360; timestampMs <= 2_400; timestampMs += 30) {
      controller.ingest(sample(timestampMs, { targetX: 1 }));
      late = controller.tick(timestampMs);
    }
    expect(late.bodyYaw).toBeGreaterThan(0.98);
    expect(Math.abs(late.eyeX)).toBeLessThan(Math.abs(early.eyeX));
    expect(Math.abs(late.eyeX)).toBeLessThan(0.05);
  });

  it("keeps body neutral for jitter inside the configured dead zones", () => {
    const controller = new TrackingController({}, () => 0);
    for (let timestampMs = 0; timestampMs <= 1_000; timestampMs += 30) {
      const direction = timestampMs % 60 === 0 ? 1 : -1;
      controller.ingest(
        sample(timestampMs, {
          targetX: direction * 0.05,
          targetY: direction * 0.07,
        }),
      );
      controller.tick(timestampMs);
    }
    expect(controller.output.bodyYaw).toBe(0);
    expect(controller.output.bodyPitch).toBe(0);
  });

  it("fires randomized blink pulses only while idle", () => {
    const controller = new TrackingController({}, () => 0);
    expect(controller.tick(3_999).blinkSequence).toBe(0);
    expect(controller.tick(4_000).blinkSequence).toBe(1);

    controller.ingest(sample(4_010));
    expect(controller.tick(8_100).blinkSequence).toBe(1);
  });
});
