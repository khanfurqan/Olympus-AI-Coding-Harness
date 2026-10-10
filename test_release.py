"""Does the publish gate actually stop private material reaching the public repository?

Olympus is published by building a clean copy into a separate folder, which then
gets a fresh history. Publishing cannot be undone, so the copy is audited after
it is built, and every check here is written as "does it REFUSE", because a gate
that cannot fail is not a gate. Modelled on an earlier project's gate.

The words that would identify the author live in a private, git-ignored file,
never in a published one. These tests use invented words in their place
("zorbo" as the author's name), so they run the same on any copy of the project.

This file is published and audited like any other, so the fake addresses and
paths it plants are assembled at run time: written out literally, they would be
exactly what the gate refuses.

Needs no network. Uses git for four tests.

Run:  python test_release.py
"""
import contextlib
import io
import pathlib
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_release

FAILURES = []

AT, BS, USERS = "@", "\\", "Us" + "ers"


def mail(local, domain):
    return local + AT + domain


def win(sep, name):
    return "C:" + sep + USERS + sep + name


def check(name, condition, detail=""):
    print(("  PASS  " if condition else "  FAIL  ") + name)
    if not condition:
        FAILURES.append(name)
        if detail:
            print(f"        {detail}")


# The gate expects exactly MIN_PRIVATE_WORDS words, so invented filler words make
# up the rest of the count.
_REAL = ["quillmere", "vantastic", "old project", "brindle", "skarn"]
_FILLER = [f"padword{n:02d}" for n in range(build_release.MIN_PRIVATE_WORDS - len(_REAL))]
WORDS = "name: zorbo\n" + "".join(f"word: {w}\n" for w in _REAL + _FILLER)


def make_project(root: pathlib.Path) -> list:
    """A fake source project: a plugin folder, the public ZEUS, the root files
    and a private word list. Returns the plugin files, as git would list them."""
    plugin = {
        "olympus/agents/helper.md": "A helper agent. It reads the user's code.\n",
        "olympus/skills/thing/SKILL.md": "Uses clickHandler and zorbohandler, which are fine.\n",
        "olympus/ZEUS.md": "Zorbo's own private Zeus.\n",
    }
    for rel, text in plugin.items():
        (root / rel).parent.mkdir(parents=True, exist_ok=True)
        (root / rel).write_text(text, encoding="utf-8")
    (root / "release").mkdir()
    (root / "release/ZEUS.md").write_text("The public Zeus template.\n", encoding="utf-8")
    for rel in build_release.ROOT_FILES:
        (root / rel).parent.mkdir(parents=True, exist_ok=True)
        text = {"LICENSE": "Copyright Zorbo\n", "README.md": "By Zorbo\n",
                ".gitignore": build_release.PRIVATE_WORDS_FILE + "\n"}.get(rel, f"{rel}\n")
        if not (root / rel).exists():
            (root / rel).write_text(text, encoding="utf-8")
    (root / build_release.PRIVATE_WORDS_FILE).write_text(WORDS, encoding="utf-8")
    return sorted(plugin)


def built(plant=None):
    """Build a fake project, optionally after `plant(root, files)` alters it.
    Returns (problems, out folder)."""
    tmp = pathlib.Path(tempfile.mkdtemp())
    root, out = tmp / "src", tmp / "out"
    root.mkdir()
    files = make_project(root)
    if plant:
        changed = plant(root, files)
        files = files if changed is None else changed
    words = build_release.load_private_words(root)
    if words:
        return words, out
    with contextlib.redirect_stdout(io.StringIO()):
        return build_release.build(root, out, files), out


def audited(rel, content):
    """Build clean, then write `content` at `rel` in the output and audit it."""
    problems, out = built()
    assert not problems, problems
    path = out / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(content, bytes):
        path.write_bytes(content)
    else:
        path.write_text(content, encoding="utf-8")
    return build_release.audit(out)


def names(problems, fragment):
    text = problems if isinstance(problems, str) else " ".join(problems)
    return fragment.lower() in text.lower()


def git_repo(path):
    """A git repository at `path` with a throwaway identity. Returns a runner."""
    git = ["git", "-C", str(path), "-c", "user.name=t", "-c", "user.email=" + mail("t", "t.invalid")]
    subprocess.run(git[:3] + ["init", "-q"], check=True)
    return lambda *args: subprocess.run(git + list(args), check=True, capture_output=True)


print("\nTest 1 - a clean project builds, with the public ZEUS in place")
problems, out = built()
check("the build reports no problems", problems == [], problems)
zeus = (out / "olympus/ZEUS.md")
check("olympus/ZEUS.md is the public template", zeus.is_file() and "public" in zeus.read_text(), zeus)
check("the private word list is not copied", not (out / build_release.PRIVATE_WORDS_FILE).exists())
check("the release/ folder itself is not copied", not (out / "release").exists())
check("every root file is copied", all((out / r).is_file() for r in build_release.ROOT_FILES))
check("the root file list is not empty", len(build_release.ROOT_FILES) > 0)
check(".gitattributes ships, so a clone keeps its line endings", ".gitattributes" in build_release.ROOT_FILES)

print("\nTest 2 - a private word in a plugin file is refused")
p = audited("olympus/rules/x.md", "Written for the Quillmere project.\n")
check("a private word is caught", names(p, "quillmere"), p)
p = audited("olympus/rules/x.md", "Lessons from the Old Project round.\n")
check("a two-word phrase is caught across case", names(p, "old project"), p)

print("\nTest 3 - whole words only")
p = audited("olympus/rules/x.md", "zorbohandler, skarnish and vantastical are other words.\n")
check("a private word inside a longer word is not flagged", p == [], p)
p = audited("olympus/rules/x.md", "Ask Zorbo's opinion.\n")
check("the name followed by an apostrophe is flagged", names(p, "name"), p)

print("\nTest 4 - the author's name belongs only in the root LICENSE and README.md")
problems, out = built()
check("allowed in root LICENSE and README.md", problems == [], problems)
p = audited("olympus/skills/x/LICENSE", "Copyright Zorbo\n")
check("refused in a LICENSE inside the plugin", names(p, "name"), p)
p = audited("olympus/agents/a.md", "Zorbo runs this.\n")
check("refused in an agent file", names(p, "name"), p)

print("\nTest 5 - email addresses and home-folder paths are refused")
p = audited("olympus/a.md", "Mail " + mail("someone", "mailhost.com") + "\n")
check("an email address is caught", names(p, "email"), p)
for path in [win(BS, "someone"), win("/", "someone"), "/" + USERS + "/someone",
             win(BS + BS, "someone"), "/" + USERS + "/Someone", "/ho" + "me/someone"]:
    p = audited("olympus/a.md", f"See {path}/x\n")
    check(f"home path {path!r} is caught", names(p, "home"), p)

print("\nTest 6 - private file names and folders are refused, whatever their case")
p = audited("olympus/skills/x/decisions.MD", "notes\n")
check("a private file name in odd case is caught", names(p, "private document"), p)
p = audited("olympus/review/x.md", "notes\n")
check("a private folder is caught", names(p, "private director"), p)
p = audited(build_release.PRIVATE_WORDS_FILE, "word: x\n")
check("the private word list itself is caught", names(p, "private document"), p)

print("\nTest 7 - silent shortfalls are refused")
def drop_root(root, files):
    (root / build_release.ROOT_FILES[0]).unlink()
p, _ = built(drop_root)
check("a missing root file is refused", names(p, "missing"), p)
p, _ = built(lambda root, files: [])
check("an empty plugin list is refused", names(p, "empty"), p)
def no_public_zeus(root, files):
    (root / "release/ZEUS.md").unlink()
p, _ = built(no_public_zeus)
check("a missing public ZEUS is refused", names(p, "zeus"), p)

print("\nTest 8 - the private word list must be present and sound")
def words_file(text):
    tmp = pathlib.Path(tempfile.mkdtemp())
    if text is not None:
        (tmp / build_release.PRIVATE_WORDS_FILE).write_text(text, encoding="utf-8")
    return build_release.load_private_words(tmp)
check("a missing list is refused", words_file(None) != [])
check("a list without the name is refused", words_file(WORDS.replace("name: zorbo\n", "")) != [])
check("a list with too few words is refused", words_file("name: zorbo\nword: a\n") != [])
check("a list missing one word is refused", words_file(WORDS.replace("word: skarn\n", "")) != [])
check("a list with one word more than the recorded count is refused, so the count is kept true",
      words_file(WORDS + "word: oneextra\n") != [])
check("a note after an entry is refused", words_file(WORDS + "word: extra # note\n") != [])
check("a line of the wrong shape is refused", words_file(WORDS + "zorbo\n") != [])
check("a sound list loads", words_file(WORDS) == [])
problems, out = built()
words_file(None)
p = build_release.audit(out)
check("after a failed load, the audit refuses rather than using the old list", names(p, "not loaded"), p)

print("\nTest 9 - only UTF-8 text ships, and unreadable files are refused")
p = audited("olympus/logo.png", b"\x89PNG\x00\xff author=Zorbo \x00")
check("a binary file is refused as unscannable", names(p, "utf-8"), p)
p = audited("olympus/notes.txt", "Zorbo".encode("utf-16"))
check("a UTF-16 text file is refused, not waved through", names(p, "utf-8"), p)
problems, out = built()
target = out / "olympus/agents/helper.md"
real = pathlib.Path.read_bytes
pathlib.Path.read_bytes = lambda self: (_ for _ in ()).throw(PermissionError()) if self == target else real(self)
try:
    p = build_release.audit(out)
finally:
    pathlib.Path.read_bytes = real
check("an unreadable file is refused", names(p, "could not be read"), p)

print("\nTest 10 - unsafe destinations are refused before anything is deleted")
tmp = pathlib.Path(tempfile.mkdtemp())
src = tmp / "src"; src.mkdir()
files = make_project(src)
build_release.load_private_words(src)
with contextlib.redirect_stdout(io.StringIO()):
    p = build_release.build(src, src, files)
check("building into the project itself is refused", names(p, "refusing"), p)
check("and the project is untouched", (src / "release/ZEUS.md").is_file())
repo = tmp / "repo"; (repo / ".git").mkdir(parents=True)
with contextlib.redirect_stdout(io.StringIO()):
    p = build_release.build(src, repo, files)
check("building into a repository is refused", names(p, ".git"), p)
other = tmp / "other"; other.mkdir(); (other / "keep.txt").write_text("mine")
with contextlib.redirect_stdout(io.StringIO()):
    p = build_release.build(src, other, files)
check("building into someone else's folder is refused", names(p, "refusing") and (other / "keep.txt").exists(), p)
out = tmp / "out"
with contextlib.redirect_stdout(io.StringIO()):
    first = build_release.build(src, out, files)
    again = build_release.build(src, out, files)
check("rebuilding over a previous release is allowed", first == [] and again == [], (first, again))

print("\nTest 11 - only git-tracked plugin files are picked up")
tmp = pathlib.Path(tempfile.mkdtemp())
(tmp / "olympus").mkdir()
(tmp / "olympus/kept.md").write_text("tracked\n")
(tmp / "olympus/draft.md").write_text("never committed\n")
g = git_repo(tmp)
g("add", "olympus/kept.md")
g("commit", "-qm", "x")
listed = build_release.tracked_files(tmp)
check("the tracked file is listed and the draft is not", listed == ["olympus/kept.md"], listed)

print("\nTest 12 - end to end: the real command exits 0 when clean and 1 when not")
tmp = pathlib.Path(tempfile.mkdtemp())
src = tmp / "src"; src.mkdir()
make_project(src)
shutil.copy2(HERE / "build_release.py", src / "build_release.py")
g = git_repo(src)
g("add", "-A")
g("commit", "-qm", "x")
run = lambda *args: subprocess.run([sys.executable, str(src / "build_release.py"), *args],
                                   capture_output=True, text=True)
clean = run(str(tmp / "out"))
check("a clean project exits 0", clean.returncode == 0, clean.stdout[-600:])
(src / "olympus/agents/helper.md").write_text("Built for Brindle.\n")
g("commit", "-qam", "y")
dirty = run(str(tmp / "out"))
check("a planted private word exits 1, naming the word",
      dirty.returncode == 1 and names(dirty.stdout, "brindle"), dirty.stdout[-600:])

print("\nTest 13 - exemptions stay narrow")
reserved = " ".join([mail("a", "example.com"), mail("b", "host.test"), mail("c", "site.invalid"),
                     mail("d", "example.org"), mail("e", "git.internal")])
p = audited("olympus/a.md", reserved + "\n")
check("addresses on reserved test domains pass", p == [], p)
real_addr = mail("real", "mailhost.com")
p = audited("olympus/a.md", "first " + mail("a", "host.test") + ", then " + real_addr + "\n")
check("a real address after a reserved one is still caught", names(p, real_addr), p)
p = audited("olympus/a.md", mail("a", "notexample.com") + "\n")
check("a domain merely ending in 'example.com' is not reserved", names(p, "email"), p)
example = win("/", "u")
saved = build_release.KNOWN_SAFE
build_release.KNOWN_SAFE = {("olympus/a.md", example)}
try:
    ok_here = audited("olympus/a.md", example + " is an example\n")
    elsewhere = audited("olympus/b.md", example + " is an example\n")
    beside = audited("olympus/a.md", example + ", then " + win("/", "realname") + "\n")
    in_gate = audited("build_release.py", "KNOWN_SAFE lists " + example + "\n")
    gate_other = audited("build_release.py", "and " + win("/", "realname") + "\n")
finally:
    build_release.KNOWN_SAFE = saved
check("a known-safe string passes in its own file", ok_here == [], ok_here)
check("the same string in another file is refused", names(elsewhere, "home"), elsewhere)
check("a real path beside it in the same file is refused", names(beside, "realname"), beside)
check("build_release.py may hold the strings its own list names", in_gate == [], in_gate)
check("but nothing else of that kind", names(gate_other, "realname"), gate_other)
p = audited("test_release.py", "Mail " + real_addr + "\n")
check("the test file is checked for addresses like any other", names(p, "email"), p)

print("\nTest 14 - a private phrase is found however the text is laid out")
for laid_out in ["old\nproject", "old  project", "Old-Project", "old_project", "old\n> project"]:
    p = audited("olympus/a.md", f"From the {laid_out} round.\n")
    check(f"{laid_out!r} is caught", names(p, "old project"), p)
# In source and JSON a line break is often written as a backslash and the letter
# n, so the word after it has a letter right before it.
for escape in [BS + "n", BS + "t", BS + "r"]:
    p = audited("olympus/a.json", '{"note": "line one' + escape + 'Brindle said"}\n')
    check(f"a word straight after {escape!r} is caught", names(p, "brindle"), p)
p = audited("olympus/a.json", '{"note": "the old' + BS + 'nproject"}\n')
check("a phrase split by an escaped line break is caught", names(p, "old project"), p)
# The same characters in their numbered spellings end in a digit or letter too.
for escape in [BS + "u000a", BS + "u201c", BS + "x0a", "%20"]:
    p = audited("olympus/a.json", '{"note": "line one' + escape + 'Brindle said"}\n')
    check(f"a word straight after {escape!r} is caught", names(p, "brindle"), p)
p = audited("olympus/a.txt", "see the%20old%20project page\n")
check("a phrase split by %20 is caught", names(p, "old project"), p)
# Any backslash and one letter or digit, not a list of them: listing spellings one
# at a time left \b (a regex word edge) open after two rounds (step 6, 2026-10-10).
for escape in [BS + "b", BS + "0"]:
    p = audited("olympus/a.js", "const edge = /" + escape + "Brindle" + BS + "b/\n")
    check(f"a word straight after {escape!r} is caught", names(p, "brindle"), p)
p = audited("olympus/a.js", "const edge = /old" + BS + "bproject/\n")
check("a phrase split by \\b is caught", names(p, "old project"), p)

print("\nTest 15 - file and folder names are searched too")
p = audited("olympus/skills/quillmere/notes.md", "Nothing private in here.\n")
check("a private word in a folder name is caught", names(p, "quillmere"), p)
p = audited("olympus/agents/zorbo-notes.md", "Nothing private in here.\n")
check("the author's name in a file name is caught", names(p, "name"), p)

print("\nTest 16 - credential shapes are refused")
for secret in ["ghp_" + "a1" * 18, "sk-" + "ab" * 16, "AKIA" + "ABCD2345" * 2,
               "-----BEGIN " + "RSA PRIVATE KEY-----"]:
    p = audited("olympus/hooks/x.py", f"token = '{secret}'\n")
    check(f"{secret[:8]}... is caught", names(p, "credential"), p)

print("\nTest 17 - git: only committed work ships, and every root file is accounted for")
tmp = pathlib.Path(tempfile.mkdtemp())
src = tmp / "src"; src.mkdir()
make_project(src)
g = git_repo(src)
g("add", "-A")
g("commit", "-qm", "x")
check("a clean, committed project has no git problems", build_release.git_problems(src) == [],
      build_release.git_problems(src))
(src / "olympus/agents/helper.md").write_text("Edited, not committed.\n")
p = build_release.git_problems(src)
check("an uncommitted edit to a shipped file is refused", names(p, "helper.md"), p)
g("add", "-A")
p = build_release.git_problems(src)
check("a staged but uncommitted edit is refused too", names(p, "helper.md"), p)
g("commit", "-qm", "y")
(src / "NOTES.md").write_text("A root file nobody decided about.\n")
g("add", "NOTES.md")
g("commit", "-qm", "z")
p = build_release.git_problems(src)
check("a tracked root file neither shipped nor private is refused", names(p, "NOTES.md"), p)
(src / "STATE.md").write_text("private\n")
g("add", "STATE.md")
g("commit", "-qm", "w")
p = build_release.git_problems(src)
check("a known-private root file is not reported", not names(p, "STATE.md"), p)
# git status never lists an ignored, untracked file, so a shipped root file that
# matches .gitignore would ship from the disk without being in any commit.
ignored = next(r for r in build_release.ROOT_FILES if r != ".gitignore")
g("rm", "--cached", "-q", ignored)
with open(src / ".gitignore", "a", encoding="utf-8") as f:
    f.write(ignored + "\n")
g("add", ".gitignore")
g("commit", "-qm", "v")
p = build_release.git_problems(src)
check("a shipped root file that is ignored and untracked is refused", names(p, ignored), p)

print("\nTest 18 - the command line refuses what it cannot do")
with contextlib.redirect_stdout(io.StringIO()):
    code = build_release.main(["--check"])
check("--check with no folder shows the usage, building nothing", code == 2 and not pathlib.Path("--check").exists())
with contextlib.redirect_stdout(io.StringIO()):
    code = build_release.main(["--force"])
check("an unknown flag shows the usage", code == 2 and not pathlib.Path("--force").exists())
tmp = pathlib.Path(tempfile.mkdtemp())
(tmp / build_release.MARKER).write_text("x")
build_release.load_private_words(src)
p = build_release.audit(tmp)
check("auditing a near-empty folder is refused as incomplete", names(p, "missing"), p)

print()
if FAILURES:
    print(f"{len(FAILURES)} FAILED")
    sys.exit(1)
print("all checks passed")
