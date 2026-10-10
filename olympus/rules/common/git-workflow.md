# Git workflow

## `.gitignore` before `git init`

Write the exclusions first, then initialise. Git only ignores a file it has not already been
told to track, so the order is not stylistic: getting it wrong means a file is in the history
and removing it later is a rewrite, not a delete.

> Scar: one project held hundreds of megabytes of documents and files holding other people's
> personal data. The `.gitignore` was written first, deliberately, before the repo
> existed.

## Categorise every exclusion by reason

Never lump exclusions under one vague "data" comment. A future reader needs to know **why**
something is excluded to judge whether the reason still holds:

| Reason | Example | Still excluded if? |
|---|---|---|
| Privacy | A ledger, a spreadsheet of real account balances | Always |
| Size or binary bloat | Hundreds of MB of public PDFs, model weights | Only while large |
| Build output | A generated static export, a review bundle | Always, but harmless if leaked |

The middle row is the one that gets confused with the first. Public PDFs are
excluded because they are enormous, not because they are secret, and writing that down stops
someone treating them as a privacy incident later.

## Verify the exclusion, do not trust the file

After `git init`, run `git status` **before** the first `git add` and confirm the sensitive
paths do not appear as untracked. The proof an exclusion works is what git reports, not what
the rule says.

Then check again after staging: `git status` after a broad `git add` is the last cheap moment
before a commit becomes permanent.

## Never assume a data folder is safe

The absence of a `.env` proves nothing. Look at what is actually in the folder. Personal data
rarely announces itself with an obvious filename.

## Commit messages say why

The diff already says what changed. The message carries the reasoning that will not survive in
anyone's memory: what problem this solves, what was rejected, what it is safe to assume.

## One repository per project

A repository at a parent folder sweeps in unrelated work. Each project under this workspace
gets its own, or deliberately gets none (a folder of notes rather
than code can be intentionally untracked).

## Destructive commands need a `git status` first

Before `checkout`, `restore`, `reset`, `clean`, or an `rm -rf` inside a repository: check what
is uncommitted, and stash or commit it. Losing work to a command meant to tidy up is a
self-inflicted wound.
