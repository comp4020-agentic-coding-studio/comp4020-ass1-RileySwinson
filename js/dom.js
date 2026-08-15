// Tiny DOM-building helper shared by every renderer in js/ — avoids
// repeating the same createElement/className/append boilerplate across
// step-card.js, carousel-view.js, dot-carousel.js, lcg-widget.js,
// stream.js, and widget.js.

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
