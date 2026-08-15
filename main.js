import { mountGeneratorWidget } from "./js/widget.js";
import { mountLcgWidget } from "./js/lcg-widget.js";

// Minimal Standard LCG (Lewis, Goodman & Miller): a = 16807, c = 0,
// m = 2^31 - 1 — the "textbook" example named in the page's own prose.
const LCG_DEFAULTS = { a: "16807", c: "0", m: "2147483647", seed: "1" };

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

const mrgRoot = document.getElementById("mrg-widget");
if (mrgRoot) mountGeneratorWidget(mrgRoot, MRG_CONFIG);
