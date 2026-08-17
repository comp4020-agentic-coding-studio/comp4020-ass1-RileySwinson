import { el, svgEl, axisPlot } from "./dom.js";
import { createChiSquaredTracker } from "./chi-squared.js";

const BIN_COUNT = 10;
const DEGREES_OF_FREEDOM = BIN_COUNT - 1;
const MAX_SEEDS = 50;
const PLOT_W = 300;
const PLOT_H = 150;
const PADDING = 10;

function parseSeedList(raw) {
  return raw
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function parseSampleSize(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Shared stage-2 verify UI: a seed-list field, a samples-per-seed field, a
 * Run button, and a results plot — one dot per seed's stage-1 chi-squared
 * statistic, against a reference line at the degrees of freedom (BIN_COUNT
 * - 1), which is what that statistic's *mean* should be if the generator
 * really does behave like a uniform source across every one of these
 * independent runs, not just the one this page might have gotten lucky
 * (or unlucky) with.
 *
 * Used by both js/lcg-verify-stage2-widget.js and
 * js/mrg-verify-stage2-widget.js — neither generator's shape matters here,
 * only that the caller can turn one seed-list token into a fresh
 * `sampleSize`-length run's chi-squared statistic.
 */
export function mountVerifyStage2Engine(
  container,
  { idPrefix, defaults, generateSample, seedLabel = "Seeds (one per repetition)" },
) {
  const seedListInput = el("textarea", {
    className: "field-input seed-list-input",
    attrs: {
      id: `${idPrefix}-seeds`,
      rows: "2",
      "aria-describedby": `${idPrefix}-seeds-error`,
    },
    text: defaults.seeds,
  });
  const seedListError = el("p", {
    className: "field-error",
    attrs: { id: `${idPrefix}-seeds-error`, "aria-live": "polite" },
  });
  const seedListField = el("div", { className: "field" }, [
    el("label", { className: "field-label", attrs: { for: `${idPrefix}-seeds` }, text: seedLabel }),
    seedListInput,
    seedListError,
  ]);

  const sampleSizeInput = el("input", {
    className: "field-input",
    attrs: {
      type: "text",
      inputmode: "numeric",
      id: `${idPrefix}-n`,
      value: defaults.sampleSize,
      "aria-describedby": `${idPrefix}-n-error`,
    },
  });
  const sampleSizeError = el("p", {
    className: "field-error",
    attrs: { id: `${idPrefix}-n-error`, "aria-live": "polite" },
  });
  const sampleSizeField = el("div", { className: "field" }, [
    el("label", { className: "field-label", attrs: { for: `${idPrefix}-n` }, text: "Samples per seed" }),
    sampleSizeInput,
    sampleSizeError,
  ]);

  const paramsEl = el("div", { className: "params" }, [seedListField, sampleSizeField]);

  const runButton = el("button", { className: "run-button", attrs: { type: "button" }, text: "Run" });
  const summaryEl = el("p", { className: "console-status", attrs: { "aria-live": "polite" } });

  const svg = svgEl("svg", { viewBox: `0 0 ${PLOT_W} ${PLOT_H}`, preserveAspectRatio: "none", class: "verify-svg" });
  const referenceLine = svgEl("line", { class: "verify-reference" });
  const pointsGroup = svgEl("g", { class: "verify-points" });
  svg.append(
    svgEl("rect", { class: "verify-svg-border", x: 0.5, y: 0.5, width: PLOT_W - 1, height: PLOT_H - 1 }),
    referenceLine,
    pointsGroup,
  );
  const plotEl = axisPlot(svg, { xLabel: "seed (in the order entered) →", yLabel: "χ² statistic" });

  container.replaceChildren(paramsEl, el("div", { className: "verify-run" }, [runButton, summaryEl]), plotEl);

  function clearErrors() {
    seedListError.textContent = "";
    seedListInput.removeAttribute("aria-invalid");
    sampleSizeError.textContent = "";
    sampleSizeInput.removeAttribute("aria-invalid");
  }

  function renderResults(statistics) {
    const yMax = Math.max(DEGREES_OF_FREEDOM * 2, ...statistics) * 1.15;
    const yFor = (value) => PLOT_H - (value / yMax) * PLOT_H;

    referenceLine.setAttribute("x1", "0");
    referenceLine.setAttribute("x2", String(PLOT_W));
    referenceLine.setAttribute("y1", yFor(DEGREES_OF_FREEDOM).toFixed(2));
    referenceLine.setAttribute("y2", yFor(DEGREES_OF_FREEDOM).toFixed(2));

    pointsGroup.replaceChildren(
      ...statistics.map((value, i) => {
        const x = statistics.length === 1 ? PLOT_W / 2 : PADDING + (i / (statistics.length - 1)) * (PLOT_W - 2 * PADDING);
        return svgEl("circle", { cx: x.toFixed(2), cy: yFor(value).toFixed(2), r: 3 });
      }),
    );

    const mean = statistics.reduce((a, b) => a + b, 0) / statistics.length;
    summaryEl.textContent = `${statistics.length} repetitions — mean χ² ≈ ${mean.toFixed(2)} (expect ≈ ${DEGREES_OF_FREEDOM} if uniform)`;
  }

  function run() {
    clearErrors();
    pointsGroup.replaceChildren();
    referenceLine.removeAttribute("x1");

    const seeds = parseSeedList(seedListInput.value).slice(0, MAX_SEEDS);
    const sampleSize = parseSampleSize(sampleSizeInput.value);

    if (seeds.length < 2) {
      seedListError.textContent = "enter at least 2 seeds, separated by commas or spaces";
      seedListInput.setAttribute("aria-invalid", "true");
      summaryEl.textContent = "";
      return;
    }
    if (!sampleSize) {
      sampleSizeError.textContent = "must be a positive integer";
      sampleSizeInput.setAttribute("aria-invalid", "true");
      summaryEl.textContent = "";
      return;
    }

    const statistics = [];
    for (const seedToken of seeds) {
      const values = generateSample(seedToken, sampleSize);
      if (values === null) {
        seedListError.textContent = `"${seedToken}" isn't a usable seed for this generator`;
        seedListInput.setAttribute("aria-invalid", "true");
        summaryEl.textContent = "";
        return;
      }
      const tracker = createChiSquaredTracker(BIN_COUNT);
      for (const value of values) tracker.add(value);
      statistics.push(tracker.statistic());
    }

    renderResults(statistics);
  }

  runButton.addEventListener("click", run);

  return { run };
}
