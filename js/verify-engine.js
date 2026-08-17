import { el, svgEl, axisPlot } from "./dom.js";
import { buildRateField } from "./field.js";
import { createChiSquaredTracker } from "./chi-squared.js";

const BIN_COUNT = 10;
const MAX_VISIBLE_POINTS = 150;
const MAX_TOTAL_SAMPLES = 20000; // safety cap — this runs on a timer indefinitely otherwise
const PLOT_W = 300;
const PLOT_H = 150;

/**
 * Shared stage-1 verify UI: a rate slider, a live scatter of the last
 * `MAX_VISIBLE_POINTS` generated values, and running stage-1 statistics
 * (n, mean, chi-squared against a uniform reference) computed over *every*
 * sample so far, not just the visible window — js/chi-squared.js's tracker
 * is incremental for exactly this reason.
 *
 * Used by both js/lcg-verify-widget.js and js/mrg-verify-widget.js —
 * neither generator's shape (order 1 vs order k) matters here, only that
 * the caller can hand back a zero-arg function that produces the next
 * U_t each time it's called.
 */
export function mountVerifyEngine(container, { idPrefix, defaultRate = 5, computeGenerator }) {
  const rateField = buildRateField(`${idPrefix}-rate`, defaultRate);

  const svg = svgEl("svg", { viewBox: `0 0 ${PLOT_W} ${PLOT_H}`, preserveAspectRatio: "none", class: "verify-svg" });
  svg.append(
    svgEl("line", { class: "verify-midline", x1: 0, y1: PLOT_H / 2, x2: PLOT_W, y2: PLOT_H / 2 }),
    svgEl("rect", { class: "verify-svg-border", x: 0.5, y: 0.5, width: PLOT_W - 1, height: PLOT_H - 1 }),
  );
  const pointsGroup = svgEl("g", { class: "verify-points" });
  svg.append(pointsGroup);
  const plotEl = axisPlot(svg, { xLabel: "sample order (most recent, left to right) →", yLabel: "U_t value" });

  const nStat = el("p", { className: "verify-stat" });
  const meanStat = el("p", { className: "verify-stat" });
  const chiStat = el("p", { className: "verify-stat" });
  const statsEl = el("div", { className: "verify-stats" }, [nStat, meanStat, chiStat]);

  const restartButton = el("button", { className: "carousel-prev", attrs: { type: "button" }, text: "Restart" });
  const pauseButton = el("button", { className: "carousel-next", attrs: { type: "button" }, text: "Pause" });
  const statusEl = el("p", { className: "console-status", attrs: { "aria-live": "polite" } });
  const controls = el("div", { className: "carousel-controls" }, [restartButton, statusEl, pauseButton]);

  container.replaceChildren(rateField.wrapper, plotEl, statsEl, controls);

  let timer = null;
  let running = true;
  let state = null; // { step, tracker, sum, points: number[] }

  function stopTimer() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function render() {
    pointsGroup.replaceChildren(
      ...state.points.map((value, i) => {
        const x = state.points.length === 1 ? PLOT_W / 2 : (i / (MAX_VISIBLE_POINTS - 1)) * PLOT_W;
        const y = (1 - value) * PLOT_H;
        return svgEl("circle", { cx: x.toFixed(2), cy: y.toFixed(2), r: 2 });
      }),
    );
    const n = state.tracker.n;
    const mean = n === 0 ? 0 : state.sum / n;
    nStat.textContent = `n = ${n.toLocaleString("en-AU")}`;
    meanStat.textContent = `mean ≈ ${mean.toFixed(4)} (expect ≈ 0.5)`;
    chiStat.textContent = `χ² ≈ ${state.tracker.statistic().toFixed(2)} (expect ≈ ${state.tracker.degreesOfFreedom} if uniform)`;
  }

  function tick() {
    if (!state) return;
    const value = state.step();
    state.tracker.add(value);
    state.sum += value;
    state.points.push(value);
    if (state.points.length > MAX_VISIBLE_POINTS) state.points.shift();
    render();

    if (state.tracker.n >= MAX_TOTAL_SAMPLES) {
      statusEl.textContent = `Stopped at ${MAX_TOTAL_SAMPLES.toLocaleString("en-AU")} samples`;
      running = false;
      pauseButton.disabled = true;
      stopTimer();
    }
  }

  function startTimer() {
    stopTimer();
    if (!running || !state) return;
    const rate = Number(rateField.input.value) || 1;
    timer = setInterval(tick, 1000 / rate);
  }

  function setGenerator(stepOrNull) {
    stopTimer();
    if (!stepOrNull) {
      state = null;
      pointsGroup.replaceChildren();
      nStat.textContent = "";
      meanStat.textContent = "";
      chiStat.textContent = "";
      statusEl.textContent = "";
      return;
    }
    state = { step: stepOrNull, tracker: createChiSquaredTracker(BIN_COUNT), sum: 0, points: [] };
    running = true;
    pauseButton.disabled = false;
    pauseButton.textContent = "Pause";
    statusEl.textContent = "Running…";
    render();
    startTimer();
  }

  function restart() {
    setGenerator(computeGenerator());
  }

  restartButton.addEventListener("click", restart);
  pauseButton.addEventListener("click", () => {
    if (!state) return;
    running = !running;
    pauseButton.textContent = running ? "Pause" : "Resume";
    statusEl.textContent = running ? "Running…" : "Paused";
    if (running) startTimer();
    else stopTimer();
  });
  rateField.input.addEventListener("input", () => {
    if (running) startTimer();
  });

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          if (running) startTimer();
        } else {
          stopTimer();
        }
      }
    },
    { threshold: 0.01 },
  );
  observer.observe(container);

  restart();

  return { restart };
}
