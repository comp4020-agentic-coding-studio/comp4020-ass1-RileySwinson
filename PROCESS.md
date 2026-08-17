# Process Overview

## What I built

An interactive explainer of pseudorandom number generators: what "pseudo"
means, two concrete generators (LCG and MRG) walked through with live,
editable mathematics, and the statistical tests that show whether a generator
is worth trusting.

## Moment 1

I initially wanted to explain monte-carlo rendering techniques. However, while I can implement GLSL shader code, the actual discussion and description of the techniques in a visual way was not particularly insightful. The monte carlo method itself is rather mathematical, but removing the mathematics and only allowing interaction with the outcome removes the point of what I was trying to communicate - the method itself. It required too much context.

So, I chose a sub-component of a Monte Carlo simulation to focus on: pseudorandom number generators.

[`de7d278...f9bbaea`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-RileySwinson/compare/de7d278...f9bbaea)

## Moment 2

Psueodrandom number generators are essential to so much of computing, yet most people are unaware what and how they work. So, I wanted to provide both intution on them, and a concrete interactive example for those with no experience in computing or math to understand a basic example. However, PRNGs are inherently mathematical, so the interacive componnet of the website must communicate that mathematics to someone without a mathematics backgrond. I took inspiration from the 3B1B (SOURCE) method of color-coding, and created a step-by-step caoursell animaition for the mathemaitcs: the entire thing is dynamic, the user can change the values, rendered with MathJax. I structure my explanation around these "widgets" -- iteractive implementations of the concept being discussed, meant to solidify understanding, not supercede reading -- inspired by the Interactive Algebra book (SOURCE), and used this same interaction method consistently across all of them.

[`bb1fa80...faf5059`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-RileySwinson/compare/bb1fa80...faf5059)

## Moment 3

I chose two specific pseudorandom number generators: LCG and MRG. I debated on this decision for some time, and debated having a more sophisticated interaction which allowed for running of the generators over time with live statistical updates. However, I decided this strayed too far from being reasonably understood by a non-technical non-statistical individual, so I stuck with creating interactions for these few things well.

LCG is the standard and very simple one. It shows PRNG history and makes the math familiar. But it does not satisfy the statistical tests. So, I add MRG, which does pass the tests. Both are defined and then shown in an interactive way.

I did later build a live version of this check anyway: a chi-squared statistic, unit-tested against hand-worked cases first, proving "LCG fails / MRG passes" instead of asserting it.

[`bb1fa80`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-RileySwinson/commit/bb1fa80), verified in [`a3f876c...fcca2e1`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-RileySwinson/compare/a3f876c...fcca2e1)

## Moment 4

I used AI in a directed way. I first had it one-shot some prototype to solidify what I consider to be *bad* decisions. This is an ideation process I often use: what is the opposite of what I want?

I encoded a few rules into my prompts. The claude.md file itself was hit-or-miss: style rules didn't stick past one prompt, but a documented bug (the RNG precision loss) did -- the next widget used BigInt from the start, unprompted. I need the widget interactions to be consistent, so I iterativley codesigned some consistent widget structure with the AI. Once it is in the code, I no longer need to prompt the AI to follow certain rules, because that rule-following is implied by the existence of code that already does the job.

The content of the website is mostly written by me with some AI-editing, becaude the AI descriptions of pseudorandomenss were either wrong, sounded a lot like AI, did not include sufficient explanations, or sounded terrible.

[`b02363c`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-RileySwinson/commit/b02363c), [`47dd3d2`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-RileySwinson/commit/47dd3d2), used unprompted in [`bb1fa80`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-RileySwinson/commit/bb1fa80), [`a3f876c`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-RileySwinson/commit/a3f876c)
