import { el } from "./dom.js";
import { buildField } from "./field.js";
import { parseBigIntField, validateParams, mod } from "./recurrence.js";
import { mountDotCarousel } from "./dot-carousel.js";
import { typesetMath } from "./mathjax.js";
import { mountWidgetShell } from "./widget-shell.js";

function fmt(value) {
  return value.toLocaleString("en-AU");
}

function math(latex) {
  return `\\(${latex}\\)`;
}

/**
 * One colour-coded math fragment — reserved for things that need real math
 * rendering (a subscript, `\mathbf`, an italic variable letter) or that
 * carry a colour/view-transition identity. Plain operators (=, +, mod, …)
 * are pushed as bare strings instead, on purpose: MathJax's automatic
 * spacing around an operator depends on knowing the tokens next to it
 * *within the same `\(...\)` source* — a standalone `\( = \)` fragment has
 * nothing to space itself against and renders with the gap collapsed, so
 * two independently-typeset chips end up jammed together. Plain text
 * between chips sidesteps that entirely and just uses normal HTML spacing.
 *
 * `name`, when given, is a view-transition-name shared with the matching
 * chip in an adjacent slide — see the per-slide comments below for which
 * identities are threaded across which slides, and js/dot-carousel.js for
 * how the transition itself is triggered.
 */
function chip(latex, { color, name } = {}) {
  const span = el("span", { className: color ? `math-chip ${color}` : "math-chip", text: math(latex) });
  if (name) span.style.viewTransitionName = name;
  return span;
}

/**
 * `text` may be a plain string, or an array of strings/chips for sentences
 * that reference a coloured variable inline — a bare string never gets
 * MathJax-scanned for `\(...\)`, so any LaTeX has to arrive as its own
 * chip node, not embedded in the string. `lines` is an array of arrays —
 * one `<p class="slide-math">` per line, since some slides restate a
 * formula on a second line rather than cramming both onto one.
 */
function slide(text, lines) {
  const textEl = el("p", { className: "slide-text" });
  textEl.append(...(Array.isArray(text) ? text : [text]));
  const mathEls = lines.map((line) => el("p", { className: "slide-math" }, line));
  return el("div", { className: "slide" }, [textEl, ...mathEls]);
}

/**
 * Builds the 9 slides that walk through deriving X_1 (and U_1) from the
 * current a/c/m/seed — fresh closures over `state` so js/dot-carousel.js
 * can call each one lazily and always get up-to-date numbers.
 *
 * The seed's identity (`lcg-seed`) starts neutral in slide 2 (X_{1-1} is
 * just a reference at that point) and turns teal once slide 3 resolves it
 * to the seed — that recolour-on-morph is the "this term IS the seed"
 * moment. `lcg-a`/`lcg-c`/`lcg-m` are coloured from their first
 * appearance, since there's no equivalent reveal for them. `lcg-focus`
 * threads the single most-relevant derived number through multiply → add →
 * modulus → the X_1 reveal, turning yellow only once it becomes The
 * Answer in slide 8, then carries into slide 9's U_1 line.
 */
function buildSlides(state) {
  const { a, c, m, seed } = state;
  const product = a * seed;
  const sum = product + c;
  const remainder = mod(sum, m);
  const output = Number(remainder) / Number(m);

  return [
    () =>
      slide("First, we set our starting state.", [
        [
          chip("X_0", { color: "var-seed" }),
          " = ",
          chip("X", { color: "var-seed" }),
          " = ",
          chip(fmt(seed), { color: "var-seed" }),
        ],
      ]),

    () =>
      slide(["To compute our first pseudo-random number — meaning ", chip("t = 1"), " — we compute:"], [
        [
          chip("X_1"),
          " = (",
          chip("a", { color: "var-a", name: "lcg-a" }),
          chip("X_{1-1}", { name: "lcg-seed" }),
          " + ",
          chip("c", { color: "var-c", name: "lcg-c" }),
          ") mod ",
          chip("m", { color: "var-m", name: "lcg-m" }),
        ],
      ]),

    () =>
      slide([chip("X_{1-1} = X_0"), ", which is our seed."], [
        [
          chip("X_{1-1}"),
          " = ",
          chip("X_0"),
          " = ",
          chip(fmt(seed), { color: "var-seed", name: "lcg-seed" }),
        ],
        [
          chip("X_1"),
          " = (",
          chip("a", { color: "var-a" }),
          " × ",
          chip(fmt(seed), { color: "var-seed" }),
          " + ",
          chip("c", { color: "var-c" }),
          ") mod ",
          chip("m", { color: "var-m" }),
        ],
      ]),

    () =>
      slide(
        [
          "Now we substitute in our values for ",
          chip("a", { color: "var-a" }),
          ", ",
          chip("c", { color: "var-c" }),
          ", and ",
          chip("m", { color: "var-m" }),
          ".",
        ],
        [
          [
            chip("X_1"),
            " = (",
            chip(fmt(a), { color: "var-a", name: "lcg-a" }),
            " × ",
            chip(fmt(seed), { color: "var-seed", name: "lcg-seed" }),
            " + ",
            chip(fmt(c), { color: "var-c", name: "lcg-c" }),
            ") mod ",
            chip(fmt(m), { color: "var-m", name: "lcg-m" }),
          ],
        ],
      ),

    () =>
      slide("First, we multiply.", [
        [
          chip(fmt(a), { color: "var-a", name: "lcg-a" }),
          " × ",
          chip(fmt(seed), { color: "var-seed", name: "lcg-seed" }),
          " = ",
          chip(`\\mathbf{${fmt(product)}}`, { name: "lcg-focus" }),
        ],
      ]),

    () =>
      slide(["Then we add ", chip("c", { color: "var-c" }), "."], [
        [
          chip(fmt(product)),
          " + ",
          chip(fmt(c), { color: "var-c", name: "lcg-c" }),
          " = ",
          chip(`\\mathbf{${fmt(sum)}}`, { name: "lcg-focus" }),
        ],
      ]),

    () =>
      slide(
        [
          "Finally, we apply the modulus — dividing by ",
          chip("m", { color: "var-m" }),
          " and keeping the remainder.",
        ],
        [
          [
            chip(fmt(sum)),
            " ÷ ",
            chip(fmt(m), { color: "var-m", name: "lcg-m" }),
            " has remainder ",
            chip(`\\mathbf{${fmt(remainder)}}`, { name: "lcg-focus" }),
            " — meaning the value of the modulo is ",
            chip(`\\mathbf{${fmt(remainder)}}`),
          ],
        ],
      ),

    () =>
      slide("Our first pseudo-random number is:", [
        [chip("X_1"), " = ", chip(`\\mathbf{${fmt(remainder)}}`, { color: "var-result", name: "lcg-focus" })],
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
            chip("U_1"),
            " = ",
            chip("X_1"),
            " / ",
            chip("m", { color: "var-m", name: "lcg-m" }),
            " = ",
            chip(fmt(remainder), { color: "var-result", name: "lcg-focus" }),
            " / ",
            chip(fmt(m)),
            " ≈ ",
            chip(`\\mathbf{${output.toFixed(5)}}`, { color: "var-result", name: "lcg-u1" }),
          ],
        ],
      ),
  ];
}

/**
 * A `view-transition-name` must be unique across the whole document at
 * once — fine for the carousel, which only ever shows one slide, but the
 * "show all steps" view below renders every slide's chips simultaneously
 * *alongside* whichever slide the carousel is currently showing, which
 * would duplicate every name still on screen. Strips them from this
 * static copy since nothing here animates in place anyway.
 */
function stripViewTransitionNames(node) {
  if (node.nodeType === Node.ELEMENT_NODE && node.style.viewTransitionName) {
    node.style.viewTransitionName = "";
  }
  for (const child of node.childNodes) stripViewTransitionNames(child);
  return node;
}

/**
 * Renders every slide at once, stacked, for the "show all steps at once"
 * disclosure — the same slide-builder functions the carousel pages
 * through one at a time, just all called and appended up front instead of
 * lazily.
 */
function buildAllStepsView(slideBuilders) {
  const items = slideBuilders.map((build) =>
    el("li", { className: "all-steps-item" }, [stripViewTransitionNames(build())]),
  );
  return el("ol", { className: "all-steps-list" }, items);
}

function buildModulusDetails() {
  return el("details", { className: "modulus-details" }, [
    el("summary", { text: "What is the modulus operator?" }),
    el("p", {
      text: "The modulus operation (written mod) finds the remainder left over after dividing one whole number by another.",
    }),
    el("p", {}, ["For example: ", chip("17 \\bmod 5 = 2"), " — because ", chip("17 = 3 \\times 5 + 2"), "."]),
    el("p", {
      text: "It's what makes a generator cycle: however large a number gets, mod m always wraps it back into the range [0, m).",
    }),
  ]);
}

/**
 * Mounts the "what is modulus?" aside as its own standalone element —
 * kept outside the LCG widget's own container so it reads as page prose
 * sitting below the widget, not as one more thing crammed inside it.
 */
export function mountModulusDetails(container) {
  const detailsEl = buildModulusDetails();
  container.replaceChildren(detailsEl);
  typesetMath([detailsEl]);
}

/**
 * Mounts the LCG walkthrough widget: editable a/c/m/seed fields and the
 * 9-slide dot-carousel above. Every keystroke rebuilds the slide set from
 * the current field values (see buildSlides) and pushes it into the
 * carousel without losing the reader's place — js/dot-carousel.js keeps
 * whatever step they're on.
 */
export function mountLcgWidget(container, defaults) {
  const fields = {
    a: buildField("lcg-a", "\\(a\\)", defaults.a),
    c: buildField("lcg-c", "\\(c\\)", defaults.c),
    m: buildField("lcg-m", "\\(m\\)", defaults.m),
    seed: buildField("lcg-seed", "\\(X\\)", defaults.seed),
  };
  const fieldList = Object.values(fields);

  const paramsEl = el("div", { className: "params" }, fieldList.map((f) => f.wrapper));
  const carouselEl = el("div", { className: "widget-computation" });
  const allStepsBody = el("div", {});
  const allStepsEl = el("details", { className: "all-steps-details" }, [
    el("summary", { text: "Show all steps at once" }),
    allStepsBody,
  ]);

  const bodyEl = mountWidgetShell(container, { title: "LCG walkthrough" });
  bodyEl.append(paramsEl, carouselEl, allStepsEl);
  typesetMath([paramsEl]);

  function readParams() {
    return {
      a: parseBigIntField(fields.a.input.value),
      c: parseBigIntField(fields.c.input.value),
      m: parseBigIntField(fields.m.input.value),
      seed: parseBigIntField(fields.seed.input.value),
    };
  }

  function clearErrors() {
    for (const field of fieldList) {
      field.error.textContent = "";
      field.input.removeAttribute("aria-invalid");
    }
  }

  function showErrors(errors) {
    const fieldsByKey = {
      modulus: fields.m,
      "coefficient-0": fields.a,
      constant: fields.c,
      "seed-0": fields.seed,
    };
    for (const [key, message] of Object.entries(errors)) {
      const field = fieldsByKey[key];
      if (!field) continue;
      field.error.textContent = message;
      field.input.setAttribute("aria-invalid", "true");
    }
  }

  function renderAllSteps(slides) {
    allStepsBody.replaceChildren(buildAllStepsView(slides));
    typesetMath([allStepsBody]);
  }

  const initialSlides = buildSlides(readParams());
  const carouselHandle = mountDotCarousel(carouselEl, initialSlides);
  renderAllSteps(initialSlides);

  function recompute() {
    const raw = readParams();
    clearErrors();

    const stillBeingEdited = Object.values(raw).some((value) => value === null);
    if (stillBeingEdited) return;

    const { valid, errors } = validateParams({
      modulus: raw.m,
      coefficients: [raw.a],
      constant: raw.c,
      seedWindow: [raw.seed],
    });
    if (!valid) {
      showErrors(errors);
      return;
    }

    const slides = buildSlides(raw);
    carouselHandle.setSlides(slides);
    renderAllSteps(slides);
  }

  for (const field of fieldList) {
    field.input.addEventListener("input", recompute);
  }

  return { recompute };
}
