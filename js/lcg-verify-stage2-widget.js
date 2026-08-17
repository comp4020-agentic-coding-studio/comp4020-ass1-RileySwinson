import { el } from "./dom.js";
import { buildField } from "./field.js";
import { parseBigIntField, validateParams, mod } from "./recurrence.js";
import { mountVerifyStage2Engine } from "./verify-stage2-engine.js";
import { typesetMath } from "./mathjax.js";
import { mountWidgetShell } from "./widget-shell.js";

/**
 * Widget A2: the stage-2 test for an LCG — a and c and m are shared across
 * every repetition, only the seed varies per entry in the seed list. Each
 * seed gets its own fresh `sampleSize`-long run, independent of every
 * other repetition (that independence is the whole point of stage 2).
 */
export function mountLcgVerifyStage2Widget(container, defaults) {
  const fields = {
    a: buildField("verify2-lcg-a", "\\(a\\)", defaults.a),
    c: buildField("verify2-lcg-c", "\\(c\\)", defaults.c),
    m: buildField("verify2-lcg-m", "\\(m\\)", defaults.m),
  };
  const fieldList = Object.values(fields);
  const paramsEl = el("div", { className: "params" }, fieldList.map((f) => f.wrapper));
  const engineEl = el("div", { className: "widget-computation" });

  const bodyEl = mountWidgetShell(container, { title: "LCG — stage 2: many seeds", color: "var(--var-result)" });
  bodyEl.append(paramsEl, engineEl);
  typesetMath([paramsEl]);

  function generateSample(seedToken, sampleSize) {
    const a = parseBigIntField(fields.a.input.value);
    const c = parseBigIntField(fields.c.input.value);
    const m = parseBigIntField(fields.m.input.value);
    const seed = parseBigIntField(seedToken);

    if ([a, c, m, seed].some((v) => v === null)) return null;

    const { valid } = validateParams({ modulus: m, coefficients: [a], constant: c, seedWindow: [seed] });
    if (!valid) return null;

    const values = [];
    let current = seed;
    for (let i = 0; i < sampleSize; i++) {
      current = mod(a * current + c, m);
      values.push(Number(current) / Number(m));
    }
    return values;
  }

  return mountVerifyStage2Engine(engineEl, {
    idPrefix: "verify2-lcg",
    defaults: { seeds: defaults.seeds, sampleSize: defaults.sampleSize },
    generateSample,
  });
}
