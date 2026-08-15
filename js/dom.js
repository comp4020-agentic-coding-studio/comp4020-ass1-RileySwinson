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
