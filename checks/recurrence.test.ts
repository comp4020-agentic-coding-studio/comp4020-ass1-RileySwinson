import { describe, expect, it } from "vitest";
import {
  mod,
  parseBigIntField,
  runSequence,
  stepGenerator,
  validateParams,
} from "../js/recurrence.js";

describe("mod", () => {
  it("wraps positive values normally", () => {
    expect(mod(13n, 5n)).toBe(3n);
  });

  it("wraps negative values into [0, m)", () => {
    expect(mod(-1n, 5n)).toBe(4n);
  });
});

describe("parseBigIntField", () => {
  it("parses plain digit strings", () => {
    expect(parseBigIntField("123")).toBe(123n);
  });

  it("trims surrounding whitespace", () => {
    expect(parseBigIntField("  42  ")).toBe(42n);
  });

  it.each(["", "-5", "3.14", "12abc", "0x10"])("rejects %s", (raw) => {
    expect(parseBigIntField(raw)).toBeNull();
  });
});

describe("stepGenerator: LCG (order 1)", () => {
  // Minimal Standard LCG (Lewis, Goodman & Miller): a = 16807, c = 0,
  // m = 2^31 - 1. With seed 1 the first output is the textbook value 16807.
  it("matches the textbook minimal-standard LCG's first output", () => {
    const step = stepGenerator({
      t: 1,
      priorWindow: [1n],
      coefficients: [16807n],
      constant: 0n,
      modulus: 2147483647n,
    });
    expect(step.result).toBe(16807n);
    expect(step.newWindow).toEqual([16807n]);
  });

  it("keeps full precision where naive double-precision multiplication would not", () => {
    // Both operands are near 2^31, so the true product is near 2^62 — far
    // past Number.MAX_SAFE_INTEGER (2^53 - 1). This is the exact bug class
    // documented in CLAUDE.md: a naive `Number(a) * Number(x)` here would
    // silently produce the wrong answer, not just an imprecise one, once
    // reduced mod m.
    const a = 2147483629n;
    const m = 2147483647n;
    const x0 = m - 1n;

    const exactProduct = a * x0;
    const naiveProduct = Number(a) * Number(x0);
    expect(exactProduct).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
    expect(BigInt(Math.round(naiveProduct))).not.toBe(exactProduct);

    const step = stepGenerator({
      t: 1,
      priorWindow: [x0],
      coefficients: [a],
      constant: null,
      modulus: m,
    });
    expect(step.result).toBe(exactProduct % m);
  });
});

describe("runSequence: MRG (order 2)", () => {
  // Hand-computed: a1=3, a2=5, m=11, seed window [X0=2, X1=4].
  // X2 = (3*4 + 5*2) mod 11 = 22 mod 11 = 0
  // X3 = (3*0 + 5*4) mod 11 = 20 mod 11 = 9
  it("slides the window and matches hand-computed values", () => {
    const steps = runSequence({
      seedWindow: [2n, 4n],
      coefficients: [3n, 5n],
      constant: null,
      modulus: 11n,
      steps: 2,
    });

    expect(steps).toHaveLength(2);
    expect(steps[0].t).toBe(2);
    expect(steps[0].result).toBe(0n);
    expect(steps[0].newWindow).toEqual([4n, 0n]);

    expect(steps[1].t).toBe(3);
    expect(steps[1].result).toBe(9n);
    expect(steps[1].newWindow).toEqual([0n, 9n]);
  });

  it("computes the same output every run given the same seed", () => {
    const config = {
      seedWindow: [2n, 4n],
      coefficients: [3n, 5n],
      constant: null,
      modulus: 11n,
      steps: 5,
    };
    expect(runSequence(config)).toEqual(runSequence(config));
  });
});

describe("validateParams", () => {
  it("accepts an in-range configuration", () => {
    const { valid, errors } = validateParams({
      modulus: 11n,
      coefficients: [3n, 5n],
      constant: null,
      seedWindow: [2n, 4n],
    });
    expect(valid).toBe(true);
    expect(errors).toEqual({});
  });

  it("flags a modulus below 2", () => {
    const { valid, errors } = validateParams({
      modulus: 1n,
      coefficients: [],
      constant: null,
      seedWindow: [],
    });
    expect(valid).toBe(false);
    expect(errors.modulus).toBeDefined();
  });

  it("flags out-of-range coefficients and seeds", () => {
    const { valid, errors } = validateParams({
      modulus: 11n,
      coefficients: [11n],
      constant: null,
      seedWindow: [-1n],
    });
    expect(valid).toBe(false);
    expect(errors["coefficient-0"]).toBeDefined();
    expect(errors["seed-0"]).toBeDefined();
  });
});
