import { describe, it } from "vitest";

// The published spec for assignment-1 (see spec/README.md for how checks
// relate to it). Most lines are already covered elsewhere:
// - "static and client-side throughout" is structural — GitHub Pages only
//   serves static files, and spec/invariants.test.ts checks the built site.
// - "evidence of process is in the repo" is what `pnpm check:evidence` checks.
// - "it works at both marking viewports" is judged by a person at the crit —
//   no unit test replaces opening it in a browser at 390×844 and 1920×1080.
//
// One line is ours to assert, and can't be written honestly before the
// prototype's core interaction exists to describe:

describe("assignment 1 spec", () => {
  it.todo(
    "the visitor does something that changes what they see — once the core " +
      "interaction is chosen, dispatch the real user event and assert the DOM changed",
  );
});
