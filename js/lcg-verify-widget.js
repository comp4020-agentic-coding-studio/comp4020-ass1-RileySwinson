import { el } from "./dom.js";
import { buildField } from "./field.js";
import { parseBigIntField, validateParams, mod } from "./recurrence.js";
import { mountVerifyEngine } from "./verify-engine.js";
import { typesetMath } from "./mathjax.js";
import { mountWidgetShell } from "./widget-shell.js";

/**
 * Widget A1: the stage-1 equidistribution test, live, for an LCG. Editable
 * a/c/m/seed feed js/verify-engine.js a fresh step function on every valid
 * change — the engine owns the rate control, the scatter, and the running
 * chi-squared statistic; this file only knows how to turn LCG parameters
 * into "the next U_t".
 */
export function mountLcgVerifyWidget(container, defaults) {
  const fields = {
    a: buildField("verify1-lcg-a", "\\(a\\)", defaults.a),
    c: buildField("verify1-lcg-c", "\\(c\\)", defaults.c),
    m: buildField("verify1-lcg-m", "\\(m\\)", defaults.m),
    seed: buildField("verify1-lcg-seed", "\\(X\\)", defaults.seed),
  };
  const fieldList = Object.values(fields);
  const paramsEl = el("div", { className: "params" }, fieldList.map((f) => f.wrapper));
  const engineEl = el("div", { className: "widget-computation" });

  const bodyEl = mountWidgetShell(container, { title: "LCG — stage 1: equidistribution", color: "var(--var-c)" });
  bodyEl.append(paramsEl, engineEl);
  typesetMath([paramsEl]);

  function clearErrors() {
    for (const field of fieldList) {
      field.error.textContent = "";
      field.input.removeAttribute("aria-invalid");
    }
  }

  function showErrors(errors) {
    const fieldsByKey = { modulus: fields.m, "coefficient-0": fields.a, constant: fields.c, "seed-0": fields.seed };
    for (const [key, message] of Object.entries(errors)) {
      const field = fieldsByKey[key];
      if (!field) continue;
      field.error.textContent = message;
      field.input.setAttribute("aria-invalid", "true");
    }
  }

  function computeGenerator() {
    const a = parseBigIntField(fields.a.input.value);
    const c = parseBigIntField(fields.c.input.value);
    const m = parseBigIntField(fields.m.input.value);
    const seed = parseBigIntField(fields.seed.input.value);
    clearErrors();

    if ([a, c, m, seed].some((v) => v === null)) return null;

    const { valid, errors } = validateParams({ modulus: m, coefficients: [a], constant: c, seedWindow: [seed] });
    if (!valid) {
      showErrors(errors);
      return null;
    }

    let current = seed;
    return () => {
      current = mod(a * current + c, m);
      return Number(current) / Number(m);
    };
  }

  const engineHandle = mountVerifyEngine(engineEl, {
    idPrefix: "verify1-lcg",
    defaultRate: 5,
    computeGenerator,
  });

  for (const field of fieldList) {
    field.input.addEventListener("input", () => engineHandle.restart());
  }

  return engineHandle;
}
