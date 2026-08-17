import { el } from "./dom.js";
import { buildField } from "./field.js";
import { mountMultiplierList } from "./multiplier-list.js";
import { parseBigIntField, validateParams, stepGenerator } from "./recurrence.js";
import { mountVerifyStage2Engine } from "./verify-stage2-engine.js";
import { typesetMath } from "./mathjax.js";
import { mountWidgetShell } from "./widget-shell.js";

/**
 * Widget B2: the stage-2 test for an MRG. m and the a_i multipliers are
 * shared across every repetition (js/multiplier-list.js — add/remove to
 * change k); only the seed varies per entry in the seed list. An MRG needs
 * a full k-length window to start from, not a single number, so each seed
 * list entry `s` expands to the window (s, s+1, …, s+k-1), rather than
 * asking for k seeds per repetition, which would need a much more complex
 * input than a flat list of numbers.
 */
export function mountMrgVerifyStage2Widget(container, defaults) {
  const mField = buildField("verify2-mrg-m", "\\(m\\)", defaults.m);
  const paramsEl = el("div", { className: "params" }, [mField.wrapper]);
  const multiplierListEl = el("div", { className: "mrg-terms" });
  const engineEl = el("div", { className: "widget-computation" });

  const bodyEl = mountWidgetShell(container, { title: "MRG — stage 2: many seeds", color: "var(--danger)" });
  bodyEl.append(paramsEl, multiplierListEl, engineEl);
  typesetMath([paramsEl]);

  function generateSample(seedToken, sampleSize) {
    const modulus = parseBigIntField(mField.input.value);
    const coefficients = multiplierList.readRaw().map((v) => parseBigIntField(v));
    const baseSeed = parseBigIntField(seedToken);

    if (modulus === null || coefficients.some((v) => v === null) || baseSeed === null) return null;

    const k = coefficients.length;
    const seedWindow = Array.from({ length: k }, (_, i) => baseSeed + BigInt(i));

    const { valid } = validateParams({ modulus, coefficients, constant: null, seedWindow });
    if (!valid) return null;

    const values = [];
    let window = seedWindow;
    let t = k;
    for (let i = 0; i < sampleSize; i++) {
      const result = stepGenerator({ t, priorWindow: window, coefficients, constant: null, modulus });
      values.push(result.output);
      window = result.newWindow;
      t += 1;
    }
    return values;
  }

  const engineHandle = mountVerifyStage2Engine(engineEl, {
    idPrefix: "verify2-mrg",
    defaults: { seeds: defaults.seeds, sampleSize: defaults.sampleSize },
    generateSample,
    seedLabel: "Starting Seeds",
  });

  const multiplierList = mountMultiplierList(multiplierListEl, {
    idPrefix: "verify2-mrg",
    initialValues: defaults.coefficients,
    onChange: () => {},
  });

  return engineHandle;
}
