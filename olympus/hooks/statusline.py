"""Status line: folder, git branch, model, and how full the context window is.

Claude Code runs this after each assistant message and prints whatever it writes to stdout.
It is not a plugin hook (a plugin cannot set the status line); ~/.claude/settings.json runs it
by its path through the ~/.claude/skills/olympus junction, so it lives under git here and
cannot be lost the way the previous statusline.py was.

Input fields are from https://code.claude.com/docs/en/statusline. The context colours use the
context warnings' own thresholds, read by context_budget.load_config, so the two cannot drift.
Claude Code's percentage is of the session's real window, while the warnings divide by the
configured window_tokens, so the two agree only when those windows match.

Fails open, always: any error still prints a line and exits 0, because Claude Code shows
nothing at all after a non-zero exit. Unknown is shown as unknown: "ctx ?" for a percentage
it cannot read, and "Claude (status line error)" when the line itself could not be built.
"""
import json
import os
import subprocess
import sys

try:
    from context_budget import load_config
except Exception:  # a broken sibling must not take the status line down with it
    def load_config():
        return {"notice_at": 0.50, "warn_at": 0.75, "handover_at": 0.90}

YELLOW, RED, BOLD_RED, RESET = "\033[33m", "\033[31m", "\033[1;31m", "\033[0m"


def branch(folder):
    """The branch name, "detached HEAD", or "" when there is no repository to ask."""
    try:
        out = subprocess.run(
            ["git", "-C", folder, "branch", "--show-current"],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=2,
        )
    except Exception:
        return ""
    if out.returncode != 0:
        return ""
    return out.stdout.strip() or "detached HEAD"


def context(pct):
    try:
        pct = float(pct)
        text = f"ctx {round(pct)}%"  # round() rejects NaN and infinity, so they land here too
    except (TypeError, ValueError, OverflowError):
        return "ctx ?"
    cfg = load_config()
    if pct >= cfg["handover_at"] * 100:
        return BOLD_RED + text + RESET
    if pct >= cfg["warn_at"] * 100:
        return RED + text + RESET
    if pct >= cfg["notice_at"] * 100:
        return YELLOW + text + RESET
    return text


def line(data):
    folder = (data.get("workspace") or {}).get("current_dir") or data.get("cwd") or ""
    parts = [
        os.path.basename(folder.rstrip("/\\")),
        branch(folder) if folder else "",
        (data.get("model") or {}).get("display_name", ""),
        context((data.get("context_window") or {}).get("used_percentage")),
    ]
    return " · ".join(p for p in parts if p)


def main():
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    try:
        print(line(json.load(sys.stdin)))
    except Exception:
        print("Claude (status line error)")


if __name__ == "__main__":
    main()
