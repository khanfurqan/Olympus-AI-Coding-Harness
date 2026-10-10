"""UserPromptSubmit hook: warn when a session has grown expensive, and name a safe
moment to hand over.

No hook receives token counts directly, but every hook receives transcript_path.
The last assistant `usage` record in that transcript gives the live context size:
    input_tokens + cache_read_input_tokens + cache_creation_input_tokens

Cost per step is roughly 0.1 x context (cache reads dominate), so the ratio of
current context to a fresh session's context IS the cost multiple.

Knowing you are at 75% is not enough to act on: handing over mid-edit loses work.
So above the first threshold this also reads the git working tree, which is the
cheapest objective signal of whether a stopping point is safe. A clean tree means
nothing is half-applied; a dirty one means finish that first.

Fails open, always: any error exits 0 with empty stdout. A broken hook must never
cost a session.
"""
import json
import os
import subprocess
import sys

CONFIG = os.path.join(os.path.expanduser("~"), ".claude", "context-budget.json")
DEFAULTS = {
    "window_tokens": 1000000,
    "fresh_context_tokens": 50000,
    "notice_at": 0.50,
    "warn_at": 0.75,
    "handover_at": 0.90,
}
TAIL_BYTES = 262144  # read only the end of the transcript; these files reach 8MB+
GIT_TIMEOUT = 5


def human(n):
    if n >= 1000000:
        return "{:.1f}M".format(n / 1000000.0)
    return "{:d}k".format(int(round(n / 1000.0)))


def load_config():
    cfg = dict(DEFAULTS)
    try:
        with open(CONFIG, "r", encoding="utf-8") as fh:
            loaded = json.load(fh)
        if isinstance(loaded, dict):
            for key, val in loaded.items():
                if key in cfg and isinstance(val, (int, float)) and val > 0:
                    cfg[key] = val
    except Exception:
        pass
    return cfg


def last_context_size(path):
    """Context tokens from the most recent assistant message, or None."""
    size = os.path.getsize(path)
    with open(path, "rb") as fh:
        if size > TAIL_BYTES:
            fh.seek(size - TAIL_BYTES)
            fh.readline()  # discard the partial line we landed in
        chunk = fh.read()
    for raw in reversed(chunk.decode("utf-8", "replace").splitlines()):
        raw = raw.strip()
        if not raw or '"usage"' not in raw:
            continue
        try:
            rec = json.loads(raw)
        except Exception:
            continue
        if rec.get("type") != "assistant":
            continue
        usage = (rec.get("message") or {}).get("usage") or {}
        total = (usage.get("input_tokens", 0)
                 + usage.get("cache_read_input_tokens", 0)
                 + usage.get("cache_creation_input_tokens", 0))
        if total > 0:
            return total
    return None


def stop_point(cwd):
    """Is this a safe moment to stop? Returns a sentence, or None if unknowable.

    Only the git working tree is consulted. It is objective, costs ~50ms, and
    answers the one question that matters: is anything half-applied right now.
    """
    if not cwd or not os.path.isdir(cwd):
        return None
    try:
        proc = subprocess.run(
            ["git", "-C", cwd, "status", "--porcelain"],
            capture_output=True, text=True, timeout=GIT_TIMEOUT,
        )
    except Exception:
        return None
    if proc.returncode != 0:
        return None  # not a repository; no signal either way

    tracked, untracked = 0, 0
    for line in proc.stdout.splitlines():
        if line.startswith("??"):
            untracked += 1
        elif line.strip():
            tracked += 1

    if tracked:
        return ("Not a clean moment yet: {} tracked file{} uncommitted. Finish or commit that "
                "work first \u2014 handing over mid-edit is how the next session loses it."
                .format(tracked, "" if tracked == 1 else "s"))
    if untracked:
        return ("Clean moment to hand over: nothing modified, though {} untracked file{} "
                "would not survive a commit-based handover.".format(untracked, "" if untracked == 1 else "s"))
    return "Clean moment to hand over: working tree clean, nothing half-applied."


def build_message(ctx, cfg, cwd=None):
    window = cfg["window_tokens"]
    frac = ctx / float(window)
    if frac < cfg["notice_at"]:
        return None, None
    multiple = max(1, int(round(ctx / float(cfg["fresh_context_tokens"]))))
    head = "Context {} of {} ({}%). Each step here costs about {}x what it would in a fresh session.".format(
        human(ctx), human(window), int(frac * 100), multiple)

    if frac >= cfg["handover_at"]:
        tail = (" HANDOVER DUE. Do not start new work in this session and do not open a new thread of "
                "investigation. Finish or park what is already in flight, then run the `handover` skill "
                "to write HANDOVER.md, and tell the user to start a new chat. If they ask for something new, "
                "say plainly that it belongs in the next session and why.")
        banner = "Handover due - context {} ({}%)".format(human(ctx), int(frac * 100))
    elif frac >= cfg["warn_at"]:
        tail = (" Handover is due at the next clean point: run the `handover` skill, then start a new chat. "
                "Do not begin anything substantial that will not finish in this session.")
        banner = "Handover due soon - context {} ({}%)".format(human(ctx), int(frac * 100))
    else:
        tail = (" Land the task in flight rather than opening a new one. If the user raises a different "
                "subject, say it is cheaper in a fresh chat.")
        banner = "Context {} ({}%)".format(human(ctx), int(frac * 100))

    signal = stop_point(cwd)
    if signal:
        tail += " " + signal
    tail += (" Name the handover moment out loud when it arrives \u2014 the task finishes, tests pass, "
             "nothing is half-applied \u2014 rather than waiting to be asked. Say it once, plainly, and "
             "say what the next session would pick up.")
    return head + tail, banner


def main():
    payload = json.loads(sys.stdin.read() or "{}")
    prompt = (payload.get("prompt") or "").strip().lower()
    if prompt.startswith("/handover") or prompt.startswith("/clear"):
        return
    path = payload.get("transcript_path")
    if not path or not os.path.isfile(path):
        return
    ctx = last_context_size(path)
    if not ctx:
        return
    cfg = load_config()
    message, banner = build_message(ctx, cfg, payload.get("cwd"))
    if not message:
        return
    json.dump({
        "systemMessage": banner,
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": "[session budget] " + message,
        },
    }, sys.stdout)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
