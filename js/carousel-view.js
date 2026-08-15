import { el } from "./dom.js";
import { renderStepCard } from "./step-card.js";
import { typesetMath } from "./mathjax.js";

/**
 * Renders the k-length moving window as a row of labelled boxes, oldest
 * first — the value about to drop off gets `.window-slot-oldest`. Exported
 * separately from mountCarousel so the window itself is a reusable, testable
 * unit if this page ever needs it standalone.
 */
export function renderWindowVisualization(step) {
  const k = step.priorWindow.length;
  const slots = step.priorWindow.map((value, i) => {
    const subscriptIndex = step.t - k + i;
    const className = i === 0 ? "window-slot window-slot-oldest" : "window-slot";
    return el("li", { className }, [
      el("span", { className: "window-slot-label", text: `\\(X_{${subscriptIndex}}\\)` }),
      el("span", { className: "window-slot-value", text: value.toLocaleString("en-AU") }),
    ]);
  });

  return el("ol", { className: "window", attrs: { "aria-label": "Current moving window" } }, slots);
}

/**
 * Mounts a paginated, one-step-at-a-time view: the moving window, then a
 * step card (js/step-card.js), then Prev/Next controls. Used for the MRG
 * widget — one card per generated value (contrast js/dot-carousel.js,
 * which pages through the micro-steps of deriving a single value).
 */
export function mountCarousel(container, initialSteps) {
  let steps = initialSteps;
  let currentIndex = 0;

  const windowEl = el("div", { className: "carousel-window" });
  const viewportEl = el("div", { className: "carousel-viewport" });
  const prevButton = el("button", {
    className: "carousel-prev",
    attrs: { type: "button", "data-carousel-prev": "" },
    text: "Previous",
  });
  const nextButton = el("button", {
    className: "carousel-next",
    attrs: { type: "button", "data-carousel-next": "" },
    text: "Next",
  });
  const label = el("p", {
    className: "carousel-label",
    attrs: { "aria-live": "polite", "data-step-label": "" },
  });

  function render() {
    windowEl.replaceChildren();
    viewportEl.replaceChildren();

    if (steps.length === 0) {
      label.textContent = "No steps to show yet";
      prevButton.disabled = true;
      nextButton.disabled = true;
      return;
    }

    const step = steps[currentIndex];
    windowEl.append(renderWindowVisualization(step));
    viewportEl.append(renderStepCard(step));
    label.textContent = `Step ${currentIndex + 1} of ${steps.length}`;
    prevButton.disabled = currentIndex === 0;
    nextButton.disabled = currentIndex === steps.length - 1;
    typesetMath([windowEl, viewportEl]);
  }

  prevButton.addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex -= 1;
      render();
    }
  });

  nextButton.addEventListener("click", () => {
    if (currentIndex < steps.length - 1) {
      currentIndex += 1;
      render();
    }
  });

  const controls = el("div", { className: "carousel-controls" }, [prevButton, label, nextButton]);
  const root = el("div", { className: "carousel" }, [windowEl, viewportEl, controls]);

  container.replaceChildren();
  container.append(root);
  render();

  return {
    setSteps(newSteps) {
      steps = newSteps;
      currentIndex = Math.min(currentIndex, Math.max(steps.length - 1, 0));
      render();
    },
  };
}
