"""SessionStart hook: point a fresh session at a recent handover, without pasting it.

Prints a pointer (a couple of lines), never the file. The whole purpose of the
handover protocol is that a new session starts cheap; re-injecting 500 lines of
handover would undo that. Silent when there is nothing recent to point at.

Fails open: any error exits 0 with empty stdout.
"""
import os
import sys
import time

MAX_AGE_DAYS = 7
MAX_SHOWN = 3


def candidates(cwd):
    """HANDOVER.md in the working directory only — never in subdirectories.

    An earlier version also scanned immediate subdirectories, on the theory that
    sessions start either inside a project or at the workspace root above it. That
    was wrong: it meant every unrelated chat opened at the workspace root was told
    to go read some other project's handover. A handover is only relevant when you
    are actually in that project, so relevance is decided by cwd and nothing else.

    Projects whose CLAUDE.md points at their own HANDOVER.md cover the other case,
    since that file loads once Claude touches a file in the project.
    """
    here = os.path.join(cwd, "HANDOVER.md")
    return [here] if os.path.isfile(here) else []


def describe(path, now):
    age_days = (now - os.path.getmtime(path)) / 86400.0
    if age_days > MAX_AGE_DAYS:
        return None
    if age_days < 1:
        when = "today"
    elif age_days < 2:
        when = "yesterday"
    else:
        when = "{} days ago".format(int(age_days))
    return age_days, "{}  (written {})".format(path, when)


def main():
    payload = {}
    raw = sys.stdin.read()
    if raw.strip():
        import json
        payload = json.loads(raw)
    cwd = payload.get("cwd") or os.getcwd()
    now = time.time()

    rows = [d for d in (describe(p, now) for p in candidates(cwd)) if d]
    if not rows:
        return
    rows.sort(key=lambda r: r[0])
    lines = ["A handover from a previous session is waiting. Read it before doing anything else:"]
    lines += ["  " + text for _, text in rows[:MAX_SHOWN]]
    sys.stdout.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
