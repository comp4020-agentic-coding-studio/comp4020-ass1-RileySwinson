import { describe, expect, it } from "vitest";
import { mod, stepGenerator } from "../js/recurrence.js";
import { createChiSquaredTracker } from "../js/chi-squared.js";

// End-to-end statistical regression for the "how do we verify randomness?"
// section: runs the *real* generator core (js/recurrence.js) through the
// *real* chi-squared tracker (js/chi-squared.js) exactly the way
// js/verify-engine.js and js/verify-stage2-engine.js do, without the DOM
// layer in between. checks/chi-squared.test.ts and checks/recurrence.test.ts
// already cover each piece in isolation with hand-computed values; this file
// checks the pieces still behave correctly *together*, against real
// generators, at the sample sizes the page actually uses.
//
// Tolerances are derived from chi-squared theory, not picked by feel — see
// each assertion's comment — chosen wide enough that a correct
// implementation essentially cannot fail by chance, but tight enough that
// the bug classes this guards against (wrong bin formula, shared state
// leaking between stage-2 repetitions, wrong degrees of freedom, an MRG
// path that silently diverges from the LCG path it's supposed to share)
// would reliably blow through them.

const BIN_COUNT = 10;
const DEGREES_OF_FREEDOM = BIN_COUNT - 1; // = 9

function runLcgStage1(a: bigint, c: bigint, m: bigint, seed: bigint, n: number) {
  const tracker = createChiSquaredTracker(BIN_COUNT);
  let current = seed;
  for (let i = 0; i < n; i++) {
    current = mod(a * current + c, m);
    tracker.add(Number(current) / Number(m));
  }
  return tracker;
}

function runMrgStage1(coefficients: bigint[], m: bigint, seedWindow: bigint[], n: number) {
  const tracker = createChiSquaredTracker(BIN_COUNT);
  let window = seedWindow;
  let t = coefficients.length;
  for (let i = 0; i < n; i++) {
    const step = stepGenerator({ t, priorWindow: window, coefficients, constant: null, modulus: m });
    tracker.add(step.output);
    window = step.newWindow;
    t += 1;
  }
  return tracker;
}

function mean(values: number[]) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

describe("stage-1 statistic: the sum-of-counts identity", () => {
  // Σ_j O_j = n is an algebraic identity, true regardless of how good the
  // generator is — it's exactly the constraint that makes the statistic's
  // asymptotic distribution χ²_{k-1} rather than χ²_k. If binIndex() ever
  // wrote outside the k real bins (e.g. a stray negative index), this
  // invariant breaks even though nothing throws.
  it("holds for a real LCG run", () => {
    const tracker = runLcgStage1(16807n, 0n, 2147483647n, 1n, 2000);
    expect(tracker.counts().reduce((a, b) => a + b, 0)).toBe(2000);
  });

  it("holds for a real MRG run", () => {
    const tracker = runMrgStage1([7n, 5n, 3n], 1000n, [3n, 1n, 4n], 2000);
    expect(tracker.counts().reduce((a, b) => a + b, 0)).toBe(2000);
  });
});

describe("stage-1 statistic: degrees of freedom matches the page's bin count", () => {
  it("is 9 for the 10 bins both verify engines use", () => {
    expect(createChiSquaredTracker(BIN_COUNT).degreesOfFreedom).toBe(DEGREES_OF_FREEDOM);
  });
});

describe("stage-1 statistic: reliably flags a visibly non-uniform generator", () => {
  // a=3, c=0, m=10, seed=1 is the page's own worked "period 4" example —
  // it only ever outputs {0.1, 0.3, 0.7, 0.9}, so over n=400 samples the 4
  // bins those land in get ~100 each and the other 6 get exactly 0.
  // Hand-derived: E = 400/10 = 40 per bin.
  //   4 active bins:   (100-40)²/40 = 90 each  → 360
  //   6 inactive bins: (0-40)²/40   = 40 each  → 240
  //   χ² = 600 exactly (deterministic — this generator has no randomness
  //   left once it's cycling, so this isn't a statistical estimate, it's
  //   an exact computation).
  it("scores the period-4 LCG example at exactly χ² = 600 for n = 400", () => {
    const tracker = runLcgStage1(3n, 0n, 10n, 1n, 400);
    expect(tracker.counts()).toEqual([0, 100, 0, 100, 0, 0, 0, 100, 0, 100]);
    expect(tracker.statistic()).toBe(600);
  });
});

describe("stage-1 statistic: a single run from a good generator lands near df", () => {
  // A single χ²_9 draw has mean 9, sd = √18 ≈ 4.24. The 0.999 quantile of
  // χ²_9 is ≈27.9, so bounding at 60 leaves a false-failure probability
  // far below 1e-6 for a truly uniform source, while a broken
  // implementation (wrong bin formula, wrong df, reused seed state) blows
  // past it by 1-2 orders of magnitude, as the χ²=600 case above shows.
  it("minimal-standard LCG (a=16807, c=0, m=2^31-1)", () => {
    const tracker = runLcgStage1(16807n, 0n, 2147483647n, 1n, 5000);
    expect(tracker.statistic()).toBeLessThan(60);
  });

  it("the page's own MRG default (m=1000, a=[7,5,3])", () => {
    const tracker = runMrgStage1([7n, 5n, 3n], 1000n, [3n, 1n, 4n], 5000);
    expect(tracker.statistic()).toBeLessThan(60);
  });
});

describe("stage-2 statistic: the mean across many independent seeds converges to df", () => {
  // SE(mean of m i.i.d. χ²_9) = √(2·9/m). At m=200, SE ≈ 0.3, so a ±2
  // window around 9 is roughly a 6-7 sigma bound — essentially never
  // fails by chance for a correct implementation, but would be blown
  // through by a bug that shares tracker/generator state across
  // repetitions (which would bias every statistic the same direction) or
  // gets the bin/df formula wrong.
  const SEEDS = 200;
  const SAMPLE_SIZE = 500;

  it("minimal-standard LCG", () => {
    const stats = Array.from({ length: SEEDS }, (_, i) =>
      runLcgStage1(16807n, 0n, 2147483647n, BigInt(i + 1), SAMPLE_SIZE).statistic(),
    );
    expect(Math.abs(mean(stats) - DEGREES_OF_FREEDOM)).toBeLessThan(2);
  });

  it("the page's own MRG default, using the same seed-window-expansion convention as js/mrg-verify-stage2-widget.js", () => {
    const stats = Array.from({ length: SEEDS }, (_, i) => {
      const s = BigInt(i + 1);
      const seedWindow = [s, s + 1n, s + 2n];
      return runMrgStage1([7n, 5n, 3n], 1000n, seedWindow, SAMPLE_SIZE).statistic();
    });
    expect(Math.abs(mean(stats) - DEGREES_OF_FREEDOM)).toBeLessThan(2);
  });
});

describe("architectural claim: LCG is order-1 MRG plus an optional constant", () => {
  // The codebase's stated design (see CLAUDE.md / PROCESS.md history) is
  // that LCG isn't a separate implementation — it's stepGenerator() called
  // with k=1. Confirm that actually holds: driving stepGenerator directly
  // with a single-term window must match the hand-rolled LCG loop the
  // verify widgets use, value for value.
  it("stepGenerator(k=1, constant=c) matches the direct LCG recurrence", () => {
    const a = 16807n;
    const c = 0n;
    const m = 2147483647n;
    let seed = 1n;
    let window = [seed];
    let t = 1;

    for (let i = 0; i < 20; i++) {
      seed = mod(a * seed + c, m);
      const step = stepGenerator({ t, priorWindow: window, coefficients: [a], constant: c, modulus: m });
      expect(step.result).toBe(seed);
      expect(step.output).toBe(Number(seed) / Number(m));
      window = step.newWindow;
      t += 1;
    }
  });
});
