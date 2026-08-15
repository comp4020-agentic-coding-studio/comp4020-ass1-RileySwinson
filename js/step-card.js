import { el } from "./dom.js";

function fmt(value) {
  return value.toLocaleString("en-AU");
}

function math(latex) {
  return `\\(${latex}\\)`;
}

const MOD = math("\\bmod");

/**
 * Renders one recurrence step as a compact two-line card: the integer
 * update with real numbers plugged in, then the [0,1) output derived from
 * it — as LaTeX for MathJax to typeset (see js/mathjax.js; callers call
 * typesetMath after inserting the returned node). Used by the MRG carousel
 * (js/carousel-view.js) — one card per generated value.
 *
 * Each line is built as many *small* `\(...\)` fragments interleaved with
 * plain text, not one long `\(...\)` spanning the whole line — MathJax
 * renders a single inline expression as one unbreakable unit, and with
 * real (multi-billion) numbers plugged in, one unbroken line overflows a
 * narrow card. Splitting at every operator gives the browser a wrap point
 * between each fragment, the same way ordinary text wraps between words.
 */
export function renderStepCard(step) {
  const k = step.coefficients.length;

  const termNodes = step.coefficients.flatMap((coefficient, i) => {
    const windowValue = step.priorWindow[k - 1 - i];
    const term = math(`${fmt(coefficient)} \\times ${fmt(windowValue)}`);
    return i === 0 ? [term] : [" + ", term];
  });
  if (step.constant !== null) termNodes.push(" + ", math(fmt(step.constant)));

  const modulusFrag = math(fmt(step.modulus));

  const xLine = el("p", { className: "step-line" }, [
    math(`X_{${step.t}}`),
    " = (",
    ...termNodes,
    ") ",
    MOD,
    " ",
    modulusFrag,
    " = ",
    math(fmt(step.rawSum)),
    " ",
    MOD,
    " ",
    modulusFrag,
    " = ",
    math(`\\mathbf{${fmt(step.result)}}`),
  ]);

  const uLine = el("p", { className: "step-line" }, [
    math(`U_{${step.t}}`),
    " = ",
    math(fmt(step.result)),
    " / ",
    modulusFrag,
    " ≈ ",
    math(`\\mathbf{${step.output.toFixed(5)}}`),
  ]);

  return el("div", { className: "step-card", attrs: { "data-step-index": String(step.t) } }, [
    el("p", { className: "step-label", text: `Step ${step.t}` }),
    xLine,
    uLine,
  ]);
}
