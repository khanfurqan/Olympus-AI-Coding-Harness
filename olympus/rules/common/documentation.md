# Documentation

## The four files, and the question each answers

| File | Answers | Changes |
|---|---|---|
| `CLAUDE.md` | What is permanently true here: architecture, constraints, landmines | Rarely, when the architecture does |
| `STATE.md` | What is true right now: test count, what shipped, what is open | Every session that does real work |
| `DECISIONS.md` | Why a past call was made, and what was rejected | Append-only, when a real decision happens |
| `HANDOVER.md` | Where the cursor is, and nothing else | Every session end |

The dividing line is **rate of change**, not topic. The same subject can appear in three of
them: the architecture in `CLAUDE.md`, its current test count in `STATE.md`, why it was chosen
in `DECISIONS.md`.

## Point, do not repeat

A handover that restates the architecture makes the next session pay for the same facts twice.
Each file links to the others rather than duplicating them. Cap `HANDOVER.md` at 60 lines: the
constraint is what forces it to point.

## A document that can go stale must carry its own verification

Any file asserting a number (tests passing, files present, a status) states when it was last
checked and how to re-check it. A stale number nobody can re-derive is worse than no number,
because it is trusted.

> Practice: run the suite before writing the count. Do not copy it from the last handover.

## Write down what was rejected

A decision recorded without its alternative gets re-litigated by the next person in a hurry,
including a future you. Every entry names the option not taken and why, because that is the
part that cannot be reconstructed from the code.

## Comments explain why, never what

Well-named code already says what it does. A comment earns its place only for the non-obvious:
a hidden constraint, a subtle invariant, a workaround for a specific bug, behaviour that would
surprise a reader.

Never reference the current task, ticket, or author in a comment. Those belong in the commit
message and rot in the source.

## No ceremony before there is something to record

A brand-new project needs a `CLAUDE.md` from the first commit, because "what is this and how
do I run it" is immediately true. It does not need a `STATE.md` or `DECISIONS.md` until it has
status or decisions. Creating empty files to satisfy a pattern teaches the pattern is
decorative.

## Documentation drifts silently, so check it deliberately

Code changes announce themselves; the README describing that code does not. When a feature
lands, the same change updates the document that describes it, or the drift is recorded as an
open item.

> Scar: a README claimed 5 screens and 204 tests when the app had 6 screens and 522 tests, and
> separately, a handover instructed the next session not to implement a plan that had already
> been fully implemented and committed.

## A brief another session will execute is held to the finding standard

A handover, a prompt written for another window, and a blueprint are all the same artifact: a
set of instructions somebody acts on without the context that produced them. They get the same
gate a review finding gets, and for the same reason. A finding that cites the wrong line wastes
a reader's minute; a brief that cites the wrong symbol sends a whole session down a path.

Before it goes out, every **symbol name, line number, file path, count and date** in it is
verified, not recalled. Recall is where this fails: the fact was often checked earlier in the
same session and then written down differently.

Two further checks, because instructions fail in ways findings do not:

- **Read the goal and the verification together.** If the goal requires changing something and
  the check asserts that thing is unchanged, the brief contradicts itself. See
  `testing.md`, "a check must be able to fail for the reason the task exists".
- **State what you did not check.** A brief that separates verified facts from assumptions lets
  the receiving session spend its scepticism where it is needed, instead of re-deriving
  everything or trusting all of it.

> Scar: one brief named a module-level constant that had been moved into a function, in a
> session that had already hit `AttributeError` on that exact name. Another specified a
> verification that would have passed while the task's goal failed completely.
