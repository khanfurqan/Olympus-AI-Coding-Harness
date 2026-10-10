---
name: ponytail-review
description: >
  Code review focused exclusively on over-engineering. Finds what to delete:
  reinvented standard library, unneeded dependencies, speculative abstractions,
  dead flexibility. One line per finding: location, what to cut, what replaces
  it. Use when the user says "review for over-engineering", "what can we
  delete", "is this over-engineered", "simplify review", or invokes
  /ponytail-review. Complements correctness-focused review, this one only
  hunts complexity.
---

Review diffs for unnecessary complexity. One line per finding: location, what
to cut, what replaces it. The diff's best outcome is getting shorter.

## Format

`L<line>: <tag> <what>. <replacement>.`, or `<file>:L<line>: ...` for
multi-file diffs.

Tags:

- `delete:` dead code, unused flexibility, speculative feature. Replacement: nothing.
- `stdlib:` hand-rolled thing the standard library ships. Name the function.
- `native:` dependency or code doing what the platform already does. Name the feature.
- `yagni:` abstraction with one implementation, config nobody sets, layer with one caller.
- `shrink:` same logic, fewer lines. Show the shorter form.

## Examples

❌ "This EmailValidator class might be more complex than necessary, have you
considered whether all these validation rules are needed at this stage?"

✅ `L12-38: stdlib: 27-line validator class. "@" in email, 1 line, real validation is the confirmation mail.`

✅ `L4: native: moment.js imported for one format call. Intl.DateTimeFormat, 0 deps.`

✅ `repo.py:L88: yagni: AbstractRepository with one implementation. Inline it until a second one exists.`

✅ `L52-71: delete: retry wrapper around an idempotent local call. Nothing replaces it.`

✅ `L30-44: shrink: manual loop builds dict. dict(zip(keys, values)), 1 line.`

## Scoring

End with the only metric that matters: `net: -<N> lines possible.`

If there is nothing to cut, say `Lean already. Ship.` and stop.

## Boundaries

Scope: over-engineering and complexity only. Correctness bugs, security holes,
and performance are explicitly out of scope. Route them to a normal review
pass, not this one. A single smoke test or `assert`-based
self-check is the ponytail minimum, not bloat, never flag it for deletion.
Does not apply the fixes, only lists them.
"stop ponytail-review" or "normal mode": revert to verbose review style.

---

# Olympus additions, 2026-09-25

**This is a local edit to an installed skill.** Re-apply it after an installer update, the same
way `disable-model-invocation` is re-applied. Everything
above this line is the author's; everything below came from `hestia-code-simplifier` when that
agent was folded into this skill.

## Two tests before proposing anything

Run both on every finding above, before it goes in the list. This is the part the format above
has no room for, and it is the part that stops a simplification being a bug.

**1. Would the simpler version still be correct in every case the current one handles?** If you
have not read the edge cases, you are proposing a bug. Where you are not sure, say what you did
not check rather than dropping the caveat.

**2. Is the simpler version actually easier to read, or merely shorter?** This one runs against
the `net: -N lines` score above, and it wins where they disagree. Clever compression is the
failure mode of this whole exercise: a comprehension nested three deep is shorter than the loop
and worse than it. Fewer lines is the usual sign of less complexity, never the definition of it.

**Complexity is how much you have to hold in your head at once, not length.** A hundred-line
exhaustive `match`, a config block or a parametrised test table is long and perfectly simple. Do
not flag length.

## Shapes the tags above do not name

`delete`, `stdlib`, `native`, `yagni` and `shrink` cover most of it. These four are also real and
have no tag, so file them under the nearest one and say which shape it is:

- **Defensive code for impossible states.** A check for a condition the callers cannot produce.
  **Trace one caller before flagging, and say which caller you traced.**
- **A layer that only forwards.** A function, wrapper or module that transforms nothing and exists
  to be called by exactly one thing.
- **State that did not need to be state.** A value held across calls where recomputing is cheap
  and correct. Derived beats stored.
- **Duplicated logic with drifting copies.** Not two similar-looking blocks, which are often fine,
  but two blocks that must always agree with no mechanism forcing them to.
- **A dependency doing what ten lines would do.** The `stdlib` and `native` tags above catch the
  other direction, a hand-rolled twenty lines the platform already ships. **Both directions are
  the same error**, and only one of them has a tag.

**Order the list by what buys the most**, not by where things appear in the diff.

## What to leave alone

- Code that is complex because the problem is complex. Say that when it is true.
- **Anything the project has recorded a decision about. Check `DECISIONS.md` first.** A recorded
  decision is not over-engineering, and arguing with one without new evidence wastes the reader.
- Pre-existing complexity next to the change under review, unless asked to look wider. Mention it
  is there and move on.
- Style, naming and formatting. Not the job.

## Say the cost, not only the saving

The one-line format carries what to cut and what replaces it. Where a cut has a real cost, add it
on the same line after a dash. Sometimes the cost is nothing. Sometimes it is "the extension point
disappears, and if a second implementation arrives you put it back". A saving with no cost stated
has not been thought about, and it is the one the user will be living with in six months.

## No silent refactoring

Propose; never apply. That is a standing rule of this workspace and not only this skill's
boundary: restructuring that arrives as a finished diff cannot be evaluated, and the person
maintaining the code in six months is the person who has to be able to read it.
