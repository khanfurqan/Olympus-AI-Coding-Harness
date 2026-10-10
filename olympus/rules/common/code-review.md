# Code review

Read by `olympus:apollo-code-reviewer`, `olympus:ares-security-reviewer` and `olympus:artemis-silent-failure-hunter`.
The severity scale and the evidence standard are shared so that three agents reviewing one diff
do not each invent their own.

## Severity

| Level | Means | Requires |
|---|---|---|
| CRITICAL | Data loss, a security hole, or money computed wrongly | Snippet, trigger, and why existing guards miss it |
| HIGH | A bug that will occur in normal use | The same three |
| MEDIUM | Correct today, fragile under a foreseeable change | A named change that would break it |
| LOW | Clarity or consistency | Nothing, and it is fine to omit these entirely |

Severity inflation destroys trust faster than a missed finding. A missing docstring is never
HIGH.

### State the trigger; it sets the ceiling

Every finding names how the failure is reached today, as one of three words, and that word caps
the grade. You pick the word; the cap is not yours to argue with afterwards.

| Trigger | Means | Highest grade |
|---|---|---|
| `normal-use` | The default path reaches it, with no special setting | CRITICAL |
| `condition` | Only with an optional flag or argument, a deliberate override, a failed write, or a rare timing or state | HIGH |
| `not-today` | Nothing reaches it now; it breaks only under a foreseeable change | MEDIUM |

**Why a table and not judgement:** eight misses recorded while Olympus was being built were one
mistake, a defect that needs a condition graded as if normal use reached
it, often after the reviewer had written that it needs one. The rule said so in words and was
reworded twice; it still broke. The review tools apply this table to what you file, so a
`condition` finding filed CRITICAL is reported as HIGH, which still blocks. `not-today` is the one
word that turns a blocking finding into advice, so use it only when you can say what change would
be needed before anything reaches the failure.

## The Pre-Report Gate

Before writing a finding, answer four questions. Any "no" or "unsure" downgrades it or drops
it:

1. **Can I cite the exact line?** "Somewhere in the auth layer" is not actionable. Take the
   line number from the file, not from the diff: a diff numbers its own lines, so its numbers
   point to the wrong place in every file it covers.
2. **Can I state the concrete failure?** Name the input, the state, and the bad outcome. If
   you cannot name the trigger, you are pattern-matching rather than reviewing.
3. **Have I read the surrounding context?** Callers, imports, tests. Many apparent issues are
   already handled one frame up.
4. **Is the severity defensible** to someone who disagrees?

## Zero findings is a valid review

A clean diff produces a clean review. Do not manufacture findings to justify having run.
Filler nits, speculative "consider using X", and hypothetical edge cases with no trigger are
the characteristic failure of automated review and they are worse than silence, because they
train the reader to skim.

## Common false positives

Skip these unless there is evidence specific to this codebase:

- "Add error handling" where the caller or framework already handles it.
- "Missing validation" on an internal function whose callers validate. Trace one caller first.
- "Magic number" for HTTP status codes, `0`, `-1`, `1024`, `60`, `24`, or a single-use local
  whose name already says what it is.
- "Function too long" for exhaustive switches, config blocks, and test tables. Length is not
  complexity.
- "Possible null dereference" where the preceding line narrows the type.
- "Should use types" in a file whose project does not. Match the stack; do not propose
  changing it in a review.
- Hardcoded values in test fixtures. Tests are supposed to have fixed expectations.
- Flagging non-cryptographic randomness (animation, jitter, sampling) as a security issue.

The test before flagging: **would a senior engineer on this project actually change this?**

## Reviewers do not edit

A reviewing agent gets read-only tools. An agent that can both find and fix stops being an
independent check and becomes a second author, and the two roles disagreeing is the entire
point.

## Every finding teaches

Findings carry: what, why it matters, the underlying principle, and where the codebase already
does it correctly. A finding the reader cannot learn from is one they have to take on faith.
