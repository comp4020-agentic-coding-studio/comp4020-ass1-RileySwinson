import { el } from "./dom.js";
import { parseBigIntField, runSequence, validateParams } from "./recurrence.js";
import { renderStream } from "./stream.js";
import { mountCarousel } from "./carousel-view.js";
import { typesetMath } from "./mathjax.js";
import { buildField } from "./field.js";

/**
 * Mounts one fully-wired generator widget: a param form (coefficients,
 * optional constant, modulus, seed window), a live output stream, and a
 * paginated computation carousel. Used for the MRG widget — the LCG widget
 * has its own dedicated mount function now (js/lcg-widget.js), since its
 * step-by-step walkthrough of a single computation is a different shape
 * entirely from this "one card per generated value" carousel.
 *
 * config: {
 *   id, order, hasConstant, steps,
 *   defaults: { modulus, coefficients: string[], constant?, seedWindow: string[] },
 *   labels: { coefficientLabel(i), seedLabel(i) },
 * }
 */
export function mountGeneratorWidget(container, config) {
  const { id, order, hasConstant, defaults, steps: stepCount, labels } = config;

  const coefficientFields = Array.from({ length: order }, (_, i) =>
    buildField(`${id}-a-${i}`, labels.coefficientLabel(i), defaults.coefficients[i]),
  );
  const constantField = hasConstant ? buildField(`${id}-c`, "\\(c\\)", defaults.constant) : null;
  const modulusField = buildField(`${id}-m`, "\\(m\\)", defaults.modulus);
  const seedFields = Array.from({ length: order }, (_, i) =>
    buildField(`${id}-seed-${i}`, labels.seedLabel(i), defaults.seedWindow[i]),
  );

  const allFields = [
    ...coefficientFields,
    ...(constantField ? [constantField] : []),
    modulusField,
    ...seedFields,
  ];

  const paramsEl = el("div", { className: "params" }, allFields.map((f) => f.wrapper));
  const streamEl = el("div", { className: "widget-stream" });
  const computationEl = el("div", { className: "widget-computation" });

  container.replaceChildren();
  container.append(paramsEl, streamEl, computationEl);
  typesetMath([paramsEl]);

  const carouselHandle = mountCarousel(computationEl, []);

  function readParams() {
    return {
      coefficients: coefficientFields.map((f) => parseBigIntField(f.input.value)),
      constant: constantField ? parseBigIntField(constantField.input.value) : null,
      modulus: parseBigIntField(modulusField.input.value),
      seedWindow: seedFields.map((f) => parseBigIntField(f.input.value)),
    };
  }

  function clearErrors() {
    for (const field of allFields) {
      field.error.textContent = "";
      field.input.removeAttribute("aria-invalid");
    }
  }

  function showErrors(errors) {
    const fieldsByKey = { modulus: modulusField };
    coefficientFields.forEach((f, i) => (fieldsByKey[`coefficient-${i}`] = f));
    seedFields.forEach((f, i) => (fieldsByKey[`seed-${i}`] = f));
    if (constantField) fieldsByKey.constant = constantField;

    for (const [key, message] of Object.entries(errors)) {
      const field = fieldsByKey[key];
      if (!field) continue;
      field.error.textContent = message;
      field.input.setAttribute("aria-invalid", "true");
    }
  }

  function recompute() {
    const raw = readParams();
    clearErrors();

    const stillBeingEdited =
      raw.modulus === null ||
      raw.coefficients.some((v) => v === null) ||
      raw.seedWindow.some((v) => v === null) ||
      (constantField && raw.constant === null);

    // An empty or partial field mid-edit isn't an error yet — freeze the
    // last valid stream/computation view instead of tearing it down.
    if (stillBeingEdited) return;

    const { valid, errors } = validateParams(raw);
    if (!valid) {
      showErrors(errors);
      return;
    }

    const steps = runSequence({
      seedWindow: raw.seedWindow,
      coefficients: raw.coefficients,
      constant: raw.constant,
      modulus: raw.modulus,
      steps: stepCount,
    });

    renderStream(streamEl, steps);
    carouselHandle.setSteps(steps);
  }

  for (const field of allFields) {
    field.input.addEventListener("input", recompute);
  }

  recompute();

  return { recompute };
}
