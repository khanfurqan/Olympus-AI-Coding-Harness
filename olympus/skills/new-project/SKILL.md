---
name: new-project
description: Set up a new project folder in the workspace in the right order — decide what is sensitive, write .gitignore before git init, prove the exclusions work, then a minimal CLAUDE.md. Use when starting a new project, scaffolding a repo, or running git init for the first time in a folder.
disable-model-invocation: true
---

# New project

Lives here rather than in the workspace's `CLAUDE.md` because it is a procedure invoked perhaps
monthly, and anything in that file is re-read on every turn of every session. Moved 2026-08-23.

## New project checklist

The sequenced, actionable version of the workspace's git and documentation standards — follow
in order. Explains *what* to do; for *why*, see `${CLAUDE_PLUGIN_ROOT}/rules/common/git-workflow.md`
and `${CLAUDE_PLUGIN_ROOT}/rules/common/documentation.md`.

1. Create the project folder in the workspace folder.
2. **Before writing any code**, decide what this project will touch that's sensitive —
   financial records, health data, credentials, other people's information. This decides
   `.gitignore`'s categories up front instead of being reconstructed after the fact, which
   is the harder order (one project built this way worked out only because work
   stopped and this was done properly before the first commit rather than after).
3. Write `.gitignore` **before** `git init`, even if it's only language-runtime artifacts
   and OS/editor cruft to start — add the personal-data category as soon as you know its
   shape, don't wait for the folder to exist first. Categorize every line by *reason*.
4. `git init`.
5. Confirm git identity is set — `git config --global user.name` /
   `--get user.email`. This is machine-wide, not per-project; once it is set (a name, with
   a GitHub no-reply address as the email), this step should just confirm, not repeat. If
   the email shows a personal address, stop: every commit publishes it.
6. `git status` **before** the first `git add` — the actual proof the `.gitignore` works
   is that sensitive paths don't appear in the untracked list, not that the file exists.
7. First commit: source, tests, and docs only. Skim the staged file list once more before
   committing (`git status` again after `git add`) — cheap, and it's the last checkpoint
   before the commit is permanent.
8. Write a minimal project `CLAUDE.md` **from commit one** — even three lines (what it is,
   how to run it) beats none, and it's easier to grow alongside real decisions than to
   backfill later. Note: line-ending warnings
   (`LF will be replaced by CRLF`) on a fresh Windows repo are normal, not an error.
9. **Hold off on `STATE.md` and `DECISIONS.md`** until the project has status worth
   tracking or a real decision worth recording — a brand-new project has neither yet.
   Add them at that point, not as day-one ceremony.
10. If the workspace's `CLAUDE.md` keeps a table of projects, add a row for this one.

## Why the order matters

Steps 2 and 3 come before step 4 because reconstructing `.gitignore` categories after `git init`
is the harder order, and because a commit is permanent. Step 6 is the one that actually proves
the exclusions work: the evidence is that sensitive paths are absent from `git status`, not that
the file exists.

Step 9 holds off on `STATE.md` and `DECISIONS.md` deliberately. Add `HANDOVER.md` only when a
session actually ends mid-task — the `handover` skill writes it.
