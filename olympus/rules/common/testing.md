# Testing

## RED before GREEN, and the RED has to be real

Write the test first, watch it fail, and check it failed **for the reason you intended**. A
test that passes the moment you write it has proved nothing: it may be asserting something
already true, or asserting nothing at all.

The order is the whole value. A test written after the code tends to encode what the code
does rather than what it should do.

## A check must be able to fail for the reason the task exists

Test the **goal**, not the **mechanism**. "Did the tool run correctly" and "is the thing I
wanted now true" are different questions, and only the second one is the test.

The failure is quiet and total: the mechanism works, the check passes, the investigation stops,
and the goal was never met. A verification that cannot fail is worse than no verification,
because no verification at least leaves the question open.

Before accepting a check, ask: **what would have to be wrong for this to fail?** If the answer
is only "the tool crashed", it is testing the tool. Then ask the harder one: **could the task
fail completely while this still passes?** If yes, the check is measuring the wrong thing.

> Scar: a plan to remove an email address from a repository's history verified it by listing the
> distinct author and committer addresses afterwards. The address was also inside a tracked
> file, which a metadata rewrite does not touch. The rewrite would have succeeded, the check
> would have passed, and the address would still have been there.

The same rule catches an internal contradiction worth naming: if a task's goal requires changing
something, a check asserting that thing is unchanged cannot coexist with it. Read the goal and
the check together before starting.

## A monkeypatched path is not the real path

A test that exercises a function only through mocks, fakes or patched attributes has proved the
function's logic and not that the real path reaches it. Both are worth testing and they are not
the same test.

Where a check gates something, prove it at least once end to end: set the real condition, run
the real entry point, and read the real exit code. A gate that has only ever failed under
monkeypatch has never been observed to fail.

## One test per bug that actually shipped

When a real defect is found, the regression test names the symptom in plain language and would
have failed against the code as it was written at the time. This file becomes the most
valuable in the suite, because every entry is a mistake that genuinely happened rather than
one somebody imagined.

> Practice: keep a single `tests/test_regressions.py` with one test per shipped bug, such as a
> percentage that jumped a thousandfold or one data series overwriting another.

## Tests must not touch real data

The suite runs against invented inputs, in a temporary location, with no network. Enforce it
structurally rather than by remembering: an autouse fixture that redirects every storage path
means no individual test can forget.

The check that this works: hash the real data files before and after a full run.

> Scar: the alternative is a suite that quietly rewrites the ledger it was meant to be
> protecting.

## Fast enough to run every time

If the suite takes minutes, it gets run at the end, which is when it is least useful. Keep the
default run offline and in seconds. Anything that needs a network goes behind an opt-in marker
and is run deliberately.

## Assert shape for external sources, not values

A contract test against a live source checks that the response still has the fields you rely
on. It must not assert a price, because a price changing is not a failure. A missing column
is.

## What deserves a test

- Anything with arithmetic in it, especially money.
- Any bug that has occurred once.
- Any invariant you would be embarrassed to break: totals reconciling, a derived figure
  matching its inputs.
- Any boundary: empty, zero, one, missing, malformed.

## What does not

Getters, framework behaviour, generated code, and anything where the test would simply restate
the implementation. A test that changes every time the code changes is measuring nothing.
