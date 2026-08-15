import { el } from "./dom.js";

/**
 * Builds a labelled, validated numeric text input — shared by every widget
 * on the page's param forms (a/c/m/seed fields, term-list rows). `labelText`
 * may be LaTeX (e.g. "\\(a\\)"); callers are responsible for calling
 * typesetMath on a container after mounting.
 */
export function buildField(id, labelText, defaultValue) {
  const input = el("input", {
    className: "field-input",
    attrs: {
      type: "text",
      inputmode: "numeric",
      pattern: "[0-9]*",
      id,
      value: defaultValue,
      "aria-describedby": `${id}-error`,
    },
  });
  const label = el("label", { className: "field-label", attrs: { for: id }, text: labelText });
  const error = el("p", {
    className: "field-error",
    attrs: { id: `${id}-error`, "aria-live": "polite" },
  });
  return { wrapper: el("div", { className: "field" }, [label, input, error]), input, error };
}

/**
 * Builds a "N per second" range slider with a live numeric readout —
 * shared by every widget that runs on a timer (js/lcg-stream-widget.js,
 * js/mrg-stream-widget.js, js/verify-engine.js).
 */
export function buildRateField(id, defaultRate, labelText = "Numbers per second") {
  const input = el("input", {
    className: "rate-input",
    attrs: { type: "range", id, min: "1", max: "20", step: "1", value: String(defaultRate) },
  });
  const valueEl = el("output", { className: "rate-value", attrs: { for: id }, text: `${defaultRate}/s` });
  const label = el("label", { className: "field-label", attrs: { for: id }, text: labelText });
  const wrapper = el("div", { className: "field rate-field" }, [label, input, valueEl]);
  input.addEventListener("input", () => {
    valueEl.textContent = `${input.value}/s`;
  });
  return { wrapper, input };
}
