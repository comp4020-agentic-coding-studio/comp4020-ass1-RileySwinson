import { describe, expect, it } from "vitest";
import { estimate, sampleUniformHemisphere } from "../js/sampling.js";

// A GLSL sampler can't be unit-tested directly — there's no headless way to
// run the shader and read its numbers back into a test. What's tested here
// is js/sampling.js, the JS mirror the shader is hand-transcribed from,
// exercised with real randomness so the formulas prove themselves rather
// than being read and trusted.
//
// This PCG-XSH-RR hash is only for reproducible test randomness — the
// shipped RNG lives in js/shaders.js and runs on the GPU. It doesn't need to
// match bit-for-bit, only to be a decent uniform source. It's worth noting
// why it uses Math.imul: `state * 747796405` overflows 2^53 once state
// approaches 2^32, and plain JS `*` silently loses precision past that —
// unlike GLSL's real uint32 wraparound. The naive version measurably biased
// this RNG's mean (0.4962 instead of 0.5 over 2M draws); Math.imul does
// correct 32-bit integer multiplication and fixes it.
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 747796405) + 2891336453) >>> 0;
    let word = Math.imul((state >>> ((state >>> 28) + 4)) ^ state, 277803737) >>> 0;
    word = (word >>> 22) ^ word;
    return (word >>> 0) / 4294967296;
  };
}

const wo: [number, number, number] = [0, 0, 1]; // viewer straight above the surface

function meanOfEstimator(rand: () => number, N: number, kd: number, ks: number, n: number, li: number): number {
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const { local: wi, pdf } = sampleUniformHemisphere(rand(), rand());
    sum += estimate(wi, wo, kd, ks, n, li, pdf);
  }
  return sum / N;
}

describe("uniform hemisphere sampler", () => {
  it("pdf integrates to 1 over the hemisphere and is positive where cosθ>0", () => {
    // Uniform-over-solid-angle pdf is constant; hemisphere solid angle is 2π.
    const { pdf } = sampleUniformHemisphere(0.37, 0.81);
    expect(pdf * 2 * Math.PI).toBeCloseTo(1, 10);
    expect(pdf).toBeGreaterThan(0);
  });

  it("white furnace: kd=1, ks=0, Li≡1 returns 1.0", () => {
    const mean = meanOfEstimator(seededRandom(1), 300_000, 1, 0, 1, 1);
    expect(Math.abs(mean - 1)).toBeLessThan(0.02);
  });

  it("is unbiased for a Lambertian surface under constant illumination", () => {
    // Analytic reference: ∫ (kd/π) · 1 · cosθ dω over the hemisphere = kd.
    const kd = 0.6;
    const rand = seededRandom(2);
    const runs = 30;
    const N = 50_000;
    const means: number[] = [];
    for (let r = 0; r < runs; r++) means.push(meanOfEstimator(rand, N, kd, 0, 1, 1));
    const grandMean = means.reduce((a, b) => a + b, 0) / runs;
    const variance = means.reduce((a, b) => a + (b - grandMean) ** 2, 0) / (runs - 1);
    const se = Math.sqrt(variance / runs);
    expect(Math.abs(grandMean - kd)).toBeLessThan(3 * se);
  });

  it("standard error roughly halves when the sample count quadruples", () => {
    const kd = 0.6;
    const rand = seededRandom(3);
    const sdOfMeans = (N: number, runs: number): number => {
      const means: number[] = [];
      for (let r = 0; r < runs; r++) means.push(meanOfEstimator(rand, N, kd, 0, 1, 1));
      const mean = means.reduce((a, b) => a + b, 0) / runs;
      const variance = means.reduce((a, b) => a + (b - mean) ** 2, 0) / (runs - 1);
      return Math.sqrt(variance);
    };
    const sdN = sdOfMeans(2_000, 60);
    const sd4N = sdOfMeans(8_000, 60);
    const ratio = sdN / sd4N;
    expect(ratio).toBeGreaterThan(1.6);
    expect(ratio).toBeLessThan(2.4);
  });
});
