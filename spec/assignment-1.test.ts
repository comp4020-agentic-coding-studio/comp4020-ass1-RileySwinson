// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mountLcgWidget } from "../js/lcg-widget.js";

// The published spec for assignment-1 (see spec/README.md for how checks
// relate to it). Most lines are already covered elsewhere:
// - "static and client-side throughout" is structural — GitHub Pages only
//   serves static files, and spec/invariants.test.ts checks the built site.
// - "evidence of process is in the repo" is what `pnpm check:evidence` checks.
// - "it works at both marking viewports" is judged by a person at the crit —
//   no unit test replaces opening it in a browser at 390×844 and 1920×1080.
//
// One line is ours to assert: the visitor does something that changes what
// they see. The LCG walkthrough's dot-carousel is this page's core
// interaction — clicking "Next" is the single most robust event to dispatch
// here (no string-parsing/validation edge cases the way editing a number
// field has).

const LCG_DEFAULTS = { a: "16807", c: "0", m: "2147483647", seed: "1" };

describe("assignment 1 spec", () => {
  it("clicking the LCG carousel's Next button changes what the visitor sees", () => {
    const container = document.createElement("div");
    document.body.append(container);

    mountLcgWidget(container, LCG_DEFAULTS);

    const label = container.querySelector(".carousel-label");
    const viewport = container.querySelector(".dot-carousel-viewport");
    const labelBefore = label?.textContent;
    const viewportBefore = viewport?.textContent;

    container.querySelector(".carousel-next")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(label?.textContent).toBe("Step 2 of 9");
    expect(label?.textContent).not.toBe(labelBefore);
    expect(viewport?.textContent).not.toBe(viewportBefore);
  });
});
