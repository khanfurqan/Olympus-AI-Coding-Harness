"""Build the public copy of Olympus, then refuse to bless it if anything private
got in.

Why this exists. Olympus is developed in a private folder whose records name
other projects, a machine and a person. The public repository is never that
folder: it starts with a fresh history, built from this script's output alone,
and publishing cannot be undone. A gate written in prose cannot run, so
afterwards "I checked" looks the same as "I never checked". This file makes the
check something that exits 0 or exits 1.

Adapted from the release gate of an earlier project (2026-09-25), whose two
design choices are kept:

  * **The audit reads the OUTPUT FOLDER, not the list of what was copied.** A
    file that arrived by any route at all is caught.
  * **Everything unknown is a problem.** An unreadable file is an unscanned one,
    and an empty list or word list is never a clean build of nothing.

Differences, each forced by what Olympus is:

  * **The plugin folder ships as every file git tracks in it**, not a list of
    names: it holds over 700 files, and a hand-written list that long is one
    nobody reviews. The root files are still named one by one, in ROOT_FILES,
    and a tracked root file that is neither shipped nor known to be private
    refuses the build, so nothing is dropped without a decision.
  * **Only committed work ships.** Any uncommitted or staged change to a file
    that ships refuses the build, so the public copy always matches a commit.
  * **Private words match whole words, however the text is laid out.** Third-party
    code is full of `clickHandler`, which a substring search for a short name
    would flag. A phrase still matches across a line break, double space,
    hyphen or markdown marker. The cost, accepted: a private word glued inside a
    longer one (`NameOS`) is not found.
  * **Names are searched as well as contents**, because a path is published too.
  * **Only UTF-8 text ships.** A file in any other encoding, an image or an archive
    cannot be fully searched, so it is refused rather than half-checked.
  * **A file that MENTIONS CLAUDE.md or DECISIONS.md is fine.** Olympus's skills
    write those files for their user, so naming them is the product. Only a file
    with such a NAME is refused.
  * **One file is swapped.** `olympus/ZEUS.md` is the maintainer's own; the
    public copy gets the neutral template from `release/ZEUS.md` instead.

Usage:
    python build_release.py <destination folder>
    python build_release.py --check <existing folder>   # audit only, no copy

Exits 0 only when the folder is built and clean. `test_release.py` proves each
refusal. Review, 2026-10-10: apollo, artemis and ares found the phrase, name,
encoding, path-shape, exemption, uncommitted-work and root-file gaps closed here.
"""
import pathlib
import re
import shutil
import subprocess
import sys

# The plugin, which ships as every file git tracks inside it.
PLUGIN_DIR = "olympus"

# Everything else that ships, named one by one. `.gitattributes` keeps the
# workflow scripts' line endings, which the Workflow tool requires.
ROOT_FILES = [
    "README.md",
    "LICENSE",
    "USER_GUIDE.md",
    "SECURITY.md",
    "THIRD_PARTY_NOTICES.md",
    ".gitignore",
    ".gitattributes",
    "build_release.py",
    "test_release.py",
    "tests/review.logic.test.mjs",
    # The User Guide's three diagrams, as images GitHub can show, and their sources
    "tools/diagrams/olympus-system.svg",
    "tools/diagrams/olympus-capabilities.svg",
    "tools/diagrams/olympus-agentic.svg",
    "tools/diagrams/system-architecture.json",
    "tools/diagrams/capability-map.json",
    "tools/diagrams/agentic-system.json",
]

# Published path -> the source file copied there instead of the original.
REPLACEMENTS = {"olympus/ZEUS.md": "release/ZEUS.md"}

# The private documents, by name, at any depth. Matched without regard to case,
# because Windows treats `decisions.MD` as the same file (measured on the earlier
# project, 2026-09-25). A prohibition is safer wide; an exemption is safer narrow.
FORBIDDEN_NAMES = [
    "CLAUDE.md", "STATE.md", "DECISIONS.md", "HANDOVER.md", "LEARNING.md",
    "LEDGER.md", "SKILL-ACCESS.md", "GUIDE.md",
]
FORBIDDEN_DIRS = ["archive", "review", "evaluations", "graphs", ".archify"]

# The words that would identify the author live here, beside this script. Never
# in this file, which is published: spelling them out to search for them would
# publish them (the earlier project's review, 2026-09-26). .gitignore keeps it
# out of git and the audit refuses it by name. One entry a line: "name: <the
# author's name>" once, and "word: <other>" for each of the rest; "#" starts a
# comment line, and a "#" anywhere else refuses.
PRIVATE_WORDS_FILE = "release-private-words.txt"
_FORBIDDEN_NAMES_LOWER = {n.lower() for n in FORBIDDEN_NAMES} | {PRIVATE_WORDS_FILE.lower()}
_FORBIDDEN_DIRS_LOWER = {n.lower() for n in FORBIDDEN_DIRS}
NAME_WORD = None
PRIVATE_WORDS = []
# The list must hold exactly this many different words, so deleting one by
# accident stops the build, and so does adding one without raising this. A floor
# alone let a lost block of words pass (step 6 review, 2026-10-10).
MIN_PRIVATE_WORDS = 24

# The author's name belongs only in these files, matched on the full path: a
# LICENSE inside a skill folder belongs to that skill's author, not this one.
NAME_ALLOWED_IN = ["LICENSE", "README.md"]

EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
# A home folder in every spelling a file gives it: Windows with one backslash,
# two (escaped, as in JSON or source strings) or a forward slash; macOS; Linux.
_SEP = r"(?:\\{1,2}|/)"
HOME_PATH = re.compile(
    r"[A-Za-z]:" + _SEP + r"[Uu]sers" + _SEP + r"[A-Za-z0-9_.-]+"
    r"|/[Uu]sers/[A-Za-z0-9_.-]+"
    r"|/home/[A-Za-z0-9_.-]+"
)
# The shapes of common credentials. A key pasted into a hook or a config file
# would otherwise pass every other check.
CREDENTIAL = re.compile(
    r"ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}"
    r"|AKIA[0-9A-Z]{16}|xox[abpr]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY"
)

# Domains reserved for examples and tests (RFC 2606 and 6761), plus `.internal`,
# reserved for private networks by ICANN in 2024, which can never be anyone's
# public address. Third-party test suites use them constantly.
RESERVED_EMAIL_DOMAIN = re.compile(
    r"@(?:[a-z0-9-]+\.)*(?:example\.(?:com|net|org)|example|test|invalid|internal)$")

# Single strings in third-party files that look private and are not, each read
# and judged by hand. Exact text, in exactly one file: the same text anywhere
# else is still refused, and so is anything else in the same file. This file
# may hold every string listed here, because this is where they are listed.
KNOWN_SAFE = {
    # Shared addresses for cloning over SSH, which belong to no person, and fake
    # credentials inside test URLs, named as fakes.
    ("olympus/skills/archify/test/architecture-delta.test.mjs", "git@github.com"),
    ("olympus/skills/archify/test/brand-marks.test.mjs", "secret@github.com"),
    ("olympus/skills/archify/test/repository-evidence-types.test.mjs", "git@github.com"),
    ("olympus/skills/archify/test/repository-evidence-types.test.mjs", "git@gitee.com"),
    ("olympus/skills/archify/test/repository-evidence.test.mjs", "git@github.com"),
    ("olympus/skills/archify/test/repository-evidence.test.mjs", "git@gitee.com"),
    ("olympus/skills/archify/test/repository-evidence.test.mjs", "synthetic_token@gitee.com"),
    ("olympus/skills/archify/test/repository-evidence.test.mjs", "not-a-real-token@github.com"),
    ("olympus/skills/archify/test/repository-evidence.test.mjs", "fake_secret@github.com"),
    ("olympus/skills/archify/test/repository-evidence.test.mjs", "validate_secret@github.com"),
    ("olympus/skills/archify/test/repository-evidence.test.mjs", "preview_secret@github.com"),
    # Documentation and test examples of path handling, not anyone's folder.
    ("olympus/skills/graphify/exporters/html.py", "/Users/..."),
    ("olympus/skills/graphify/exporters/html.py", "C:/Users/.."),
    ("olympus/skills/graphify/paths.py", "C:/Users/u"),
    ("olympus/skills/graphify/paths.py", "/home/ci"),
    ("olympus/skills/graphify/paths.py", r"C:\\Users\\me"),
    ("olympus/skills/graphify/install.py", r"C:\\Users\\me"),
    ("olympus/skills/graphify/hooks.py", r"C:\\Users\\..."),
    ("olympus/skills/graphify/hooks.py", r"C:\\Users\\First"),
    # A security note naming the kind of file an attacker would try to include.
    ("olympus/skills/graphify/extractors/fortran.py", "/home/victim"),
}
GATE_FILE = "build_release.py"

# Written into a release folder so a later rebuild knows the folder is one of
# ours and may be cleared.
MARKER = ".olympus-release"


def load_private_words(folder) -> list:
    """Read PRIVATE_WORDS_FILE from `folder` into NAME_WORD and PRIVATE_WORDS.
    Returns every problem with it; empty means loaded. A failed load clears any
    earlier one, so the audit can never run on a stale list."""
    global NAME_WORD, PRIVATE_WORDS
    NAME_WORD, PRIVATE_WORDS = None, []
    path = pathlib.Path(folder) / PRIVATE_WORDS_FILE
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"{PRIVATE_WORDS_FILE}: could not be read ({type(exc).__name__}), so "
                f"the author's name and other private words cannot be searched for. "
                f"It lives beside build_release.py and is never published"]
    names, words = [], []
    for number, line in enumerate(text.splitlines(), start=1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        kind, colon, value = line.partition(":")
        kind, value = kind.strip().lower(), value.strip().lower()
        if "#" in value:
            return [f"{PRIVATE_WORDS_FILE}: line {number} has a '#' after its entry; "
                    f"put notes on a line of their own"]
        if colon and value and kind == "name":
            names.append(value)
        elif colon and value and kind == "word":
            words.append(value)
        else:
            return [f"{PRIVATE_WORDS_FILE}: line {number} is neither 'name: ...' nor "
                    f"'word: ...', so what it holds would never be searched for"]
    if len(names) != 1:
        return [f"{PRIVATE_WORDS_FILE}: must name the author exactly once "
                f"('name: ...'); found {len(names)}"]
    if len(set(words)) != MIN_PRIVATE_WORDS:
        return [f"{PRIVATE_WORDS_FILE}: holds {len(set(words))} different private "
                f"words; exactly {MIN_PRIVATE_WORDS} are expected. If you added or removed "
                f"one on purpose, change MIN_PRIVATE_WORDS to match"]
    NAME_WORD, PRIVATE_WORDS = names[0], words
    return []


# An escape for one character, in the common spellings a text file gives it. A
# backslash and any one letter or digit (\n, \t, \b, \0) is one rule, not a list:
# a list left \b open (step 6, 2026-10-10). Longer forms are NOT covered: octal
# \012, \U0001f600, \u{a}. Each would be another entry; DECISIONS.md records why
# they are an accepted limit. The text is lowercased first, so hex needs only a-f.
_ESCAPE = r"(?:\\[a-z0-9]|\\x[0-9a-f]{2}|\\u[0-9a-f]{4}|%[0-9a-f]{2})"
# Python needs each look-behind a fixed width, so one per spelling.
_ESCAPED_START = (r"(?:(?<![a-z0-9])|(?<=\\[a-z0-9])|(?<=\\x[0-9a-f]{2})"
                  r"|(?<=\\u[0-9a-f]{4})|(?<=%[0-9a-f]{2}))")


def _whole_word(word: str) -> re.Pattern:
    """`word` with no letter or digit either side, so for "ann", "ann's" matches
    and "annual" does not. The parts of a phrase may be separated by any run of
    spaces, line breaks, hyphens, underscores or markdown markers, so a phrase
    wrapped across a line is still found. An escaped character in source, JSON
    or a web address (\\n, \\u000a, \\x0a, %20) counts as a space, not as the
    letter or digit it ends in."""
    parts = [re.escape(p) for p in re.split(r"[\s_-]+", word.strip()) if p]
    separator = r"(?:[\s>*_`#-]|" + _ESCAPE + r")+"
    return re.compile(_ESCAPED_START + separator.join(parts) + r"(?![a-z0-9])")


def _git(source, *args) -> str:
    return subprocess.run(["git", "-C", str(source), *args],
                          capture_output=True, check=True).stdout.decode("utf-8")


def tracked_files(source) -> list:
    """Every file git tracks under PLUGIN_DIR in `source`, as forward-slash paths.
    Raises if git fails, rather than returning a short list."""
    return sorted(p for p in _git(source, "ls-files", "-z", "--", PLUGIN_DIR).split("\0") if p)


def git_problems(source) -> list:
    """What git says is wrong with shipping from `source` now: uncommitted or
    staged changes to anything that ships, and tracked root files nobody has
    decided about. Raises if git fails."""
    problems = []
    shipped = [PLUGIN_DIR, *ROOT_FILES, *REPLACEMENTS.values()]
    for line in _git(source, "status", "--porcelain", "--", *shipped).splitlines():
        problems.append(f"{line[3:]}: has changes that are not committed, so the public "
                        f"copy would not match any commit. Commit or discard them first")
    # status never lists a file that is ignored and untracked, so check tracking too.
    roots = [*ROOT_FILES, *REPLACEMENTS.values()]
    tracked = set(_git(source, "ls-files", "-z", "--", *roots).split("\0"))
    for name in roots:
        if name not in tracked:
            problems.append(f"{name}: ships but is not tracked by git, so the public copy "
                            f"would not match any commit. Add and commit it, or check .gitignore")
    decided = {n.lower() for n in ROOT_FILES} | _FORBIDDEN_NAMES_LOWER
    for name in _git(source, "ls-files", "-z").split("\0"):
        if name and "/" not in name and name.lower() not in decided:
            problems.append(f"{name}: is tracked at the top level but is neither in "
                            f"ROOT_FILES nor a known private document. Decide which")
    return problems


def audit(folder) -> list:
    """Every problem found in `folder`, as a list of sentences. Empty means clean."""
    problems = []
    folder = pathlib.Path(folder)

    if not NAME_WORD or not PRIVATE_WORDS:
        return [f"the private word list ({PRIVATE_WORDS_FILE}) is not loaded, so the "
                f"author's name and other private words were never searched for"]
    if not folder.is_dir():
        return [f"{folder}: is not a folder, so nothing could be audited"]

    for rel in ROOT_FILES + list(REPLACEMENTS):
        if not (folder / rel).is_file():
            problems.append(f"{rel}: missing from {folder}, so the release is incomplete")

    for path in sorted(folder.rglob("*")):
        rel = path.relative_to(folder)
        if path.name.lower() in _FORBIDDEN_NAMES_LOWER:
            problems.append(f"{rel}: {path.name} is a private document and must not be published")
            continue
        problems.extend(_scan_name(path.name, rel))
        if path.is_dir():
            if path.name.lower() in _FORBIDDEN_DIRS_LOWER:
                problems.append(f"{rel}: {path.name}/ is a private directory and must not be published")
            continue
        if any(part.lower() in _FORBIDDEN_DIRS_LOWER for part in rel.parts[:-1]):
            problems.append(f"{rel}: sits inside a private directory")
            continue
        problems.extend(_scan_file(path, rel))
    return problems


def _scan_name(name: str, rel: pathlib.Path) -> list:
    """Private words and the author's name in one file or folder name."""
    lowered = name.lower()
    found = [f"{rel}: its name contains {word!r}" for word in PRIVATE_WORDS
             if _whole_word(word).search(lowered)]
    if _whole_word(NAME_WORD).search(lowered):
        found.append(f"{rel}: its name contains the author's name")
    return found


def _scan_file(path: pathlib.Path, rel: pathlib.Path) -> list:
    """What is wrong inside one file. A file that cannot be read, or cannot be
    read as UTF-8 text, is reported, never skipped."""
    try:
        raw = path.read_bytes()
    except OSError as exc:
        return [f"{rel}: could not be read ({type(exc).__name__}), so it was never scanned"]
    try:
        original = raw.decode("utf-8")
    except UnicodeDecodeError:
        return [f"{rel}: is not UTF-8 text, so it cannot be fully searched. Only UTF-8 "
                f"text ships; convert it or leave it out"]

    found = []
    text = original.lower()
    relp = rel.as_posix()
    for word in PRIVATE_WORDS:
        if _whole_word(word).search(text):
            found.append(f"{rel}: contains {word!r}")
    if _whole_word(NAME_WORD).search(text) and relp not in NAME_ALLOWED_IN:
        found.append(f"{rel}: contains the author's name, which belongs only in "
                     f"{' or '.join(NAME_ALLOWED_IN)} at the top level")

    safe = {s for f, s in KNOWN_SAFE if f == relp or relp == GATE_FILE}
    # Every match is judged, not only the first, so an exempt one cannot hide a
    # real one later in the same file.
    for match in EMAIL.finditer(text):
        address = match.group()
        if not RESERVED_EMAIL_DOMAIN.search(address) and address not in safe:
            found.append(f"{rel}: contains an email address ({address!r})")
            break
    for match in HOME_PATH.finditer(original):
        if match.group() not in safe:
            found.append(f"{rel}: contains a home-directory path ({match.group()!r})")
            break
    match = CREDENTIAL.search(original)
    if match:
        found.append(f"{rel}: contains something shaped like a credential "
                     f"({match.group()[:8]}...)")
    return found


def _check_destination(source: pathlib.Path, dest: pathlib.Path):
    """`(resolved_dest, None)` when it is safe to build there, else `(None, why)`.
    Called before anything is deleted, and returns the resolved path so `build`
    deletes the same object this function judged. Carried from the earlier
    project's gate, where a mistyped destination once deleted a project's
    contents including `.git`."""
    try:
        source = source.resolve()
        dest = dest.resolve()
    except OSError as exc:
        return None, (f"the destination path could not be worked out "
                      f"({type(exc).__name__}), so it is not safe to write to")
    if dest == source or dest in source.parents:
        return None, f"{dest} is the project itself, or a folder containing it"
    if dest == pathlib.Path.cwd().resolve():
        return None, f"{dest} is the folder you are standing in"
    if dest == pathlib.Path.home().resolve():
        return None, f"{dest} is your home directory"
    if dest.parent == dest:
        return None, f"{dest} is a drive root"
    if dest.exists():
        if not dest.is_dir():
            return None, f"{dest} already exists and is not a folder"
        if (dest / ".git").exists():
            # The public repository is this folder after its first commit, so it
            # will hold a .git and the marker. A repository is never build output.
            return None, (f"{dest} holds a .git, so it is a repository rather than a "
                          f"build folder. Build somewhere else and copy the files in.")
        if any(dest.iterdir()) and not (dest / MARKER).exists():
            return None, (f"{dest} already holds files and has no {MARKER}, so it is "
                          f"not a previous release. Pass a new or empty folder.")
    return dest, None


def build(source, dest, plugin_files) -> list:
    """Copy the plugin files, the root files and the replacements from `source`
    into `dest`, then audit `dest`. Returns every problem; empty means ready."""
    source, dest = pathlib.Path(source), pathlib.Path(dest)
    if not plugin_files:
        return ["the plugin file list is empty, so there is nothing to publish and "
                "nothing to check: refusing rather than reporting a clean build"]

    dest, reason = _check_destination(source, dest)
    if reason:
        return [f"refusing to build: {reason}"]
    if dest.exists():
        doomed = sum(1 for _ in dest.rglob("*"))
        if doomed:
            print(f"  clearing a previous release at {dest} ({doomed} entries)")
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    (dest / MARKER).write_text(
        "Built by build_release.py. This folder is rebuilt from scratch each\n"
        "time, so nothing here should be edited by hand.\n", encoding="utf-8")

    problems = []
    copies = [(name, name) for name in list(plugin_files) + ROOT_FILES]
    copies += [(origin, target) for target, origin in REPLACEMENTS.items()]
    for origin_name, target_name in copies:
        origin, target = source / origin_name, dest / target_name
        if not origin.is_file():
            # A missing root file is reported once, by the audit. A missing
            # replacement is reported here, because the original it was meant
            # to replace is already in place and the audit would see a file.
            if origin_name not in ROOT_FILES:
                problems.append(f"{origin_name}: missing from {source}, so the release would be incomplete")
            continue
        if not target.resolve().is_relative_to(dest):
            problems.append(f"{target_name}: would be written outside {dest}")
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(origin, target)

    problems.extend(p for p in audit(dest) if p not in problems)
    return problems


def main(argv: list) -> int:
    here = pathlib.Path(__file__).resolve().parent
    if len(argv) == 2 and argv[0] == "--check":
        where = pathlib.Path(argv[1])
        print(f"Auditing {where}")
        problems = load_private_words(here) or audit(where)
    elif len(argv) == 1 and not argv[0].startswith("-"):
        where = pathlib.Path(argv[0])
        print(f"Building the public copy of {here}\n           into {where}")
        problems = load_private_words(here)
        if not problems:
            try:
                problems = git_problems(here)
                if not problems:
                    problems = build(here, where, tracked_files(here))
            except (OSError, subprocess.CalledProcessError, UnicodeDecodeError) as exc:
                problems = [f"git could not report on the project ({type(exc).__name__})"]
    else:
        print(__doc__.strip().split("Usage:")[1].split("Exits")[0].strip())
        return 2

    if problems:
        print(f"\n  REFUSED: {len(problems)} problem(s). Do not publish this folder.\n")
        for problem in problems:
            print(f"    - {problem}")
        return 1
    count = len(list(pathlib.Path(where).rglob("*")))
    print(f"\n  OK: {count} entries, nothing private found. Safe to publish.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
