---
name: test-first
description: Run the test-first loop on a change to behaviour - write the failing test, check it failed for the intended reason, make it pass, then check it passes for the right reason. Use before implementing a wrong result, a boundary, a calculation, stored data, access, or a bug fix, and whenever a test passes and that needs confirming.
---

# Test first

Written from `metis-tdd-guide` on 2026-09-25, when that agent was folded into this skill.

**What changed in the move, and what it costs.** metis held no `Bash`. It could not run anything,
so it named the command and the main chat ran it and handed the output back. This skill *is* the
main chat, so the running happens here and that round trip disappears. metis also held no `Edit`,
deliberately: *"someone who has an agent write their tests learns the framework's syntax and none
of the thinking, and the thinking is the part that transfers."* **That boundary is gone**, because
the chat that runs this skill is the one writing the code.

The prediction step below is what is left doing that job — saying what the failure will look like
*before* running it is the part that carried the learning. **It is not an equal replacement, and
it should not be read as one.** metis could not skip the step because it held no tool to skip it
with; a gate that fails closed. This is a written instruction to the same actor that also writes
the code, which fails open: skip it and everything still runs, and nothing reports that it was
skipped. The likeliest moment for that is exactly when the session is long, or when the user says
"just do it" — and that is the moment the prediction is worth most. Write it down anyway.

## Load first

`${CLAUDE_PLUGIN_ROOT}/rules/common/testing.md`. Actually open it. It holds the standard: RED
before GREEN, one test per shipped bug, tests never touch real data, assert shape rather than
values for external sources, a monkeypatched path is not the real path, and what does not deserve
a test at all.

**Two of those are load-bearing here and appear nowhere else on this page**, so if the read is
skipped they are simply gone:

- **A test never touches real data.** In a project that keeps a database or real ledger
  files, that means those. An autouse fixture redirects storage paths to a
  temporary directory; if a new test reaches around it, say so and fix the fixture.
- **For an external source, assert the shape, not the value.** A live price feed's numbers change. A
  test that hardcodes today's price passes today and fails on Tuesday for no reason anyone caused.

## When this applies

A change to behaviour: a wrong result, a boundary, a calculation, stored data, access, or
anything that leaves the app. A bug fix always. Typos, renames and formatting do not.

## The loop

### 1. Before the test exists

Name what should be tested, and say why each one earns its place. Point at the boundaries: empty,
zero, one, missing, malformed. Point at the arithmetic. If this is a bug fix, the first test is
the one that reproduces the bug, described in the words someone would use to report it.

Then **say out loud what you expect the failure message to look like.** This matters more than it
sounds: predicting the failure is how you find out whether you understand the defect, and a
prediction that turns out wrong is the most informative event in the whole loop. Write the
prediction where the user can see it, before running anything.

### 2. RED

Write the test, run it, and check the thing almost everyone skips: **did it fail for the reason
intended?** An `ImportError`, a typo in a fixture name or a `SyntaxError` is a red test that has
proved nothing.

Compare the actual failure against the prediction and say whether they match. If they do not, the
test is testing something other than what was meant — fix the test, not the prediction.

### 3. GREEN

Write the implementation. Run **the suite**, not just the new test.

Then ask whether it passes for the right reason. A test that passes the moment it is written has
proved nothing either: it may assert something that was already true, or assert nothing at all.
**The check is to break the implementation deliberately and confirm the test notices.** Make the
specific one-line change that should make it fail, run it, watch it fail, then put it back. Say
what you changed and what happened.

**Then run the suite once more and say it is green again.** This half is not optional either.
The revert can be missed, partial, or aimed at the wrong line, and if it is, the break you
introduced on purpose ships inside a change reported as finished. Nothing else in this loop would
catch that: the report asks whether the RED matched the prediction, not whether the tree is clean
at the end. A verification whose own success is unverified is not a verification.

This step is not optional and it is not ceremony. It is the only evidence that the test is
attached to the behaviour rather than sitting beside it.

### When a fix fails twice, stop

A failed fix is a change meant to turn the RED test green (or, with no test, to clear the check that
showed the fault), after which that test is still red or the suite has gone red. **Count the first
implementation too**, and it still counts when the error message changed or when the test was edited
rather than the code. Repairing the test during RED, for a typo or an import, is not a fix. Number
each one as you report it, "fix 1 of 2", so a stop that was due cannot pass unseen. The count
restarts only when the user replies to the stop report, and you say "count restarted" when it does; a
handover carries it.

**After the second one, make no third attempt.** Tell the user instead:

- what each of the two fixes assumed, and why the result shows that was wrong;
- the likeliest cause now, and the evidence that points there;
- two or three options, each with its cost, and the one you recommend.

Then wait for the user's answer. This is one of the times ZEUS lets you ask after a "go". Why: a third
guess usually rests on the misunderstanding that sank the first two, so it fails the same way, and
each failed attempt leaves more changed lines to untangle. Say which of the two attempts are still
in the files, so the user knows what the options start from.

### 4. After GREEN

Say what is now safe to change because a test covers it, **and what is still uncovered.** That
second list is the useful one.

## What not to push for

Coverage as a number. Tests for getters, for framework behaviour, or for anything where the test
would simply restate the implementation. A test that changes every time the code changes is
measuring nothing, and asking for it makes the whole practice look like ceremony.

## Output

Short. What to test with a reason each, the predicted failure, then after each run, whether the
result matched the prediction and what that tells you. Report the real output, including when it
is not what you said it would be.
