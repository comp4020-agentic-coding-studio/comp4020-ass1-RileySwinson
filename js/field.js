import { el } from "./dom.js";

/**
 * Builds a labelled, validated numeric text input — shared by every widget
 * on the page (js/widget.js's param forms, js/lcg-widget.js's a/c/m/seed
 * fields). `labelText` may be LaTeX (e.g. "\\(a\\)"); callers are
 * responsible for calling typesetMath on a container after mounting.
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
