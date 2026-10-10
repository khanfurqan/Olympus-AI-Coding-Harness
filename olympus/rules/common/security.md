# Security

Scoped to what a personal project genuinely faces: a local app, real personal data, files from
the internet, and a repository that may one day be public.

## Secrets never enter source

No API keys, tokens, passwords, or connection strings in tracked files, including tests,
fixtures, and comments. They live in environment variables or a gitignored file.

A secret committed once is compromised even after it is deleted, because history keeps it.
Rotate it rather than quietly removing the line.

## Untrusted text never becomes a path

A filename from a user, an upload, or a URL is **text**, not a path. `../../secrets.json` is a
valid filename. Generate the on-disk name yourself, keep the original as metadata for display,
and take the extension from an allowlist rather than from the string.

> Scar: a `_safe_filename` helper was patched twice, once for `..` and once for leading dots,
> which is the argument for the string ceasing to be a path at all rather than a third patch.

## Escape for the context you are entering, not generically

HTML-escaping a value that lands inside a JavaScript string does not protect it: an escaped
quote can still terminate the JS literal. Each destination (HTML body, HTML attribute, JS
string, SQL, shell) has its own escaping, and using the wrong one feels safe while being
useless.

Never build a query by string concatenation. Parameterise.

## Check what a file is, not what it claims

Content type, magic bytes, and size are checked before a downloaded or uploaded file is
parsed. An HTML error page saved as `.pdf` is a silent poison; a 2 GB upload is a
denial-of-service against your own disk.

## Personal data does not leave the machine without a decision

Before anything is sent to an external service, published, or committed: is there personal or
financial data in it? This applies to review bundles, static exports, screenshots, and pasted
error messages, not only to the obvious files.

Where a tool must send something outward, prefer sending the **public** part. A published
document can go to a hosted service; a record of your own accounts cannot.

## Treat agent configuration as executable

Hooks run shell commands. MCP servers can hold credentials. Skills and project instructions
enter a model's context and influence what it does. All three are code, and installing them
from an unvetted source is running that source's code on your machine.

Judge by provenance, not by the README's claims. See `dependencies.md`.

## Before making a repository public

A checklist, because the failure is irreversible:

1. Real names, usernames, and machine paths, in tracked files **and in history**.
2. What `.gitignore` excludes now versus what it excluded at the first commit.
3. Any file that was renamed into or out of an ignored folder.
4. Screenshots and example data committed as documentation.
5. **Commit metadata**: author and committer email, on every commit that will be pushed.

Automate this as a test that runs in the ordinary suite, not as a script somebody remembers to
run on the day. The failure being guarded against is slow: a name reintroduced in a fixture
months before anyone publishes.

## A file scanner does not see everything a repository publishes

Item 5 above is separated out because it defeats the obvious design. A privacy gate that reads
tracked files is scanning **files**, and git publishes more than files: author and committer
identity, dates, branch and tag names, and commit messages all travel and none of them is in
any file the scanner can open.

The general form, worth applying beyond git: **name what the medium carries, then check that
each carrier is covered.** A scanner scoped to one carrier is a scanner with holes shaped like
the carriers it does not read.

> Scar: a pre-flight gate with four passing checks published a personal email address in commit
> metadata, which was outside everything it could see. The same tool had already grown two holes
> of the identical shape, one from filtering by file extension and one from reading contents but
> never filenames.

## A check that must be edited to be relaxed beats a heuristic that can be wrong quietly

Where a gate decides whether something is acceptable, prefer an explicit rule that fails closed
on anything unlisted, over a rule that tries to infer intent.

"Does this email address look personal" is undecidable and fails silently when it guesses wrong.
"Does this address end with the organisation's noreply domain" is decidable, and publishing under
a different address then requires editing the check, which appears in a diff and gets noticed. The
inflexibility is the feature: it converts a forgettable judgement into a visible change.

Unset must fail rather than pass. A missing value is not an acceptable one.

## A backup of the thing you are removing is a copy of the exposure

Two rules, and the second is the one people miss:

- **An untested backup is not a backup.** Restore it somewhere scratch and confirm the counts
  before running anything destructive.
- **Then remember where it is.** A bundle taken before scrubbing personal data contains that
  data in full, usually somewhere convenient like a desktop. Delete it once the operation is
  confirmed, or it quietly becomes the leak the operation was meant to prevent.

## Deleting and recreating a repository is not equivalent to force-pushing

Both are used to remove something from a remote, and they fail differently.

A **force-push** leaves the old commits on the host, unreferenced but retrievable by exact SHA
until the host garbage-collects, on no guaranteed timetable. For removing something that must
genuinely be gone, that is not removal.

**Deleting and recreating** does remove it, and costs something a force-push does not: anything
bound to the repository's **identity** rather than its contents is destroyed. A recreated
repository gets a new numeric ID even under the same name. That breaks integration installations
and their deploys, webhooks, deploy keys, and any saved reference to a commit SHA, including SHAs
written into the project's own documentation.

Before choosing it, enumerate what is bound to the repository rather than stored in it.
