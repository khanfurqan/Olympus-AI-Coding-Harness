"""Stop hook ("done gate"): before a turn ends, check that changed code was reviewed.

Zeus asks for one review per finished change. A written rule can be skipped, so this
checks facts instead of trusting a promise. A changed code file counts as reviewed
only when the evidence file the review writes, <scratchpad>/evidence/review-diff.txt,
names it and is newer than it. A deleted file has no time, so being named is enough.
Otherwise it sends the model back once with one line: review, or say why not.

- Markdown files are ignored: Zeus skips review for documentation-only changes.
- It never blocks twice in a row: Claude Code sets stop_hook_active on the stop that
  follows a block, and this hook then lets the turn end.
- scratchpad_dir arrives in the input from Claude Code v2.1.257. On older versions it
  is worked out from transcript_path and session_id, which follow the same layout:
  ~/.claude/projects/<slug>/<session>.jsonl  ->  <temp>/claude/<slug>/<session>/scratchpad

Fails open, always: any error exits 0 with empty stdout. A broken hook must never
cost a session.

Registered in hooks.json as the "Stop" hook (commit 952a351).
"""
import json
import os
import subprocess
import sys
import tempfile

GIT_TIMEOUT = 5
REASON = ("Code changed since the last review. Run the review, or say in one line "
          "why this change needs none.")


def scratchpad(data):
    if data.get("scratchpad_dir"):
        return data["scratchpad_dir"]
    transcript = data.get("transcript_path")
    session = data.get("session_id")
    if not transcript or not session:
        return None
    slug = os.path.basename(os.path.dirname(transcript))
    return os.path.join(tempfile.gettempdir(), "claude", slug, session, "scratchpad")


def changed_code_files(cwd):
    """Repo-relative paths of changed, added or deleted files that are not Markdown."""
    out = subprocess.run(
        ["git", "-C", cwd, "status", "--porcelain", "--untracked-files=all", "-z"],
        capture_output=True, encoding="utf-8", timeout=GIT_TIMEOUT)
    if out.returncode != 0:
        return []
    entries = out.stdout.split("\0")
    paths = []
    i = 0
    while i < len(entries):
        entry = entries[i]
        i += 1
        if len(entry) < 4:
            continue
        status, path = entry[:2], entry[3:]
        if "R" in status or "C" in status:
            i += 1  # the next entry is the old name of a rename or copy
        if not path.lower().endswith(".md"):
            paths.append(path)
    return paths


def git_quoted(path):
    """How `git status --short` and `git diff` print a path with non-ASCII letters."""
    return "".join(c if ord(c) < 128 else "".join("\\%03o" % b for b in c.encode("utf-8"))
                   for c in path)


def reviewed(cwd, path, text, reviewed_at):
    if path not in text and git_quoted(path) not in text:
        return False
    full = os.path.join(cwd, path)
    return not os.path.exists(full) or os.path.getmtime(full) <= reviewed_at


def main():
    data = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    if data.get("stop_hook_active"):
        return
    cwd = data["cwd"]
    changed = changed_code_files(cwd)
    if not changed:
        return
    pad = scratchpad(data)
    if not pad:
        return
    evidence = os.path.join(pad, "evidence", "review-diff.txt")
    if os.path.exists(evidence):
        reviewed_at = os.path.getmtime(evidence)
        with open(evidence, encoding="utf-8", errors="replace") as fh:
            text = fh.read()
        if all(reviewed(cwd, p, text, reviewed_at) for p in changed):
            return
    print(json.dumps({"decision": "block", "reason": REASON}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
