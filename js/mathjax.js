const READY_POLL_MS = 50;
const READY_POLL_LIMIT = 100; // ~5s — well past any real CDN fetch

/**
 * Thin wrapper around MathJax's typesetPromise. Every widget view (chain,
 * carousel, param labels) sets LaTeX source as plain text and then calls
 * this to have MathJax render it in place.
 *
 * Three things this guards against:
 * - The CDN `<script>` is loaded `async`, so widgets can mount and call
 *   this before MathJax has finished starting up — queue through
 *   `MathJax.startup.promise` rather than dropping the call.
 * - There's a narrower race inside that: `window.MathJax` is assigned as a
 *   bare config object in the page's head *before* the CDN script tag even
 *   starts executing, so `window.MathJax` can be truthy while neither
 *   `.typesetPromise` nor `.startup` exists yet. Module scripts (this one
 *   included) can easily run inside that window on a fast machine, and the
 *   old version of this function just dropped the call when it landed
 *   there — the field labels stayed as raw "\(a\)" text forever, with
 *   nothing left to retry it. Poll briefly instead of dropping it.
 * - Under `vitest`/jsdom (see spec/assignment-1.test.ts), no MathJax script
 *   ever runs at all — `window.MathJax` is simply undefined there, so this
 *   is a no-op and the widgets fall back to showing raw LaTeX source as
 *   plain text, which is exactly what those tests assert on.
 */
export function typesetMath(nodes, attempt = 0) {
  const mathjax = window.MathJax;
  if (!mathjax) return;

  if (mathjax.typesetPromise) {
    mathjax.typesetPromise(nodes).catch((error) => console.error("MathJax typeset failed:", error));
  } else if (mathjax.startup?.promise) {
    mathjax.startup.promise.then(() => mathjax.typesetPromise(nodes));
  } else if (attempt < READY_POLL_LIMIT) {
    setTimeout(() => typesetMath(nodes, attempt + 1), READY_POLL_MS);
  } else {
    console.error("MathJax never finished starting up — leaving raw LaTeX source in place.");
  }
}
