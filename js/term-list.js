import { el } from "./dom.js";
import { buildField } from "./field.js";
import { typesetMath } from "./mathjax.js";

const MIN_ORDER = 1;
const MAX_ORDER = 6;

/**
 * Manages a variable-length list of (a_i, X_i) field pairs — an MRG's
 * order k — with Add/Remove controls. Shared by the MRG walkthrough
 * (js/mrg-widget.js) and the MRG stream widget (js/mrg-stream-widget.js),
 * since both need identical "grow or shrink the recursion" behaviour.
 *
 * Rows are rebuilt from scratch on every add/remove rather than patched
 * in place — labels are position-dependent (a_1, a_2, …), so removing
 * row 2 has to renumber everything after it; rebuilding from the current
 * values is simpler and safer than trying to patch indices in place.
 */
export function mountTermList(container, { idPrefix, initialTerms, onChange }) {
  let terms = initialTerms.map((t) => ({ a: t.a, seed: t.seed }));
  let rows = [];

  const rowsEl = el("div", { className: "term-rows" });
  const addButton = el("button", {
    className: "term-add",
    attrs: { type: "button" },
    text: "+ Add a term",
  });
  container.replaceChildren(rowsEl, addButton);

  function currentValues() {
    return rows.map((row) => ({ a: row.aField.input.value, seed: row.seedField.input.value }));
  }

  function render() {
    rows = terms.map((term, i) => {
      const aField = buildField(`${idPrefix}-a-${i}`, `\\(a_{${i + 1}}\\)`, term.a);
      const seedField = buildField(`${idPrefix}-seed-${i}`, `\\(X_{${i + 1}}\\)`, term.seed);
      const removeButton = el("button", {
        className: "term-remove",
        attrs: { type: "button", "aria-label": `Remove term ${i + 1}` },
        text: "−",
      });
      removeButton.disabled = terms.length <= MIN_ORDER;
      removeButton.addEventListener("click", () => {
        terms = currentValues().filter((_, j) => j !== i);
        render();
        onChange();
      });
      aField.input.addEventListener("input", onChange);
      seedField.input.addEventListener("input", onChange);
      return {
        wrapper: el("div", { className: "term-row" }, [aField.wrapper, seedField.wrapper, removeButton]),
        aField,
        seedField,
      };
    });
    rowsEl.replaceChildren(...rows.map((row) => row.wrapper));
    addButton.disabled = terms.length >= MAX_ORDER;
    typesetMath([rowsEl]);
  }

  addButton.addEventListener("click", () => {
    terms = [...currentValues(), { a: "0", seed: "0" }];
    render();
    onChange();
  });

  render();

  return {
    get order() {
      return rows.length;
    },
    fields() {
      return rows;
    },
    readRaw() {
      return currentValues();
    },
  };
}
