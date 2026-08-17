// Tiny DOM-building helpers shared by every renderer in js/ — avoids
// repeating the same createElement/className/append boilerplate across
// dot-carousel.js, lcg-widget.js, lcg-stream-widget.js, mrg-widget.js,
// mrg-stream-widget.js, term-list.js, and the verify-*.js widgets.

/**
 * Creates an element. `children` may mix strings (become text nodes) and
 * Nodes, so subscripted labels can be built inline:
 * `el("span", { className: "var" }, ["X", el("sub", { text: "3" })])`.
 */
export function el(tag, { className, attrs, text } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  }
  if (text !== undefined) node.textContent = text;
  if (children.length) node.append(...children);
  return node;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** Same idea as el(), for SVG elements (createElementNS instead of createElement, no className shorthand). */
export function svgEl(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (children.length) node.append(...children);
  return node;
}

/**
 * Wraps a plot `<svg>` with an x-axis label below it and a y-axis label
 * beside it — shared by js/verify-engine.js and js/verify-stage2-engine.js
 * so both scatter plots say what their axes actually mean instead of
 * leaving the reader to guess from the surrounding prose.
 */
export function axisPlot(svg, { xLabel, yLabel }) {
  const body = el("div", { className: "verify-plot-body" }, [
    el("span", { className: "verify-axis-label verify-axis-y", text: yLabel }),
    svg,
  ]);
  return el("div", { className: "verify-plot" }, [
    body,
    el("span", { className: "verify-axis-label verify-axis-x", text: xLabel }),
  ]);
}
