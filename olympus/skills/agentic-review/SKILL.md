---
name: agentic-review
description: Review the current change with the right specialist reviewers, chosen from what the diff actually touches, then merge their findings into one ranked list with a blocking or advisory verdict. Use when the user asks to review a change, says they are about to commit, asks whether something is safe to ship, or types /agentic-review.
---

# Review

One command that answers: **is this change safe to commit, and what would I learn from it?**

The value here is not calling `olympus:apollo-code-reviewer`. You can do that by name. The value is picking
the right reviewers from what actually changed, running them in parallel, merging what they
find, and giving one verdict instead of four reports that overlap.

## Step 1: Establish the diff, and say what it is

```bash
git status --short
git diff --stat
```

Default scope is uncommitted work: `git diff` plus `git diff --staged`. If the tree is clean,
review the last commit (`git diff HEAD~1`) and say that is what you did. If the user named a
branch or a commit range, use that.

State the scope in one line before reviewing anything, so a review of the wrong thing is caught
immediately rather than after the findings.

**If the diff is empty, stop and say so.** Do not fall back to reviewing the whole repository.

### Then ask what question is being answered, because it is not always "is this change safe"

The diff is the default scope, not the only one. Some questions are about a **subsystem**, and
the code that answers them may not have changed:

| If the real question is | Also in scope, diff or no diff |
|---|---|
| "Is this safe to publish?" | The publish gate itself, `.gitignore`, and what `git ls-files` actually returns |
| "Is this secure?" | The auth path and the validation boundary, not only the lines that moved |
| "Did I break the tests?" | The fixtures and `conftest.py` that the changed tests rely on |
| "Is the data right?" | The write gate, including untracked data files that git cannot show you |

Name any subsystem you are pulling in and say why. Two lines.

**This rule exists because it was missed.** On 2026-09-06 a `/review` before publishing a repo
correctly scoped to a documentation-only diff, correctly skipped `olympus:artemis-silent-failure-hunter`, and
therefore never looked at the publish gate, which was the thing the question was actually about.
The gate had a branch that reported PASS when its wordlist was empty. Scoping to the diff was
right; treating the diff as the whole scope was not.

### Then write the evidence file

The reviewers hold no `Bash`, so they cannot run `git`. You run it, and you write the output
straight to a file in this chat's scratchpad, overwriting any earlier one:

- `<scratchpad>\evidence\review-diff.txt`: `git status --short`, `git diff --stat`, then the
  full diff of the scope stated above.
- `<scratchpad>\evidence\review-extra.txt`, only when a pulled-in subsystem needs command
  output, for example `git ls-files` for "is this safe to publish?".

Use a redirect (`git diff > <file>`), so the diff goes to the file and not into this chat. This
chat is re-read at every later step, and a diff pasted into it is paid for again each time.

## Step 2: Choose the reviewers from the scope

Run `olympus:apollo-code-reviewer` always. Add the others only when the trigger is present, because a reviewer
with nothing in scope produces noise or, worse, invents something:

| Add | When the diff contains |
|---|---|
| `olympus:artemis-silent-failure-hunter` | error handling, parsing, an external feed, a fallback, any `try`, **or any check whose own failure would permit the thing it guards** |
| `olympus:ares-security-reviewer` | a path built from input, a subprocess, SQL, a new dependency, anything touching auth, **or any change in a repo that might be published** |
| `olympus:aphrodite-design-reviewer` | a template, stylesheet, component, or anything rendered |

Name which ones you are running and why, in one line each. If only `olympus:apollo-code-reviewer` applies,
say that too: it tells the user something about their change.

**If the diff contains any `.py` file, say so in apollo's brief**, because the Python traps live
in `rules\python\README.md` and apollo loads that file only when it knows Python changed. Then
check its `READ` section names that file. This replaces the row for the retired Python reviewer,
`olympus:apollo-python-reviewer` (not today's `apollo`), that stood here until 2026-09-25: a reviewer deciding privately whether to read a rule file makes
"I checked and found nothing" look exactly like "I never checked".

Run them in a single message so they work in parallel rather than in sequence.

Every reviewer's brief holds three things: the scope line from step 1, the full path of each
evidence file, and this report contract, word for word:

```text
End your report with these four labelled sections, in plain text:
SCOPE: <the evidence file you were given, and what it covers>
READ: <every file you opened, the evidence file first>
FINDINGS:
SEVERITY | TRIGGER | file:line | "exact snippet" | what goes wrong | the principle
(or the one word: none)
TRIGGER is one of normal-use, condition, not-today, as defined in rules/common/code-review.md.
NEEDS_RUN: <each command that would prove a finding, or none>
Write each label as shown, not as a heading, and put nothing after NEEDS_RUN.
```

## Step 3: Check each report, then merge on the code

**First, check every report against the contract.** A report fails when a section is missing,
when READ does not name the evidence file, when a finding line lacks one of its six parts, or when
its TRIGGER is not exactly `normal-use`, `condition` or `not-today`.
These are text checks, not judgement. A failed report counts as a reviewer that did not run, so
the review becomes INCOMPLETE. Layout alone never fails a report: a section written as a heading
(`## SCOPE`) is present, and an extra line such as a verdict is ignored. Say so when you see
either, so the habit shows. (Olympus's maintainer ruled this on 2026-09-18, after 5 of 16 benchmark reports broke
the layout and none lost content.) "FINDINGS: none" with a full READ is a real, clean result;
"FINDINGS: none" with an empty READ is a failed review.

**Then deal with NEEDS_RUN.** Run each listed command yourself, where the user can see it. A
command that writes anything runs first in a scratchpad copy, never in the project. Say which
commands you ran and what each one showed.

Findings arrive with different titles for the same defect, because four agents describe things
differently. **Deduplicate on the code being pointed at, not on the wording.** Two findings
citing the same file and line are one finding, and you keep the more specific of the two
descriptions plus the higher of the two severities.

**Cap each finding at its stated trigger before you merge.** `condition` caps at HIGH,
`not-today` at MEDIUM, `normal-use` at nothing; the table is in `rules\common\code-review.md`.
Lower only, never raise. A trigger that is missing or not one of the three words has already
failed the report under the check above, so there is nothing to guess. Show the change on the finding
("HIGH, filed CRITICAL, capped: condition"), because a grade that moved without saying so is a
silent correction. The reason for the cap: this review has no
verification step, so nothing else here corrects an inflated grade, and the deep review applies
the same table in code.

Report both counts: how many findings arrived and how many survived merging. The gap is
information, and it is the same argument the Stage 5 workflow is built on.

## Step 4: Verdict, and be honest about which kind it is

| Verdict | Means |
|---|---|
| **BLOCKING** | At least one CRITICAL or HIGH survived. Name them, and name them only |
| **ADVISORY** | MEDIUM and LOW only. Worth reading, not worth stopping for |
| **CLEAN** | Nothing found. A real and common outcome, not a failure of the review |
| **INCOMPLETE** | A reviewer failed, could not run, or returned a report that failed the step 3 check. **Never report this as clean** |

That last row is the one that matters. A reviewer that dies leaves its dimension unreviewed,
and an unreviewed dimension is not an approval. Say which reviewer failed and what is therefore
unchecked.

**BLOCKING and INCOMPLETE can both apply, and then you report both.** A blocking finding from
one reviewer does not hide that another reviewer's dimension went unchecked.

## Step 5: What the user does next

Close with the smallest set of actions that would clear the blocking findings. Nothing else.

Do not offer to fix them silently. The reviewers cannot edit, deliberately, and the fix belongs
in the main conversation where it is visible and can be argued with.

## What this skill does not do

It does not commit, and it does not edit. If every finding is cleared and the user wants to
commit, that is a separate and explicit act.
