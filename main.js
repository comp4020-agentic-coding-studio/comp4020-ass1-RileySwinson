import { mountGeneratorWidget } from "./js/widget.js";
import { mountLcgWidget } from "./js/lcg-widget.js";
import { mountLcgStreamWidget } from "./js/lcg-stream-widget.js";

// Minimal Standard LCG (Lewis, Goodman & Miller): a = 16807, c = 0,
// m = 2^31 - 1 — the "textbook" example named in the page's own prose.
const LCG_DEFAULTS = { a: "16807", c: "0", m: "2147483647", seed: "1" };

// Deliberately a bad choice — a = 3, c = 0, m = 10, seed 1 cycles
// 3, 9, 7, 1 and repeats after just 4 steps, matching the worked example
// named in the page's own prose right above this widget.
const STREAM_DEFAULTS = { a: "3", c: "0", m: "10", seed: "1", rate: 3 };

// A small order-3 MRG chosen for clarity, not for statistical quality —
// finding multipliers with good properties is what the simulations page
// (linked at the bottom of this one) is for.
const MRG_CONFIG = {
  id: "mrg",
  order: 3,
  hasConstant: false,
  layout: "carousel",
  steps: 8,
  defaults: {
    modulus: "1000",
    coefficients: ["7", "5", "3"],
    seedWindow: ["3", "1", "4"],
  },
  labels: {
    coefficientLabel: (i) => `\\(a_${i + 1}\\)`,
    seedLabel: (i) => `\\(X_${i}\\)`,
  },
};

const lcgRoot = document.getElementById("lcg-widget");
if (lcgRoot) mountLcgWidget(lcgRoot, LCG_DEFAULTS);

const streamRoot = document.getElementById("lcg-stream-widget");
if (streamRoot) mountLcgStreamWidget(streamRoot, STREAM_DEFAULTS);

const mrgRoot = document.getElementById("mrg-widget");
if (mrgRoot) mountGeneratorWidget(mrgRoot, MRG_CONFIG);
