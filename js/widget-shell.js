import { el } from "./dom.js";

/**
 * Wraps a widget's content in a collapsible <details> shell with a title —
 * every generator/verify widget on the page gets one of these instead of
 * mounting bare into its container div. Returns the body element; callers
 * mount their existing content into it exactly like they used to mount
 * into `container` directly (build/replaceChildren/append all still work —
 * this is a drop-in wrapper, not a rewrite of each widget's own logic).
 * Title colour is fixed in CSS (.widget-title) rather than passed in here,
 * since every widget uses the same one.
 *
 * Defaults to open so the page reads the same as before at first paint;
 * collapsing is an added affordance, not a way of hiding content by
 * default.
 */
export function mountWidgetShell(container, { title }) {
  const summary = el("summary", { className: "widget-title", text: title });
  const bodyEl = el("div", { className: "widget-body" });
  const details = el("details", { className: "widget", attrs: { open: "" } }, [summary, bodyEl]);

  container.replaceChildren(details);
  return bodyEl;
}
