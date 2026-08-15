import { el } from "./dom.js";
import { buildField } from "./field.js";
import { typesetMath } from "./mathjax.js";

const MIN_ORDER = 1;
const MAX_ORDER = 6;

/**
 * Manages a variable-length list of a_i multipliers only — an MRG's order
 * k, without a paired seed per row. Used by js/mrg-verify-stage2-widget.js,
 * where the seeds come from the stage-2 seed list instead (one starting
 * seed per repetition, expanded into a full window — see that file), so
 * js/term-list.js's paired (a_i, X_i) rows would show an unused seed field
 * per row for no reason.
 */
export function mountMultiplierList(container, { idPrefix, initialValues, onChange }) {
  let values = [...initialValues];
  let rows = [];

  const rowsEl = el("div", { className: "term-rows" });
  const addButton = el("button", { className: "term-add", attrs: { type: "button" }, text: "+ Add a term" });
  container.replaceChildren(rowsEl, addButton);

  function currentValues() {
    return rows.map((row) => row.field.input.value);
  }

  function render() {
    rows = values.map((value, i) => {
      const field = buildField(`${idPrefix}-a-${i}`, `\\(a_{${i + 1}}\\)`, value);
      const removeButton = el("button", {
        className: "term-remove",
        attrs: { type: "button", "aria-label": `Remove term ${i + 1}` },
        text: "−",
      });
      removeButton.disabled = values.length <= MIN_ORDER;
      removeButton.addEventListener("click", () => {
        values = currentValues().filter((_, j) => j !== i);
        render();
        onChange();
      });
      field.input.addEventListener("input", onChange);
      return { wrapper: el("div", { className: "term-row-single" }, [field.wrapper, removeButton]), field };
    });
    rowsEl.replaceChildren(...rows.map((row) => row.wrapper));
    addButton.disabled = values.length >= MAX_ORDER;
    typesetMath([rowsEl]);
  }

  addButton.addEventListener("click", () => {
    values = [...currentValues(), "0"];
    render();
    onChange();
  });

  render();

  return {
    fields() {
      return rows;
    },
    readRaw() {
      return currentValues();
    },
  };
}
