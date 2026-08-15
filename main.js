import { mountLcgWidget } from "./js/lcg-widget.js";
import { mountLcgStreamWidget } from "./js/lcg-stream-widget.js";
import { mountMrgWidget } from "./js/mrg-widget.js";
import { mountMrgStreamWidget } from "./js/mrg-stream-widget.js";

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
const MRG_DEFAULTS = {
  m: "1000",
  terms: [
    { a: "7", seed: "3" },
    { a: "5", seed: "1" },
    { a: "3", seed: "4" },
  ],
};

const lcgRoot = document.getElementById("lcg-widget");
if (lcgRoot) mountLcgWidget(lcgRoot, LCG_DEFAULTS);

const streamRoot = document.getElementById("lcg-stream-widget");
if (streamRoot) mountLcgStreamWidget(streamRoot, STREAM_DEFAULTS);

const mrgRoot = document.getElementById("mrg-widget");
if (mrgRoot) mountMrgWidget(mrgRoot, MRG_DEFAULTS);

const mrgStreamRoot = document.getElementById("mrg-stream-widget");
if (mrgStreamRoot) mountMrgStreamWidget(mrgStreamRoot, MRG_DEFAULTS);
