---
name: handover
description: End a session cleanly and hand it to a fresh chat. Writes what changed into STATE.md and DECISIONS.md, then a short capped HANDOVER.md holding only the volatile "where the cursor is". Use when the context-budget warning says a handover is due, when the user asks to hand over or wrap up, or before switching to an unrelated topic.
---

# Handover

A long session costs more per step than a short one, because every step re-reads the whole
conversation. Past roughly 75% of the window a step costs 15–20x what the same step costs in a
fresh chat. This skill ends the session deliberately instead of letting it degrade.

## The governing rule

**HANDOVER.md points. It never repeats.**

| What it is | Where it goes |
|---|---|
| Permanent fact — architecture, constraint, convention | the project's `CLAUDE.md` |
| Current status — what's shipped, test count, open items | `STATE.md` |
| A call that was made, and why | `DECISIONS.md` |
| Where the cursor is right now, mid-task | `HANDOVER.md` |

The first three survive on their own and are already loaded or easily read. Only the fourth is
genuinely lost when a session ends, so only the fourth belongs in the handover. A handover that
restates the architecture makes the next chat pay for the same facts twice.

## When is a good moment

The budget warning tells you *that* a handover is due; this decides *when*. A safe point is one
where nothing is half-applied:

- the git working tree is clean, or the only changes are ones you would commit anyway
- the task in flight has finished, not merely paused
- tests pass, so the next session inherits a known-good state

If the tree is dirty, finish or commit first — handing over mid-edit is how the next session
loses work. If a task genuinely cannot finish inside the remaining budget, park it explicitly:
say so in **Where I stopped**, name the exact position, and leave the tree in a state that runs.

Say the moment out loud when it arrives. Do not wait to be asked, and do not repeat it every turn.

## Steps

1. **Update `STATE.md`** with what actually changed this session — including what failed or was
   left half-done. If the project has no `STATE.md` yet and now has status worth tracking,
   create one.
2. **Append to `DECISIONS.md`** any real call made this session and the reasoning behind it.
   Skip if nothing was genuinely decided; do not manufacture entries.
3. **Promote permanent facts to `CLAUDE.md`** — anything learned this session that will still be
   true in six months, especially constraints discovered the hard way.
4. **Check the records against the evidence with `olympus:hestia-docs-updater`.** Run it on
   the project's `STATE.md` and `CLAUDE.md`, after steps 1 to 3. It holds no `Bash`, so first
   write its evidence file, `<scratchpad>\evidence\handover.txt`, overwriting any earlier one:
   `git log -15 --format="%h %cd %s" --date=short`, the test suite's result if the project has
   one, and `wc -l` of the files the records quote line counts for. Use a redirect, so the
   output goes to the file and not into this chat. Give hestia that path. It checks each
   claim against that file and the files on disk, and returns a table of exact replacement
   text; it cannot edit. Run anything it lists under NEEDS_RUN. Check each row's evidence
   yourself, apply the rows that hold, and say in one line what you applied before the closing
   message. "No drift found" is a normal result:
   move on. **Why this step exists:** on 2026-09-13 one pass over Olympus's own records
   found 13 stale or disconnected statements, four of them in `STATE.md`, that no session had
   noticed.
5. **Archive any existing `HANDOVER.md`** to `archive/HANDOVER-<YYYY-MM-DD>.md`, creating
   `archive/` if needed.
6. **Ask what belongs in `LEARNING.md`.** One question, here and not earlier: was a *concept*
   understood this session, as opposed to a status or a decision? Those three go to three
   different files and only the first belongs in `LEARNING.md`. If yes, run `/learned`. If
   nothing was learned, say nothing and move on — most sessions produce no entry, and
   manufacturing one devalues the entries that are real.
7. **Write the new `HANDOVER.md`** using the template below. **Hard cap: 60 lines.** If it does
   not fit, the excess belongs in one of the other three files — move it there, do not trim
   detail that matters.

   **Verify before you write, do not recall.** Every symbol name, line number, file path, test
   count, commit hash and date in the handover gets checked against the thing itself. This is
   the one document written at the end of a long session, which is exactly when recall is least
   reliable and when a fact checked two hours ago gets written down differently. Separate what
   you verified from what you are assuming, and say which is which. The standard and its scars
   are in `${CLAUDE_PLUGIN_ROOT}/rules/common/documentation.md`, "a brief another session will execute".
8. **Send the closing message below, which asks for the clear, then stop.** Do not call the
   clear-session tool in the same turn. Call it only after the user says yes in the chat, in a
   later turn; the start-of-chat hook then points the fresh chat at the new `HANDOVER.md`. Do not
   rely on the tool's own approval prompt: auto mode skipped it on 2026-09-19 and the chat cleared
   unasked. The `permissions.ask` rule in `~\.claude\settings.json` is a second guard, not the
   first. Never say the clear is approved unless the user said so. If no clear tool is available,
   the closing message alone does the job: the user starts a new chat.

## Template

```markdown
# Handover — <project> — <YYYY-MM-DD>

**Task:** <one line: what was being attempted>
**Status:** <in progress | blocked | complete, next thing queued>

## What I just did
- <2–5 bullets, concrete, past tense>

## Where I stopped
<Exact position: file:line, the failing test name, the command that was about to run.
Be specific enough that the next session does not have to re-derive it.>

## Next concrete step
<One action, unambiguous, executable without re-reading this whole file.>

## Live gotchas not yet in CLAUDE.md
- <Only things discovered this session that aren't recorded elsewhere. Often empty — that is fine.>

## Read these first
1. `CLAUDE.md` — loads automatically
2. `STATE.md` — current status
3. <up to 3 specific files this task touches>
```

## Closing message

End with exactly this shape, filled in:

> Handover written to `<path>`. This session is at <N>% context — continuing here costs roughly
> <M>x what the next chat will. **Shall I clear this chat?** Say yes, and the fresh chat finds
> the handover. If you start a new chat instead, open with:
> `Read HANDOVER.md in <project> and continue.`

## Notes

- Thresholds live in `~/.claude/context-budget.json`. `window_tokens` is set by hand and assumes
  a 1M-token model; drop it to 200000 if the session model has a 200k window, or the percentages
  will read low and the warnings will fire too late.
- Superseded handovers go to `archive/`, never left beside the live one.
