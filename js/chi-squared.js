/**
 * Core statistics for the stage-1 equidistribution test (spec/README.md's
 * "how do you know if you have it?" question, made concrete): bin a
 * stream of [0,1) values into `binCount` equal-width bins and compare the
 * observed counts against what a truly uniform stream would produce.
 *
 * Kept as a live, incremental tracker rather than a one-shot function —
 * the stage-1 widgets recompute this on every new sample as it streams
 * in, and re-binning the whole history from scratch every tick would be
 * wasted work once a run has been going for a while.
 */
export function createChiSquaredTracker(binCount) {
  const counts = Array.from({ length: binCount }, () => 0);
  let n = 0;

  function binIndex(value) {
    // value is always < 1, but clamp defensively against floating-point
    // edge cases (e.g. a value of exactly 1 - epsilon rounding up).
    return Math.min(Math.floor(value * binCount), binCount - 1);
  }

  return {
    add(value) {
      counts[binIndex(value)] += 1;
      n += 1;
    },
    get n() {
      return n;
    },
    /** Chi-squared goodness-of-fit statistic against a uniform reference. */
    statistic() {
      if (n === 0) return 0;
      const expected = n / binCount;
      let statistic = 0;
      for (const observed of counts) {
        statistic += (observed - expected) ** 2 / expected;
      }
      return statistic;
    },
    counts() {
      return [...counts];
    },
    /** Degrees of freedom for this test — the reference value a good generator's statistic should average out to. */
    get degreesOfFreedom() {
      return binCount - 1;
    },
  };
}

/** One-shot version for the stage-2 widgets: N fresh values in, one statistic out. */
export function chiSquaredStatistic(values, binCount) {
  const tracker = createChiSquaredTracker(binCount);
  for (const value of values) tracker.add(value);
  return tracker.statistic();
}
