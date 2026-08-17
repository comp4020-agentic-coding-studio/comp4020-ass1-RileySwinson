import { describe, expect, it } from "vitest";
import { createChiSquaredTracker, chiSquaredStatistic } from "../js/chi-squared.js";

describe("createChiSquaredTracker", () => {
  it("scores a perfectly even spread as zero", () => {
    const tracker = createChiSquaredTracker(4);
    for (const value of [0.1, 0.3, 0.6, 0.9]) tracker.add(value);
    expect(tracker.n).toBe(4);
    expect(tracker.counts()).toEqual([1, 1, 1, 1]);
    expect(tracker.statistic()).toBe(0);
  });

  it("matches a hand-computed statistic for a lopsided sample", () => {
    // all 4 values land in bin 0 of 4: counts = [4, 0, 0, 0], expected = 1
    // statistic = (4-1)^2/1 + (0-1)^2/1 * 3 = 9 + 1 + 1 + 1 = 12
    const tracker = createChiSquaredTracker(4);
    for (const value of [0.1, 0.15, 0.2, 0.05]) tracker.add(value);
    expect(tracker.counts()).toEqual([4, 0, 0, 0]);
    expect(tracker.statistic()).toBe(12);
  });

  it("clamps a value just under the top edge into the last bin", () => {
    const tracker = createChiSquaredTracker(4);
    tracker.add(0.999999999);
    expect(tracker.counts()).toEqual([0, 0, 0, 1]);
  });

  it("clamps a value of exactly 1 into the last bin", () => {
    // floor(1 * 4) = 4, which is out of range for 4 bins (valid indices
    // 0-3) — this is the case the min(..., binCount - 1) clamp exists
    // for. Values feeding this tracker are always Number(X_t)/Number(m)
    // with X_t < m, so this shouldn't arise in practice, but a BigInt
    // large enough to lose precision in the Number() conversion could
    // round X_t and m to the same double and produce exactly 1 — worth
    // covering explicitly rather than only the near-1 case above.
    const tracker = createChiSquaredTracker(4);
    tracker.add(1);
    expect(tracker.counts()).toEqual([0, 0, 0, 1]);
  });

  it("reports degrees of freedom as binCount - 1", () => {
    expect(createChiSquaredTracker(10).degreesOfFreedom).toBe(9);
  });

  it("returns 0 for an empty tracker rather than dividing by zero", () => {
    expect(createChiSquaredTracker(10).statistic()).toBe(0);
  });
});

describe("chiSquaredStatistic", () => {
  it("matches the tracker for the same input", () => {
    const values = [0.1, 0.3, 0.6, 0.9, 0.05, 0.55];
    const tracker = createChiSquaredTracker(4);
    for (const value of values) tracker.add(value);
    expect(chiSquaredStatistic(values, 4)).toBe(tracker.statistic());
  });
});
