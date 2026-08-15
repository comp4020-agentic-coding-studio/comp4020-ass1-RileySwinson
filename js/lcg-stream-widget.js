import { el } from "./dom.js";
import { buildField, buildRateField } from "./field.js";
import { parseBigIntField, validateParams, mod } from "./recurrence.js";

const MAX_CONSOLE_LINES = 200;
const TARGET_REPETITIONS = 6;
const MAX_SEARCH_TICKS = 1000;

function fmt(value) {
  return value.toLocaleString("en-AU");
}

/**
 * Mounts a live, continuously-running generator: the same a/c/m/seed
 * inputs as the other widgets, a rate slider, and a console-style log
 * that prints each new value as it's produced. Stops itself the moment a
 * state repeats — the whole point is watching the sequence visibly run
 * out of new numbers — and reports how many steps that took.
 *
 * Console lines are plain text, not MathJax — this can tick many times a
 * second, and re-typesetting on every tick would be both slow and janky
 * for something that's meant to read like a terminal anyway.
 */
export function mountLcgStreamWidget(container, defaults) {
  const fields = {
    a: buildField("stream-a", "\\(a\\)", defaults.a),
    c: buildField("stream-c", "\\(c\\)", defaults.c),
    m: buildField("stream-m", "\\(m\\)", defaults.m),
    seed: buildField("stream-seed", "\\(X\\)", defaults.seed),
  };
  const fieldList = Object.values(fields);
  const rateField = buildRateField("stream-rate", defaults.rate ?? 3);

  const paramsEl = el("div", { className: "params" }, [...fieldList.map((f) => f.wrapper), rateField.wrapper]);
  const consoleEl = el("div", {
    className: "console",
    attrs: { role: "log", "aria-label": "Generated number stream" },
  });
  const statusEl = el("p", { className: "console-status", attrs: { "aria-live": "polite" } });
  const restartButton = el("button", {
    className: "carousel-prev",
    attrs: { type: "button" },
    text: "Restart",
  });
  const pauseButton = el("button", {
    className: "carousel-next",
    attrs: { type: "button" },
    text: "Pause",
  });
  const controls = el("div", { className: "carousel-controls" }, [restartButton, statusEl, pauseButton]);

  container.replaceChildren();
  container.append(paramsEl, consoleEl, controls);

  let timer = null;
  let running = true;
  let state = null; // { a, c, m, current, seen: Set<string>, count, stopped }

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

  function tick() {
    if (!state || state.stopped) return;
    const next = mod(state.a * state.current + state.c, state.m);
    state.count += 1;
    const key = next.toString();

    // The recursion is a fixed, deterministic function of the current
    // state: if this value exactly matches one already seen, every value
    // after it is mathematically guaranteed to repeat the values after
    // that earlier match too (same input, same output, forever) — so one
    // matched state is enough to know the period exactly. But "provably
    // true" isn't the same as "visibly true": keep running for several
    // more full cycles so the repetition is something you actually watch
    // happen, not just a claim on the screen.
    if (state.period === null && state.seen.has(key)) {
      state.period = state.count;
      state.targetCount = state.period * TARGET_REPETITIONS;
      appendLine(
        `↺ repeated — the period is ${state.period}. Watching ${TARGET_REPETITIONS} full cycles before stopping…`,
        "console-line-repeat",
      );
    } else if (state.period === null) {
      state.seen.add(key);
    }

    state.current = next;
    const output = Number(next) / Number(state.m);
    appendLine(`X_${state.count} = ${fmt(next)}   →   U_${state.count} ≈ ${output.toFixed(5)}`);

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

  function restart() {
    const raw = readParams();
    clearErrors();
    stopTimer();

    const stillBeingEdited = Object.values(raw).some((value) => value === null);
    if (stillBeingEdited) {
      state = null;
      return;
    }

    const { valid, errors } = validateParams({
      modulus: raw.m,
      coefficients: [raw.a],
      constant: raw.c,
      seedWindow: [raw.seed],
    });
    if (!valid) {
      showErrors(errors);
      state = null;
      return;
    }

    consoleEl.replaceChildren();
    appendLine(`X_0 = ${fmt(raw.seed)}   (seed)`);
    state = {
      a: raw.a,
      c: raw.c,
      m: raw.m,
      current: raw.seed,
      seen: new Set([raw.seed.toString()]),
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

  restartButton.addEventListener("click", restart);
  pauseButton.addEventListener("click", () => {
    if (!state || state.stopped) return;
    running = !running;
    pauseButton.textContent = running ? "Pause" : "Resume";
    statusEl.textContent = running ? "Running…" : "Paused";
    if (running) startTimer();
    else stopTimer();
  });

  for (const field of fieldList) {
    field.input.addEventListener("input", restart);
  }
  rateField.input.addEventListener("input", () => {
    if (running) startTimer();
  });

  // A phone-sized fleet of these ticking away offscreen is wasted work —
  // pause whenever the widget scrolls out of view, resume when it's back.
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
