import { el } from "./dom.js";
import { buildField, buildRateField } from "./field.js";
import { mountTermList } from "./term-list.js";
import { parseBigIntField, validateParams, stepGenerator } from "./recurrence.js";

const MAX_CONSOLE_LINES = 200;
const TARGET_REPETITIONS = 6;
const MAX_SEARCH_TICKS = 1000;

function fmt(value) {
  return value.toLocaleString("en-AU");
}

/**
 * Same idea as js/lcg-stream-widget.js, generalised to order k via
 * js/term-list.js. The one real difference: an MRG's "state" is the whole
 * k-length window, not a single value, so a repeat has to be detected on
 * the *whole window* matching an earlier one, not just the latest output —
 * two different windows can share a single output value without the
 * future actually being forced to repeat.
 */
export function mountMrgStreamWidget(container, defaults) {
  const mField = buildField("mrg-stream-m", "\\(m\\)", defaults.m);
  const rateField = buildRateField("mrg-stream-rate", defaults.rate ?? 3);

  const paramsEl = el("div", { className: "params" }, [mField.wrapper, rateField.wrapper]);
  const termListEl = el("div", { className: "mrg-terms" });
  const consoleEl = el("div", {
    className: "console",
    attrs: { role: "log", "aria-label": "Generated number stream" },
  });
  const statusEl = el("p", { className: "console-status", attrs: { "aria-live": "polite" } });
  const restartButton = el("button", { className: "carousel-prev", attrs: { type: "button" }, text: "Restart" });
  const pauseButton = el("button", { className: "carousel-next", attrs: { type: "button" }, text: "Pause" });
  const controls = el("div", { className: "carousel-controls" }, [restartButton, statusEl, pauseButton]);

  container.replaceChildren();
  container.append(paramsEl, termListEl, consoleEl, controls);

  let timer = null;
  let running = true;
  let state = null; // { coefficients, m, window, t, seen: Set<string>, count, period, targetCount, stopped }

  function appendLine(text, className) {
    consoleEl.append(el("p", { className: className ? `console-line ${className}` : "console-line", text }));
    while (consoleEl.childElementCount > MAX_CONSOLE_LINES) {
      consoleEl.firstElementChild?.remove();
    }
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  function stopTimer() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function windowKey(window) {
    return window.map((v) => v.toString()).join(",");
  }

  function tick() {
    if (!state || state.stopped) return;

    const result = stepGenerator({
      t: state.t,
      priorWindow: state.window,
      coefficients: state.coefficients,
      constant: null,
      modulus: state.m,
    });
    state.t += 1;
    state.count += 1;
    state.window = result.newWindow;
    const key = windowKey(state.window);

    if (state.period === null) {
      if (state.seen.has(key)) {
        state.period = state.count;
        state.targetCount = state.period * TARGET_REPETITIONS;
        appendLine(
          `↺ repeated — the period is ${state.period}. Watching ${TARGET_REPETITIONS} full cycles before stopping…`,
          "console-line-repeat",
        );
      } else {
        state.seen.add(key);
      }
    }

    appendLine(`X_${result.t} = ${fmt(result.result)}   →   U_${result.t} ≈ ${result.output.toFixed(5)}`);

    if (state.period === null && state.count >= MAX_SEARCH_TICKS) {
      appendLine(
        `No repeat within the first ${MAX_SEARCH_TICKS.toLocaleString("en-AU")} numbers — this generator's period is at least that long.`,
        "console-line-repeat",
      );
      statusEl.textContent = `Stopped: no repeat within ${MAX_SEARCH_TICKS}`;
      state.stopped = true;
      stopTimer();
    } else if (state.period !== null && state.count >= state.targetCount) {
      statusEl.textContent = `Stopped after ${TARGET_REPETITIONS} cycles — period ${state.period}`;
      state.stopped = true;
      stopTimer();
    }
  }

  function startTimer() {
    stopTimer();
    if (!running || !state || state.stopped) return;
    const rate = Number(rateField.input.value) || 1;
    timer = setInterval(tick, 1000 / rate);
  }

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

  function restart() {
    const modulus = parseBigIntField(mField.input.value);
    const rawTerms = termList.readRaw().map((t) => ({
      a: parseBigIntField(t.a),
      seed: parseBigIntField(t.seed),
    }));
    clearErrors();
    stopTimer();

    const stillBeingEdited = modulus === null || rawTerms.some((t) => t.a === null || t.seed === null);
    if (stillBeingEdited) {
      state = null;
      return;
    }

    const coefficients = rawTerms.map((t) => t.a);
    const seedWindow = rawTerms.map((t) => t.seed);

    const { valid, errors } = validateParams({ modulus, coefficients, constant: null, seedWindow });
    if (!valid) {
      showErrors(errors);
      state = null;
      return;
    }

    consoleEl.replaceChildren();
    appendLine(`(X_1, …, X_${coefficients.length}) = (${seedWindow.map(fmt).join(", ")})   (seed)`);
    state = {
      coefficients,
      m: modulus,
      window: seedWindow,
      // recurrence.js's t is 0-indexed from the seed count (first output
      // X_k); this widget labels seeds 1-indexed (X_1..X_k, first output
      // X_{k+1}) to match the page's MRG prose — +1 corrects the label
      // only, t is never used in the arithmetic itself.
      t: coefficients.length + 1,
      seen: new Set([windowKey(seedWindow)]),
      count: 0,
      period: null,
      targetCount: null,
      stopped: false,
    };
    running = true;
    pauseButton.textContent = "Pause";
    pauseButton.disabled = false;
    statusEl.textContent = "Running…";
    startTimer();
  }

  const termList = mountTermList(termListEl, {
    idPrefix: "mrg-stream",
    initialTerms: defaults.terms,
    onChange: restart,
  });

  restartButton.addEventListener("click", restart);
  pauseButton.addEventListener("click", () => {
    if (!state || state.stopped) return;
    running = !running;
    pauseButton.textContent = running ? "Pause" : "Resume";
    statusEl.textContent = running ? "Running…" : "Paused";
    if (running) startTimer();
    else stopTimer();
  });

  mField.input.addEventListener("input", restart);
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
