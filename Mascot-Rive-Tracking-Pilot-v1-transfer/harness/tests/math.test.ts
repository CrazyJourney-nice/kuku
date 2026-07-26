import { describe, expect, it } from "vitest";
import {
  applyDeadZone,
  clamp,
  clampUnit,
  damp,
  smoothstep,
} from "../src/tracking/math";

describe("tracking math", () => {
  it("clamps ML coordinates to the public -1...1 contract", () => {
    expect(clampUnit(-3)).toBe(-1);
    expect(clampUnit(0.4)).toBe(0.4);
    expect(clampUnit(7)).toBe(1);
    expect(clamp(2, -4, 1)).toBe(1);
  });

  it("removes dead-zone movement and rescales the remaining range", () => {
    expect(applyDeadZone(0.079, 0.08)).toBe(0);
    expect(applyDeadZone(-0.08, 0.08)).toBe(0);
    expect(applyDeadZone(1, 0.08)).toBe(1);
    expect(applyDeadZone(-1, 0.08)).toBe(-1);
  });

  it("produces a bounded smoothstep body mapping", () => {
    expect(smoothstep(8, 45, 5)).toBe(0);
    expect(smoothstep(8, 45, 45)).toBe(1);
    expect(smoothstep(8, 45, 20)).toBeGreaterThan(0);
    expect(smoothstep(8, 45, 20)).toBeLessThan(1);
  });

  it("uses frame-rate independent exponential damping", () => {
    const oneFrame = damp(0, 1, 16.67, 100);
    const twoFrames = damp(damp(0, 1, 8.335, 100), 1, 8.335, 100);
    expect(oneFrame).toBeCloseTo(twoFrames, 8);
  });
});
