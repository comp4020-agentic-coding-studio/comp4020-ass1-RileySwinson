# COMP4020 prototype

This is your starter repo for a COMP4020 prototype: a static site written in
HTML/CSS/TypeScript that builds to plain HTML/CSS/JS and deploys to GitHub
Pages. The **deployed site is what gets marked** --- not this repo, and not "it
works on my machine". It's marked live in Chrome against the deployed URL at two
viewports --- 1920×1080 (desktop) and 390×844 (phone) --- and both count in
full, so make that artefact good at both and use the checks below to know
whether it is.

The course website publishes this deliverable's brief and spec. The brief poses
the problem; the spec is the fixed contract every response must satisfy. This
repo's name tells you which deliverable applies. Run the course plugin's
**start** skill at the start of each week: it pulls the right spec from the
course API, carries your harness forward from last week, and helps you turn the
spec's checkable lines into tests of your own. Read the brief and spec before
you plan or build, and see `spec/README.md` for how the checks relate to them.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Before you push, run `pnpm check`. It runs most of what CI runs --- build,
  lint, and the spec --- so you catch those in seconds instead of waiting for
  the pipeline. The links check, the evidence check, the secrets scan, and the
  deploy itself only run in CI; run `pnpm dlx linkinator ./dist --silent`
  locally against a fresh `pnpm build` for the links check without waiting for
  CI.
- To see what the page actually looks like rather than what you assume it looks
  like, open it in a browser (the `agent-browser` CLI, documented on
  [the course site](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/backpressure/#agent-browser-the-rendered-page-as-ground-truth),
  works well for this). The rendered page is the truth; your mental model of it
  isn't.
- When a check fails, read its output before changing anything. Each check below
  names what it measures, and the failure message is the instruction: it tells
  you the file, the line, or the contract. Treat a red check as authoritative
  --- the page is wrong until the check is green, not until you decide it should
  be.
- Commit when the checks pass. Never commit a red state.

## The checks (your sensors)

CI runs these on every push once your repo is public. GitHub's checks UI shows
two jobs, `check` and `deploy` --- not one status per sensor below --- and
within `check` the steps run in sequence (`pnpm check` chains typecheck, build,
lint, and the spec with `&&`), so an early failure like a broken build stops the
later sensors from running for that push; fix it and push again to see the rest.
While the repo is private (all week, until you ship) the CI jobs stay skipped
--- `pnpm check` is the same roster on your machine, and it's the faster loop
anyway. They aren't hoops. Each is a different way of finding out something true
about the site that you can't reliably see by looking at it.

They also carry a mark at a crit: the sweep runs fifteen minutes after your
cutoff, and green checks there are worth half that week's shipped mark. Still
running counts as not green, so ship with time for CI to finish.

- **typecheck** --- `tsc --noEmit` runs first in `pnpm check`, so a type error
  stops the roster before the build even starts. The types are extra
  backpressure: a red here is the compiler telling you a claim in the code is
  false.
- **build** --- the site must build (`pnpm build`). A build failure means the
  deployed site is broken or stale, so nothing else matters until this is green.
- **deploy / online** --- the live GitHub Pages URL must load and return the
  page you expect. An asset that 404s on the deployed URL counts as broken even
  if it loads locally.
- **spec** --- `spec/invariants.test.ts` asserts what's true of any good
  website, whatever the week's brief asks; the tests you write for the week's
  spec run alongside it (any `spec/*.test.ts`). A failure names the contract
  you haven't met yet.
- **lint** --- `stylelint` for CSS, `oxlint` for TypeScript. Flags code that's
  wrong, fragile, or non-idiomatic. Read the rule it names.
- **tests** --- any other tests you write, wherever you put them (co-located
  with your source is fine, not just `spec/`), must pass. Vitest picks up both
  this and the spec suite in one `vitest run`, the last step of `pnpm check`. A
  failing test is a claim about the site that's no longer true.
- **evidence** (`pnpm check:evidence`) --- checks your process evidence:
  `PROCESS.md`'s citations resolve to real commits, the current deliverable's
  exact reflection is in `reflections/` (worked out from this repo's name
  against the public course API), and your `CLAUDE.md` is present. Evidence
  gates the deploy --- `deploy` needs `check` to pass, so failing evidence
  blocks the deploy alongside everything else. See
  [Your process is part of the mark](#your-process-is-part-of-the-mark) below,
  and the course website's
  [assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
  for what counts as evidence.
- **links** --- internal links must resolve. A broken link is a dead end you
  didn't mean to ship.
- **secrets** --- the repo is scanned for committed credentials. Never put a
  key, token, or password in a tracked file. If one leaks, rotate it. A local
  pre-commit hook (`.githooks/pre-commit`, installed by `pnpm install`) also
  blocks any commit containing something shaped like an API key --- by the time
  CI sees a key it's already pushed, so the hook is the sensor that matters.

Nothing here measures **accessibility** or **performance** --- wiring those
sensors (`axe-core`, Lighthouse, or whatever you choose) is your work, and later
in the course the spec will ask you to show how you tested both. When you do,
read a green performance result honestly: it's a lab estimate from one run on a
CI machine, not proof the site is fast for real users.

## The stack is swappable

Out of the box this is plain HTML/CSS/TypeScript on Vite, and every `.html` file
in the repo is a page: add pages, link them, and the build picks them up with no
config. That's a default, not a rule (unless the week's spec says otherwise).
You can swap in Astro or any other static generator, because nothing in CI names
a tool --- the whole contract is:

- `pnpm build` emits the complete site into `dist/`
- the `package.json` scripts (`check`, `check:evidence`, `build`) keep working
- whatever lands in `dist/` still passes the invariants in `spec/`

Two things bite in a swap. The deployed site lives under a path
(`…github.io/<repo>/`), so configure your generator's base path --- this
template's Vite config uses relative asset URLs to sidestep that, but most
generators (Astro included) need `base` set explicitly, and getting it wrong
looks fine locally while every asset 404s on the live URL. And commit the
updated `pnpm-lock.yaml`: CI installs with `--frozen-lockfile`.

## Your process is part of the mark

The deployed page is only half of it. How you got there is marked too: your
commit history, your agent files, and the decisions visible across them. The
checks above can't see any of that, so a person reads it directly --- which
means building legibly is part of building well.

- **Commit as you go.** Small, frequent commits are the record of how the work
  came together, and that record is read, not just the final state. A trail that
  grew alongside the code is the strongest evidence of your process; a single
  dump the night before is the weakest.
- **Keep a process overview** (`PROCESS.md`). A short reading-guide, not an
  essay: what you built, the moments that mattered --- each pointing at a
  commit, a `CLAUDE.md` change, or a prompt and the commit it produced --- and
  where to look in the history. It points a marker at the evidence; it doesn't
  stand in for it, and claims the history doesn't back don't count. The
  `PROCESS.md` in this repo is a template showing the shape and the citation
  format (link text the commit hash or range, target the commit or compare URL);
  `pnpm check:evidence` verifies your citations resolve to real commits before
  you ship. Markers follow those citations and don't trawl the repo for evidence
  you didn't cite.
- **Write your reflection in `reflections/`** --- a short markdown file in this
  repo, named for the deliverable it answers, so the number in the filename is
  the number in this repo's name (`crit-1.md` in `comp4020-crit1-<you>`,
  `assignment-1.md` in `comp4020-ass1-<you>`); `reflections/README.md` has the
  full rule. `pnpm check:evidence` checks the exact current name against the
  course API, not merely the presence of any well-named file. It answers the two
  standing prompts: the breakthrough that moved the work forward, and what this
  work changed about the developer you want to be. It stays out of the deployed
  site. It's due at the cutoff, and if it isn't in the repo by then the week
  doesn't count as shipped, however good the prototype is.
- **This file is process evidence.** The harness you build to direct the agent,
  this `CLAUDE.md` and any `AGENTS.md`, is itself read as part of how you
  worked. Keep it honest and current (see below).

You don't need a name, a student number, or any identity file in the repo: we
know whose repo it is. Spend the effort on the work.

## What this repo has learned

- **Bare stack, deliberately.** No Vite, no TypeScript compiling the site
  itself --- hand-written HTML/CSS/JS. `pnpm build` is `scripts/build.ts`, a
  plain file copy: every `.html`/`.css`/`.js`/asset file outside `spec/`,
  `scripts/`, `reflections/` lands in `dist/` unchanged, no bundling. `pnpm
  dev` is `scripts/dev-server.ts`, a zero-dependency static server over the
  repo root --- there is no build step to run first, since what ships is what's
  on disk. `pnpm preview` points the same server at `dist/` instead.
- **TypeScript stays for tooling, not the site.** `spec/*.test.ts` and
  `scripts/*.ts` (the build script, the dev server, `check-evidence`) are
  still typechecked by `pnpm typecheck` --- only the deployed page's own script
  dropped types, so add a page/asset in whatever this repo's stack is, not by
  reaching for a bundler.
- This repo carried its `CLAUDE.md` forward from Crit 2, but not that repo's
  own "what this repo has learned" section --- it was all Astro base-path and
  `assetsPrefix` traps, and this repo isn't on Astro.
- **Never open `index.html` directly (`file://...`) --- always go through
  `pnpm dev` and `http://localhost`.** `main.js` is `type="module"` and
  imports `js/gl-engine.js`, which imports `js/shaders.js`; browsers block a
  module script from fetching another module over `file://`, so double-clicking
  the file gives a silent black canvas with no console error, no thrown
  exception, nothing --- it just never runs. This is a browser security
  restriction on the `file://` origin, not a bug in the code: `pnpm dev`
  (`http://`) and the deployed GitHub Pages URL (`https://`) both work fine,
  since same-origin module fetches are only blocked on `file://`.

## The path tracer (engine, built first)

`js/gl-engine.js` runs a live WebGL2 Monte Carlo path tracer: one sphere on a
plane, one rectangular area light, direct lighting only, ping-pong `RGBA32F`
(or `RGBA16F` fallback) accumulation. `js/shaders.js` holds the GLSL as
template strings; `js/sampling.js` holds the same sampling formulas in plain
JS, because a shader can't be unit-tested and the JS mirror can
(`checks/sampling.test.ts`).

- **`state * constant` overflows in JS before it does in GLSL.** The PCG hash
  multiplies a uint32 by a ~750M constant, which crosses 2^53 (JS's safe
  integer limit) well before it crosses 2^32 (GLSL's real wraparound). Plain
  `*` silently lost precision and measurably biased the JS mirror's RNG (mean
  0.4962 instead of 0.5 over 2M draws — not noise, a real bug). `Math.imul`
  does correct 32-bit integer multiplication and fixed it. GLSL's own `uint`
  arithmetic never had this problem; only the JS mirror needed the fix. If a
  future check's numbers look "close but not quite," check for this before
  blaming sample count.
- **MSE is a full-buffer CPU readback, not the planned 64×64 downsample
  shader.** At 240×180 the whole accumulation buffer is ~173KB — cheap enough
  to `readPixels` directly once a second and diff on the CPU. Simpler than
  writing a second shader pass for the same observable behaviour (a live MSE
  readout); revisit only if the resolution grows enough to make that read
  expensive.
- **Trace resolution is fixed at 240×180 regardless of device or CSS size** —
  never read `devicePixelRatio` for the trace buffers, only for nothing (i.e.
  don't). The canvas's CSS size scales the display; the buffer size never
  changes. This is what makes a resize mid-interaction free instead of a
  re-render.
- **Orthonormal basis from a normal uses Duff et al.'s branchless method**
  (2017, "Building an Orthonormal Basis, Revisited"), not cross-with-an-axis
  — the naive approach degenerates when the normal is near that axis, which a
  sphere guarantees will happen somewhere on its surface.
- Each canvas pauses its render loop via `IntersectionObserver` when scrolled
  offscreen, and `webglcontextlost` cancels the loop and shows a message
  rather than silently freezing. Both matter once more than one tracer is on
  the page at once.

## This file is yours

This CLAUDE.md is a starting point, not a fixed rulebook. As you learn what your
prototype needs --- a convention to hold the agent to, a sensor that keeps
catching you out, a fact about the stack the agent keeps getting wrong --- write
it down here. Growing this file is the work of harness engineering, and the gap
between this boilerplate and your own version is part of what your prototype
says about the developer you're becoming.
