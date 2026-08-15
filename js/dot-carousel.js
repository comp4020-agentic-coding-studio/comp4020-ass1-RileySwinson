import { el } from "./dom.js";
import { typesetMath } from "./mathjax.js";

/**
 * Generic dot-indicator carousel: one dot per slide (click to jump
 * straight to it), Prev/Next, and a crossfade/morph between slides via the
 * View Transitions API — elements that share a `view-transition-name`
 * across two slides (see js/lcg-widget.js's colour-coded chips) animate
 * their position and appearance smoothly instead of hard-cutting; anything
 * else just crossfades. Chrome supports this (the browser this course
 * marks in); browsers that don't just get an instant swap, no error.
 *
 * `slides` is an array of zero-arg functions, each returning the
 * HTMLElement for that slide — built fresh on every visit so a caller can
 * close over live state (e.g. current a/c/m/seed) without this module
 * knowing anything about slide content.
 */
export function mountDotCarousel(container, slides) {
  let currentIndex = 0;
  let transitioning = false;

  const viewport = el("div", { className: "dot-carousel-viewport" });
  const dotsEl = el("div", {
    className: "dot-carousel-dots",
    attrs: { role: "group", "aria-label": "Steps" },
  });
  const prevButton = el("button", {
    className: "carousel-prev",
    attrs: { type: "button" },
    text: "Previous",
  });
  const nextButton = el("button", {
    className: "carousel-next",
    attrs: { type: "button" },
    text: "Next",
  });
  const label = el("p", { className: "carousel-label", attrs: { "aria-live": "polite" } });

  function buildDots() {
    dotsEl.replaceChildren(
      ...slides.map((_, i) => {
        const dot = el("button", {
          className: "dot-carousel-dot",
          attrs: { type: "button", "aria-label": `Go to step ${i + 1} of ${slides.length}` },
        });
        dot.addEventListener("click", () => goTo(i));
        return dot;
      }),
    );
  }

  // Disabled both at the ends and, separately, for the whole time a view
  // transition is in flight — clicking Next again before a ~0.4s
  // transition finishes starts a second one on top of the first, and the
  // browser's handling of that overlap looks like a visible glitch (an
  // old value briefly stuck mid-animation over the new slide).
  function updateControlsDisabled() {
    prevButton.disabled = transitioning || currentIndex === 0;
    nextButton.disabled = transitioning || currentIndex === slides.length - 1;
    for (const dot of dotsEl.children) dot.disabled = transitioning;
  }

  function renderCurrent() {
    viewport.replaceChildren(slides[currentIndex]());
    [...dotsEl.children].forEach((dot, i) => dot.classList.toggle("is-active", i === currentIndex));
    label.textContent = `Step ${currentIndex + 1} of ${slides.length}`;
    updateControlsDisabled();
    typesetMath([viewport]);
  }

  function goTo(index) {
    if (transitioning || index < 0 || index >= slides.length || index === currentIndex) return;
    currentIndex = index;
    if (document.startViewTransition) {
      transitioning = true;
      updateControlsDisabled();
      const transition = document.startViewTransition(() => renderCurrent());
      transition.finished.finally(() => {
        transitioning = false;
        updateControlsDisabled();
      });
    } else {
      renderCurrent();
    }
  }

  prevButton.addEventListener("click", () => goTo(currentIndex - 1));
  nextButton.addEventListener("click", () => goTo(currentIndex + 1));

  const controls = el("div", { className: "carousel-controls" }, [prevButton, label, nextButton]);
  const root = el("div", { className: "dot-carousel" }, [viewport, dotsEl, controls]);

  container.replaceChildren(root);
  buildDots();
  renderCurrent();

  return {
    setSlides(newSlides) {
      const lengthChanged = newSlides.length !== slides.length;
      slides = newSlides;
      if (lengthChanged) {
        currentIndex = Math.min(currentIndex, slides.length - 1);
        buildDots();
      }
      renderCurrent();
    },
  };
}
