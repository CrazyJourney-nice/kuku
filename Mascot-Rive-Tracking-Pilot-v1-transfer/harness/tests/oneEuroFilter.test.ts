import { describe, expect, it } from "vitest";
import { OneEuroFilter } from "../src/tracking/oneEuroFilter";

describe("OneEuroFilter", () => {
  it("holds a stable input without drift", () => {
    const filter = new OneEuroFilter();
    for (let timestampMs = 0; timestampMs <= 1_000; timestampMs += 16) {
      expect(filter.filter(0.42, timestampMs)).toBeCloseTo(0.42, 8);
    }
  });

  it("smooths a step while remaining responsive", () => {
    const filter = new OneEuroFilter({
      minCutoffHz: 1,
      beta: 0.05,
    });
    filter.filter(0, 0);
    const first = filter.filter(1, 16);
    let settled = first;
    for (let timestampMs = 32; timestampMs <= 500; timestampMs += 16) {
      settled = filter.filter(1, timestampMs);
    }
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(1);
    expect(settled).toBeGreaterThan(0.9);
    expect(settled).toBeLessThanOrEqual(1);
  });

  it("can be reset to a neutral coordinate", () => {
    const filter = new OneEuroFilter();
    filter.filter(1, 0);
    filter.filter(1, 16);
    filter.reset();
    expect(filter.filter(0, 100)).toBe(0);
  });
});
