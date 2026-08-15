// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mountGeneratorWidget } from "../js/widget.js";

// The published spec for assignment-1 (see spec/README.md for how checks
// relate to it). Most lines are already covered elsewhere:
// - "static and client-side throughout" is structural — GitHub Pages only
//   serves static files, and spec/invariants.test.ts checks the built site.
// - "evidence of process is in the repo" is what `pnpm check:evidence` checks.
// - "it works at both marking viewports" is judged by a person at the crit —
//   no unit test replaces opening it in a browser at 390×844 and 1920×1080.
//
// One line is ours to assert: the visitor does something that changes what
// they see. The MRG widget's carousel is this page's core interaction —
// clicking "Next" is the single most robust event to dispatch here (no
// string-parsing/validation edge cases the way editing a number field has),
// and it's the interaction unique to this page's design.

const MRG_CONFIG = {
  id: "mrg-spec-test",
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
    coefficientLabel: (i: number) => `a${i + 1}`,
    seedLabel: (i: number) => `X${i}`,
  },
};

describe("assignment 1 spec", () => {
  it("clicking the MRG carousel's Next button changes what the visitor sees", () => {
    const container = document.createElement("div");
    document.body.append(container);

    mountGeneratorWidget(container, MRG_CONFIG);

    const label = container.querySelector("[data-step-label]");
    const windowStrip = container.querySelector(".carousel-window");
    const stepBefore = label?.textContent;
    const windowBefore = windowStrip?.textContent;

    container
      .querySelector("[data-carousel-next]")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(label?.textContent).toBe("Step 2 of 8");
    expect(label?.textContent).not.toBe(stepBefore);
    expect(windowStrip?.textContent).not.toBe(windowBefore);
  });
});
