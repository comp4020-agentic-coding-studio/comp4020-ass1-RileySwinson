import { el } from "./dom.js";
import { buildField } from "./field.js";
import { mountTermList } from "./term-list.js";
import { parseBigIntField, validateParams, runSequence } from "./recurrence.js";
import { mountDotCarousel } from "./dot-carousel.js";
import { typesetMath } from "./mathjax.js";
import { mountWidgetShell } from "./widget-shell.js";

function fmt(value) {
  return value.toLocaleString("en-AU");
}

function math(latex) {
  return `\\(${latex}\\)`;
}

function chip(latex, { color, name } = {}) {
  const span = el("span", { className: color ? `math-chip ${color}` : "math-chip", text: math(latex) });
  if (name) span.style.viewTransitionName = name;
  return span;
}

function slide(text, lines) {
  const textEl = el("p", { className: "slide-text" });
  textEl.append(...(Array.isArray(text) ? text : [text]));
  const mathEls = lines.map((line) => el("p", { className: "slide-math" }, line));
  return el("div", { className: "slide" }, [textEl, ...mathEls]);
}

/**
 * Builds the walkthrough for one MRG step (X_t, t = k+1) from a single
 * StepRecord (js/recurrence.js) — the same math core the LCG widgets use,
 * with order k read directly off `step.coefficients.length`.
 *
 * Unlike the LCG walkthrough, this doesn't dedicate a slide to resolving
 * each X_{t-i} to a numbered seed (X_{1-1} = X_0, …) — with up to 6 terms
 * that bridging step would repeat k times for little payoff once the LCG
 * section has already taught the idea once. Multiply and add are also
 * collapsed into a single slide (k product lines + one sum line) instead
 * of two, so the slide count stays bounded regardless of k.
 */
function buildSlides(step) {
  const k = step.coefficients.length;
  // recurrence.js labels seeds 0-indexed (X_0..X_{k-1}, first output X_k);
  // this page's MRG prose labels them 1-indexed (X_1..X_k, first output
  // X_{k+1}) to match the "choose X_1 through X_k" wording. t is a pure
  // label in a StepRecord (never used in the arithmetic), so shifting it
  // by 1 here is enough to make every display below match the prose.
  const t = step.t + 1;

  const seedLines = step.priorWindow.map((value, i) => [
    chip(`X_${i + 1}`, { color: "var-seed", name: `mrg-seed-${i}` }),
    " = ",
    chip(fmt(value), { color: "var-seed" }),
  ]);

  function formulaTerms(useNumbers) {
    return step.coefficients.flatMap((coefficient, i) => {
      const seedIndex = k - 1 - i; // priorWindow index this coefficient pairs with
      const seedValue = step.priorWindow[seedIndex];
      const node = useNumbers
        ? [
            chip(fmt(coefficient), { color: "var-a", name: `mrg-a-${i}` }),
            " × ",
            chip(fmt(seedValue), { color: "var-seed", name: `mrg-seed-${seedIndex}` }),
          ]
        : [
            chip(`a_${i + 1}`, { color: "var-a", name: `mrg-a-${i}` }),
            chip(`X_{${t - 1 - i}}`, { name: `mrg-seed-${seedIndex}` }),
          ];
      return i === 0 ? node : [" + ", ...node];
    });
  }

  const multiplyLines = step.coefficients.map((coefficient, i) => {
    const seedValue = step.priorWindow[k - 1 - i];
    const product = coefficient * seedValue;
    return [
      chip(fmt(coefficient), { color: "var-a" }),
      " × ",
      chip(fmt(seedValue), { color: "var-seed" }),
      " = ",
      chip(`\\mathbf{${fmt(product)}}`),
    ];
  });

  const sumLine = [
    ...step.coefficients.flatMap((coefficient, i) => {
      const seedValue = step.priorWindow[k - 1 - i];
      const node = chip(fmt(coefficient * seedValue));
      return i === 0 ? [node] : [" + ", node];
    }),
    " = ",
    chip(`\\mathbf{${fmt(step.rawSum)}}`, { name: "mrg-focus" }),
  ];

  return [
    () => slide(k === 1 ? "First, we set our seed value." : "First, we set our seed values.", seedLines),

    () =>
      slide(["To compute our first pseudo-random number — meaning ", chip(`t = ${t}`), " — we compute:"], [
        [chip(`X_{${t}}`), " = (", ...formulaTerms(false), ") mod ", chip("m", { color: "var-m", name: "mrg-m" })],
      ]),

    () =>
      slide("Now we substitute in our values for each multiplier and seed.", [
        [
          chip(`X_{${t}}`),
          " = (",
          ...formulaTerms(true),
          ") mod ",
          chip(fmt(step.modulus), { color: "var-m", name: "mrg-m" }),
        ],
      ]),

    () =>
      slide(
        k === 1
          ? "We multiply, then apply the modulus next."
          : "We multiply each term, then add them all together.",
        [...multiplyLines, sumLine],
      ),

    () =>
      slide(
        ["Finally, we apply the modulus — dividing by ", chip("m", { color: "var-m" }), " and keeping the remainder."],
        [
          [
            chip(fmt(step.rawSum)),
            " ÷ ",
            chip(fmt(step.modulus), { color: "var-m", name: "mrg-m" }),
            " has remainder ",
            chip(`\\mathbf{${fmt(step.result)}}`, { name: "mrg-focus" }),
          ],
        ],
      ),

    () =>
      slide(`Our first pseudo-random number is:`, [
        [chip(`X_{${t}}`), " = ", chip(`\\mathbf{${fmt(step.result)}}`, { color: "var-result", name: "mrg-focus" })],
      ]),

    () =>
      slide(
        [
          "To get a value in ",
          chip("[0, 1)"),
          ", we normalise by dividing by ",
          chip("m", { color: "var-m" }),
          " one more time.",
        ],
        [
          [
            chip(`U_{${t}}`),
            " = ",
            chip(`X_{${t}}`),
            " / ",
            chip("m", { color: "var-m", name: "mrg-m" }),
            " = ",
            chip(fmt(step.result), { color: "var-result", name: "mrg-focus" }),
            " / ",
            chip(fmt(step.modulus)),
            " ≈ ",
            chip(`\\mathbf{${step.output.toFixed(5)}}`, { color: "var-result", name: "mrg-u" }),
          ],
        ],
      ),
  ];
}

/**
 * Mounts the MRG walkthrough: an editable modulus, a variable-order list
 * of (a_i, X_i) terms (js/term-list.js — add/remove to change k), and a
 * dot-carousel walking through deriving X_{k+1} from the current values.
 */
export function mountMrgWidget(container, defaults) {
  const mField = buildField("mrg-walk-m", "\\(m\\)", defaults.m);
  const paramsEl = el("div", { className: "params" }, [mField.wrapper]);
  const termListEl = el("div", { className: "mrg-terms" });
  const carouselEl = el("div", { className: "widget-computation" });

  const bodyEl = mountWidgetShell(container, { title: "MRG walkthrough" });
  bodyEl.append(paramsEl, termListEl, carouselEl);
  typesetMath([paramsEl]);

  let carouselHandle = null;

  function clearErrors() {
    mField.error.textContent = "";
    mField.input.removeAttribute("aria-invalid");
    for (const row of termList.fields()) {
      row.aField.error.textContent = "";
      row.aField.input.removeAttribute("aria-invalid");
      row.seedField.error.textContent = "";
      row.seedField.input.removeAttribute("aria-invalid");
    }
  }

  function showErrors(errors) {
    if (errors.modulus) {
      mField.error.textContent = errors.modulus;
      mField.input.setAttribute("aria-invalid", "true");
    }
    const rows = termList.fields();
    for (const [key, message] of Object.entries(errors)) {
      const coefficientMatch = key.match(/^coefficient-(\d+)$/);
      const seedMatch = key.match(/^seed-(\d+)$/);
      const row = coefficientMatch ? rows[Number(coefficientMatch[1])] : seedMatch ? rows[Number(seedMatch[1])] : null;
      const field = coefficientMatch ? row?.aField : seedMatch ? row?.seedField : null;
      if (!field) continue;
      field.error.textContent = message;
      field.input.setAttribute("aria-invalid", "true");
    }
  }

  function recompute() {
    const modulus = parseBigIntField(mField.input.value);
    const rawTerms = termList.readRaw().map((t) => ({
      a: parseBigIntField(t.a),
      seed: parseBigIntField(t.seed),
    }));
    clearErrors();

    const stillBeingEdited = modulus === null || rawTerms.some((t) => t.a === null || t.seed === null);
    if (stillBeingEdited) return;

    const coefficients = rawTerms.map((t) => t.a);
    const seedWindow = rawTerms.map((t) => t.seed);

    const { valid, errors } = validateParams({ modulus, coefficients, constant: null, seedWindow });
    if (!valid) {
      showErrors(errors);
      return;
    }

    const [step] = runSequence({ seedWindow, coefficients, constant: null, modulus, steps: 1 });
    const slides = buildSlides(step);
    if (carouselHandle) carouselHandle.setSlides(slides);
    else carouselHandle = mountDotCarousel(carouselEl, slides);
  }

  const termList = mountTermList(termListEl, {
    idPrefix: "mrg-walk",
    initialTerms: defaults.terms,
    onChange: recompute,
  });

  mField.input.addEventListener("input", recompute);

  recompute();

  return { recompute };
}
