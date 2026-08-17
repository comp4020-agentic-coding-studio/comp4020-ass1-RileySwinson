import { mountLcgWidget, mountModulusDetails } from "./js/lcg-widget.js";
import { mountLcgStreamWidget } from "./js/lcg-stream-widget.js";
import { mountMrgWidget } from "./js/mrg-widget.js";
import { mountMrgStreamWidget } from "./js/mrg-stream-widget.js";
import { mountLcgVerifyWidget } from "./js/lcg-verify-widget.js";
import { mountLcgVerifyStage2Widget } from "./js/lcg-verify-stage2-widget.js";
import { mountMrgVerifyWidget } from "./js/mrg-verify-widget.js";
import { mountMrgVerifyStage2Widget } from "./js/mrg-verify-stage2-widget.js";

// Minimal Standard LCG (Lewis, Goodman & Miller): a = 16807, c = 0,
// m = 2^31 - 1 — the "textbook" example named in the page's own prose.
const LCG_DEFAULTS = { a: "16807", c: "0", m: "2147483647", seed: "1" };

// Deliberately a bad choice — a = 3, c = 0, m = 10, seed 1 cycles
// 3, 9, 7, 1 and repeats after just 4 steps, matching the worked example
// named in the page's own prose right above this widget.
const STREAM_DEFAULTS = { a: "3", c: "0", m: "10", seed: "1", rate: 3 };

// A small order-3 MRG chosen for clarity, not for statistical quality —
// finding multipliers with genuinely good properties is what the
// "how do we verify randomness" section further down this page is for.
const MRG_DEFAULTS = {
  m: "1000",
  terms: [
    { a: "7", seed: "3" },
    { a: "5", seed: "1" },
    { a: "3", seed: "4" },
  ],
};

const LCG_VERIFY_1_DEFAULTS = { a: "16807", c: "0", m: "2147483647", seed: "1" };
const LCG_VERIFY_2_DEFAULTS = {
  a: "16807",
  c: "0",
  m: "2147483647",
  seeds: "1, 2, 3, 4, 5, 6, 7, 8",
  sampleSize: "500",
};

const MRG_VERIFY_1_DEFAULTS = {
  m: "1000",
  terms: [
    { a: "7", seed: "3" },
    { a: "5", seed: "1" },
    { a: "3", seed: "4" },
  ],
};
const MRG_VERIFY_2_DEFAULTS = {
  m: "1000",
  coefficients: ["7", "5", "3"],
  seeds: "1, 10, 20, 30, 40, 50, 60, 70",
  sampleSize: "500",
};

const lcgRoot = document.getElementById("lcg-widget");
if (lcgRoot) mountLcgWidget(lcgRoot, LCG_DEFAULTS);

const modulusDetailsRoot = document.getElementById("lcg-modulus-details");
if (modulusDetailsRoot) mountModulusDetails(modulusDetailsRoot);

const streamRoot = document.getElementById("lcg-stream-widget");
if (streamRoot) mountLcgStreamWidget(streamRoot, STREAM_DEFAULTS);

const mrgRoot = document.getElementById("mrg-widget");
if (mrgRoot) mountMrgWidget(mrgRoot, MRG_DEFAULTS);

const mrgStreamRoot = document.getElementById("mrg-stream-widget");
if (mrgStreamRoot) mountMrgStreamWidget(mrgStreamRoot, MRG_DEFAULTS);

const verifyLcg1Root = document.getElementById("verify-lcg-1");
if (verifyLcg1Root) mountLcgVerifyWidget(verifyLcg1Root, LCG_VERIFY_1_DEFAULTS);

const verifyLcg2Root = document.getElementById("verify-lcg-2");
if (verifyLcg2Root) mountLcgVerifyStage2Widget(verifyLcg2Root, LCG_VERIFY_2_DEFAULTS);

const verifyMrg1Root = document.getElementById("verify-mrg-1");
if (verifyMrg1Root) mountMrgVerifyWidget(verifyMrg1Root, MRG_VERIFY_1_DEFAULTS);

const verifyMrg2Root = document.getElementById("verify-mrg-2");
if (verifyMrg2Root) mountMrgVerifyStage2Widget(verifyMrg2Root, MRG_VERIFY_2_DEFAULTS);
