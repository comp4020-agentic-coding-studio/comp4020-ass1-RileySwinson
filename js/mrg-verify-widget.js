import { el } from "./dom.js";
import { buildField } from "./field.js";
import { mountTermList } from "./term-list.js";
import { parseBigIntField, validateParams, stepGenerator } from "./recurrence.js";
import { mountVerifyEngine } from "./verify-engine.js";
import { typesetMath } from "./mathjax.js";
import { mountWidgetShell } from "./widget-shell.js";

/**
 * Widget B1: the stage-1 equidistribution test, live, for an MRG — same
 * idea as js/lcg-verify-widget.js, generalised to order k via
 * js/term-list.js. The step function threads the k-length window forward
 * exactly the way js/mrg-stream-widget.js does, just without the repeat
 * bookkeeping (this widget only cares about the value distribution, not
 * when the sequence cycles).
 */
export function mountMrgVerifyWidget(container, defaults) {
  const mField = buildField("verify1-mrg-m", "\\(m\\)", defaults.m);
  const paramsEl = el("div", { className: "params" }, [mField.wrapper]);
  const termListEl = el("div", { className: "mrg-terms" });
  const engineEl = el("div", { className: "widget-computation" });

  const bodyEl = mountWidgetShell(container, { title: "MRG stage 1: equidistribution" });
  bodyEl.append(paramsEl, termListEl, engineEl);
  typesetMath([paramsEl]);

  function clearErrors() {
    mField.error.textContent = "";
    mField.input.removeAttribute("aria-invalid");
    for (const row of termList.fields()) {
      row.aField.error.textContent = "";
      row.aField.input.removeAttribute("aria-invalid");
      row.seedField.error.textContent = "";
      row.seedField.input.removeAttribute("aria-invalid");
    }
  }

  function showErrors(errors) {
    if (errors.modulus) {
      mField.error.textContent = errors.modulus;
      mField.input.setAttribute("aria-invalid", "true");
    }
    const rows = termList.fields();
    for (const [key, message] of Object.entries(errors)) {
      const coefficientMatch = key.match(/^coefficient-(\d+)$/);
      const seedMatch = key.match(/^seed-(\d+)$/);
      const row = coefficientMatch ? rows[Number(coefficientMatch[1])] : seedMatch ? rows[Number(seedMatch[1])] : null;
      const field = coefficientMatch ? row?.aField : seedMatch ? row?.seedField : null;
      if (!field) continue;
      field.error.textContent = message;
      field.input.setAttribute("aria-invalid", "true");
    }
  }

  function computeGenerator() {
    const modulus = parseBigIntField(mField.input.value);
    const rawTerms = termList.readRaw().map((t) => ({
      a: parseBigIntField(t.a),
      seed: parseBigIntField(t.seed),
    }));
    clearErrors();

    if (modulus === null || rawTerms.some((t) => t.a === null || t.seed === null)) return null;

    const coefficients = rawTerms.map((t) => t.a);
    const seedWindow = rawTerms.map((t) => t.seed);

    const { valid, errors } = validateParams({ modulus, coefficients, constant: null, seedWindow });
    if (!valid) {
      showErrors(errors);
      return null;
    }

    let window = seedWindow;
    let t = coefficients.length;
    return () => {
      const result = stepGenerator({ t, priorWindow: window, coefficients, constant: null, modulus });
      window = result.newWindow;
      t += 1;
      return result.output;
    };
  }

  // termList has to exist before mountVerifyEngine runs — it calls
  // computeGenerator synchronously as part of its own initial restart(),
  // and computeGenerator reads termList.readRaw().
  const termList = mountTermList(termListEl, {
    idPrefix: "verify1-mrg",
    initialTerms: defaults.terms,
    onChange: () => engineHandle.restart(),
  });

  const engineHandle = mountVerifyEngine(engineEl, {
    idPrefix: "verify1-mrg",
    defaultRate: 5,
    computeGenerator,
  });

  mField.input.addEventListener("input", () => engineHandle.restart());

  return engineHandle;
}
