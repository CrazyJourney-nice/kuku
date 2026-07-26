import { describe, expect, it } from "vitest";
import { amplifyBodyMotion } from "./bodyMotion";

describe("mascot body visual gain", () => {
  it("makes small and medium body turns more visible without exceeding the rig range", () => {
    expect(amplifyBodyMotion(0)).toBe(0);
    expect(amplifyBodyMotion(0.25)).toBeGreaterThan(0.5);
    expect(amplifyBodyMotion(-0.25)).toBeLessThan(-0.5);
    expect(amplifyBodyMotion(1)).toBe(1);
    expect(amplifyBodyMotion(3)).toBe(1);
  });
});
