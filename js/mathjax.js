/**
 * Thin wrapper around MathJax's typesetPromise. Every widget view (chain,
 * carousel, param labels) sets LaTeX source as plain text and then calls
 * this to have MathJax render it in place.
 *
 * Two things this guards against:
 * - The CDN `<script>` is loaded `async`, so widgets can mount and call
 *   this before MathJax has finished starting up — queue through
 *   `MathJax.startup.promise` rather than dropping the call.
 * - Under `vitest`/jsdom (see spec/assignment-1.test.ts), no MathJax script
 *   ever runs at all — `window.MathJax` is simply undefined there, so this
 *   is a no-op and the widgets fall back to showing raw LaTeX source as
 *   plain text, which is exactly what those tests assert on.
 */
export function typesetMath(nodes) {
  const mathjax = window.MathJax;
  if (!mathjax) return;

  if (mathjax.typesetPromise) {
    mathjax.typesetPromise(nodes).catch((error) => console.error("MathJax typeset failed:", error));
  } else if (mathjax.startup?.promise) {
    mathjax.startup.promise.then(() => mathjax.typesetPromise(nodes));
  }
}
