import { el } from "./dom.js";

const DEFAULT_MAX = 30;

/**
 * Renders the raw U_t stream as a wrapped row of badges — shared by both
 * the LCG and MRG widgets. Capped so an unusually large step count can't
 * make the page unusably long.
 */
export function renderStream(container, steps, opts = {}) {
  const max = opts.max ?? DEFAULT_MAX;
  const shown = steps.slice(0, max);

  container.replaceChildren();
  container.append(
    el("ul", { className: "stream", attrs: { "aria-label": "Generated output stream" } },
      shown.map((step) => el("li", { className: "stream-value", text: step.output.toFixed(5) })),
    ),
  );

  if (steps.length > max) {
    container.append(
      el("p", {
        className: "stream-note",
        text: `Showing the first ${max} of ${steps.length} generated values.`,
      }),
    );
  }
}
