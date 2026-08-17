import { el, svgEl, axisPlot } from "./dom.js";
import { createChiSquaredTracker } from "./chi-squared.js";
import { typesetMath } from "./mathjax.js";

const BIN_COUNT = 10;
const DEGREES_OF_FREEDOM = BIN_COUNT - 1;
const MAX_SEEDS = 50;
const PLOT_W = 300;
const PLOT_H = 150;
const PADDING = 10;
const MAX_X_LABELS = 8; // thin seed labels past this many points, or they'd overlap

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

/** "Nice" round tick values from 0 to max — the χ² axis range depends on the data, unlike stage-1's fixed [0,1). */
function niceTicks(max, targetCount) {
  if (max <= 0) return [0];
  const rawStep = max / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  const ticks = [];
  for (let v = 0; v <= max; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
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
  const yTicksGroup = svgEl("g", { class: "verify-axis-ticks" });
  const xTicksGroup = svgEl("g", { class: "verify-axis-ticks" });
  svg.append(
    yTicksGroup,
    svgEl("rect", { class: "verify-svg-border", x: 0.5, y: 0.5, width: PLOT_W - 1, height: PLOT_H - 1 }),
    referenceLine,
    pointsGroup,
    xTicksGroup,
  );
  const plotEl = axisPlot(svg, {
    xLabel: "seeds, left to right, in order entered",
    yLabel: "\\(\\chi^2\\) statistic",
  });

  const legendEl = el("p", { className: "verify-legend" }, [
    el("span", { className: "verify-legend-swatch" }),
    ` expected mean if uniform: \\(\\chi^2 = ${DEGREES_OF_FREEDOM}\\)`,
  ]);

  container.replaceChildren(
    paramsEl,
    el("div", { className: "verify-run" }, [runButton, summaryEl]),
    plotEl,
    legendEl,
  );
  typesetMath([plotEl, legendEl]);

  function clearErrors() {
    seedListError.textContent = "";
    seedListInput.removeAttribute("aria-invalid");
    sampleSizeError.textContent = "";
    sampleSizeInput.removeAttribute("aria-invalid");
  }

  function xFor(i, count) {
    return count === 1 ? PLOT_W / 2 : PADDING + (i / (count - 1)) * (PLOT_W - 2 * PADDING);
  }

  function renderResults(statistics, seeds) {
    const yMax = Math.max(DEGREES_OF_FREEDOM * 2, ...statistics) * 1.15;
    const yFor = (value) => PLOT_H - (value / yMax) * PLOT_H;

    yTicksGroup.replaceChildren(
      ...niceTicks(yMax, 4).flatMap((v) => {
        const y = yFor(v);
        return [
          svgEl("line", { class: "verify-gridline", x1: 0, y1: y.toFixed(2), x2: PLOT_W, y2: y.toFixed(2) }),
          svgEl("text", { class: "verify-tick-label", x: 3, y: Math.max(7, y - 2).toFixed(2) }, [String(v)]),
        ];
      }),
    );

    referenceLine.setAttribute("x1", "0");
    referenceLine.setAttribute("x2", String(PLOT_W));
    referenceLine.setAttribute("y1", yFor(DEGREES_OF_FREEDOM).toFixed(2));
    referenceLine.setAttribute("y2", yFor(DEGREES_OF_FREEDOM).toFixed(2));

    pointsGroup.replaceChildren(
      ...statistics.map((value, i) => svgEl("circle", { cx: xFor(i, statistics.length).toFixed(2), cy: yFor(value).toFixed(2), r: 3 })),
    );

    // Real seed values on the x-axis, not just position — thinned to at
    // most MAX_X_LABELS so a long seed list doesn't overlap into mush.
    const stride = Math.max(1, Math.ceil(seeds.length / MAX_X_LABELS));
    xTicksGroup.replaceChildren(
      ...seeds
        .map((seedToken, i) => (i % stride === 0 || i === seeds.length - 1 ? { seedToken, i } : null))
        .filter(Boolean)
        .map(({ seedToken, i }) =>
          svgEl(
            "text",
            { class: "verify-tick-label", x: xFor(i, seeds.length).toFixed(2), y: PLOT_H - 3, "text-anchor": "middle" },
            [seedToken],
          ),
        ),
    );

    const mean = statistics.reduce((a, b) => a + b, 0) / statistics.length;
    summaryEl.textContent = `mean χ² ≈ ${mean.toFixed(2)} (expect ≈ ${DEGREES_OF_FREEDOM} if uniform)`;
  }

  function run() {
    clearErrors();
    pointsGroup.replaceChildren();
    xTicksGroup.replaceChildren();
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

    renderResults(statistics, seeds);
  }

  runButton.addEventListener("click", run);

  return { run };
}
