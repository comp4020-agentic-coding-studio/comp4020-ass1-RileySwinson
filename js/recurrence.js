// Core math for linear-recurrence pseudorandom generators (LCG and MRG).
// Pure and DOM-free so it can be unit-tested directly — see
// checks/recurrence.test.ts. Every state value and every intermediate sum
// stays a BigInt; the only place a Number ever appears is the final
// U_t = X_t / m division, which is display-only and never feeds back into
// a later step. See CLAUDE.md for why: this repo already lost real
// precision once doing modular arithmetic with plain `Number`.

/** Non-negative modulo for BigInts (BigInt `%` can return a negative remainder). */
export function mod(a, m) {
  const r = a % m;
  return r < 0n ? r + m : r;
}

/**
 * Strictly parses a raw input string as a non-negative integer BigInt.
 * Returns null (never throws) for anything that isn't purely digits —
 * deliberately narrower than `BigInt()` itself, which accepts things like
 * whitespace or a leading "+" that we don't want silently passing through
 * a form field.
 */
export function parseBigIntField(raw) {
  const trimmed = String(raw).trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return BigInt(trimmed);
}

/**
 * One recurrence step. `priorWindow` is [X_{t-k}, ..., X_{t-1}] (oldest
 * first, length k). `coefficients` is [a_1, ..., a_k], where a_1 multiplies
 * the most recently produced value X_{t-1} — matching the order MRGs are
 * conventionally written in. `constant` is the LCG's `c`, or null for an
 * MRG (order > 1 generators in this project have no additive term).
 */
export function stepGenerator({ t, priorWindow, coefficients, constant, modulus }) {
  const k = coefficients.length;
  let rawSum = constant ?? 0n;
  for (let i = 0; i < k; i++) {
    rawSum += coefficients[i] * priorWindow[k - 1 - i];
  }
  const result = mod(rawSum, modulus);
  const output = Number(result) / Number(modulus);
  const newWindow = [...priorWindow.slice(1), result];

  return {
    t,
    priorWindow,
    coefficients,
    constant: constant ?? null,
    modulus,
    rawSum,
    result,
    output,
    newWindow,
  };
}

/** Runs `steps` steps forward from a seed window, returning one StepRecord per step. */
export function runSequence({ seedWindow, coefficients, constant, modulus, steps }) {
  const records = [];
  let priorWindow = seedWindow;
  let t = seedWindow.length;

  for (let i = 0; i < steps; i++) {
    const step = stepGenerator({ t, priorWindow, coefficients, constant, modulus });
    records.push(step);
    priorWindow = step.newWindow;
    t += 1;
  }

  return records;
}

/**
 * Validates the raw (already-parsed-to-BigInt) generator parameters.
 * Returns `{ valid, errors }`, where `errors` is keyed by field name
 * ("modulus", "coefficient-0", "constant", "seed-0", ...) so a caller can
 * map a problem straight back to the input that caused it.
 */
export function validateParams({ modulus, coefficients, constant, seedWindow }) {
  /** @type {Record<string, string>} */
  const errors = {};

  if (modulus === null || modulus < 2n) {
    errors.modulus = "modulus must be an integer of at least 2";
  }

  const inRange = (value) => modulus !== null && value !== null && value >= 0n && value < modulus;

  coefficients.forEach((value, i) => {
    if (!inRange(value)) errors[`coefficient-${i}`] = "must be in [0, m-1]";
  });

  if (constant !== undefined && constant !== null && !inRange(constant)) {
    errors.constant = "must be in [0, m-1]";
  }

  seedWindow.forEach((value, i) => {
    if (!inRange(value)) errors[`seed-${i}`] = "must be in [0, m-1]";
  });

  return { valid: Object.keys(errors).length === 0, errors };
}
