import { describe, expect, it } from "vitest";
import { mirrorHorizontal, mirrorNormalizedBoxX } from "./mirroring";

describe("horizontal preview mirroring", () => {
  it("mirrors a normalized face box without changing its width", () => {
    expect(mirrorNormalizedBoxX(0.2, 0.25)).toBeCloseTo(0.55);
    expect(mirrorNormalizedBoxX(0.66, 0.18)).toBeCloseTo(0.16);
  });

  it("reverses horizontal pose, gaze and mascot directions", () => {
    expect(mirrorHorizontal(-0.4)).toBe(0.4);
    expect(mirrorHorizontal(0.25)).toBe(-0.25);
  });
});
