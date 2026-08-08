import { Tracer } from "./js/gl-engine.js";

// Every `[data-tracer]` canvas on the page gets its own live path tracer.
// Pausing offscreen ones matters: a few of these running at once is enough
// to cook a phone if they all keep tracing while scrolled out of view.
function setUpTracer(canvas) {
  const panel = canvas.closest("[data-tracer-panel]") ?? canvas.parentElement;
  const reseedButton = panel?.querySelector("[data-reseed]");
  const samplesEl = panel?.querySelector("[data-stat='samples']");
  const mseEl = panel?.querySelector("[data-stat='mse']");
  const noticeEl = panel?.querySelector("[data-notice]");

  const tracer = new Tracer(canvas, {
    onUnsupported(message) {
      canvas.hidden = true;
      if (noticeEl) {
        noticeEl.hidden = false;
        noticeEl.textContent = message;
      }
    },
    onStats({ samples }) {
      if (samplesEl) samplesEl.textContent = samples.toLocaleString();
    },
    onError(mse) {
      if (mseEl) mseEl.textContent = mse.toExponential(2);
    },
  });

  reseedButton?.addEventListener("click", () => tracer.reseed());

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) tracer.start();
        else tracer.pause();
      }
    },
    { threshold: 0.01 },
  );
  observer.observe(canvas);

  return tracer;
}

for (const canvas of document.querySelectorAll("[data-tracer]")) {
  setUpTracer(canvas);
}
