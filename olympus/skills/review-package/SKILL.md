---
name: review-package
description: Build a self-contained package for external AI reviewers, then synthesise their responses into a ranked plan and implement it. Use when the user asks for a review package, a second opinion, external review, or wants to send a design out for critique.
---

# External review round

A full round has five stages. The user runs stage 2; you run the rest.

| Stage | Who | Output |
|---|---|---|
| 1. Build the package | You | One self-contained markdown file |
| 2. Distribute | The user | Sends the file, unmodified, to N reviewers |
| 3. Synthesise | You | A synthesis document, not a summary |
| 4. Plan | You | Ranked plan, wait for approval before building |
| 5. Implement | You | Then update `STATE.md` |

**Always end every stage by saying where the project is in its development journey.**
A user who is not a developer can easily lose track. See "Locating the project" below.

Proven method: a six-reviewer round on an earlier project found a critical bug
(an action landing in the wrong place) that had been seen and rationalised away, plus four
unanimous findings on questions that had been flagged as uncertain.

---

## Stage 1: Build the package

Write to `<project>/review/<YYYY-MM-DD>-review-package.md`. One file, self-contained.
Reviewers have no repository access and no memory of prior rounds.

### Required sections

**0. Reviewer instructions.** Their role, that there are N independent reviewers, and what
feedback is useful. Say plainly that generic best-practice advice not tied to a concrete
failure is not useful. Tell them settled decisions are recorded *so they can be attacked*.

**1. What the thing is.** One paragraph, then a concrete worked example: real input, real
output. Examples do more than description.

**Who is building it, and why that matters.** State the maintainer's experience level
explicitly. For example: someone with no prior programming background, learning as they
go, who has stated a preference for the boring readable solution.
**This changes recommendations.** In that round it was decisive on three questions,
including whether to introduce an abstraction layer at all.

**2. Hard constraints.** Measured hardware, not spec sheets. Privacy or regulatory
constraints. Anything non-negotiable. Reviewers cannot infer these and will otherwise
propose impossible things.

**3. What is built and working.** A pipeline diagram, and a table of **measured**
performance. Real numbers make a review dramatically more concrete.

**4. Actual code, not descriptions of code.** Include prompts verbatim, key function
signatures, and **the error-handling paths**. See the lesson below on why.

**5. Decisions already made, with reasoning.** A numbered table: decision, why, what was
rejected. Label it "settled, not sacred" and invite attack on the reasoning.

**6. The proposed change**, if there is one, with its acknowledged costs.

**7. Roadmap**, with what is deliberately out of scope and why.

**8. "Please do not suggest these."** A table of already-rejected ideas with the reason.
Without it, reviewers spend their effort on GPU acceleration, rewriting in Rust, and
cloud fallbacks.

**9. Numbered questions**, ordered by how much you doubt your own position.

**10. Requested response format**, verbatim, so N replies come back comparable.

### The single highest-value section is your own untested assumptions

Order the questions by genuine uncertainty and **lead with the thing you have not
measured.** In that round, Q1 was "is this whole stage justified? I never tested
this" and it produced the strongest consensus and the largest speed-up.

Reviewers reward honesty about gaps with precise attacks on those gaps. Hiding a weak
assumption behind confident prose wastes the round.

### Two closing requests that measurably improve responses

- **"Do not soften."** State there is no sunk cost to protect.
- **"Flag where you expect another reviewer to disagree."** This is what lets you tell
  contested points from merely differently-phrased agreement in stage 3.

---

## Stage 2: Distribution (the user does this)

Tell them:

- Send the file **unmodified** to every reviewer, so differences are real disagreement
  rather than artifacts of framing.
- **Do not tell reviewers about each other**, or show one reviewer another's response.
  Independence is the entire value.
- Three is enough; six gives clearer signal on what is genuinely contested.

---

## Stage 3: Synthesise

Write to `<project>/review/<YYYY-MM-DD>-synthesis.md`.

**A synthesis is not a summary.** Restating six reviews in order adds nothing. The value
is entirely in cross-cutting analysis. Work through these seven steps in order.

### 1. Tabulate by question, then count

For each numbered question, record every reviewer's position in one row each. Agreement
counts are the raw material for everything after.

### 2. Verify every claim against the actual code

**Do this before crediting any finding.** In that round roughly **15% of issues
raised were already fixed**, because reviewers had a description of the error handling
rather than the error handling. Run `grep`. Confirm the bug is real before acting.

Then feed the result back: if reviewers reported fixed bugs, the next package needs more
real code in it.

### 3. Check whether consensus actually applies to this machine

**Unanimity is not correctness. It is correlated priors.**

In that round, six of six flagged a conflict with a keyboard key. One command showed the
machine had no keyboard layout with that key installed. The
finding was legitimate in general and inapplicable in fact.

**Check the machine-specific fact before acting on any unanimous finding that depends on
one.** Reviewers cannot check; you can.

### 4. Look for contradictions that dissolve

Surface disagreement often hides agreement. Read past the opening verdict to what each
reviewer actually proposes.

Example from the same round: on showing results as they arrive, positions ranged from "absolutely not" to
"yes, highest leverage". Reading the detail, **five of six proposed the same thing**: show
progress somewhere safe, keep the final action atomic. Only one wanted the final action itself
made incremental.

Do not report a contradiction until you have checked whether the reviewers are answering
different questions.

### 5. Do not vote on empirical questions

Where reviewers disagree on a number with no measurement behind it, that is noise, not
signal. In the same round, three reviewers gave three different timing thresholds with
zero data. **Report it as unmeasured and make it configurable.** Averaging opinions about
a measurable quantity produces a number with no meaning.

### 6. State what you reject, and why

A synthesis that adopts everything is not a synthesis. Six reviewers pulling six directions
is worse than none. Every rejection needs a reason, especially against consensus.

Also record where you have evidence the reviewers lacked. In that round one reviewer
predicted that an extra transformation stage risks losing information; build logs showed
it had already silently dropped part of the input. That made the case stronger than any
reviewer knew.

### 7. Say what all of them missed

Ask what question nobody asked. In that round it was whether the product's core transformation
actually improves downstream results at all, which is the largest risk in the project and
which every reviewer circled without naming.

---

## Stage 4: Plan

Rank by value divided by effort, not by reviewer enthusiasm. Mark which items have real
consensus behind them and which are single-reviewer suggestions.

Separate:

- **Bugs** (fix now)
- **Measurable questions** (test before deciding, do not implement an opinion)
- **Architecture** (defer unless a bug forces it)
- **Documentation** (cheap, do it)

**Then stop and wait for approval**, per the standing instruction to plan before code.

---

## Stage 5: Implement, then update STATE.md

After building, update `<project>/STATE.md` so the next session knows where things stand.
Append durable calls to `DECISIONS.md`, including decisions to *reject* review findings,
so they are not re-litigated by the next round.

---

## Locating the project

**Do this at the end of every stage, unprompted.** A user who is not a developer may not be able to tell where
they are in the development journey. Four lines, no jargon:

```
WHERE WE ARE
  Just finished:  <the thing that is now done and verified>
  Doing now:      <the current step>
  Next up:        <the immediate next step, and why it is next>
  Not yet:        <what is deliberately still ahead>
```

Anchor it to the project's own phase numbering where one exists. Say plainly when a phase
boundary has been crossed, because that is the moment orientation is most easily lost.

---

## Failure modes of this process

| Failure | How it shows up | Guard |
|---|---|---|
| Package describes code instead of showing it | Reviewers report already-fixed bugs | Paste real code, especially error handling |
| Synthesis is a summary | Six sections, one per reviewer | Organise by finding, never by reviewer |
| Consensus adopted without checking | Work done for a case that cannot occur | Verify machine-specific facts yourself |
| Opinion implemented as fact | A number changed because reviewers voted | Test it, or make it configurable |
| Everything adopted | Contradictory changes, design pulled apart | Publish an explicit rejection list |
| Round produces architecture, not fixes | Weeks of refactoring, same bugs | Rank bugs above abstractions |
