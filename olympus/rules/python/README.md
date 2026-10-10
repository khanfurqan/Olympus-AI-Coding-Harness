# Python

Conventions for Python projects. Read by
`olympus:apollo-code-reviewer` when the change under review touches `.py` files.

## Tooling

| Job | Tool | Command |
|---|---|---|
| Tests | pytest | `python -m pytest` (offline, must be green) |
| Lint | ruff | `ruff check .` (must be clean) |
| Types | mypy | Informational; not a gate |
| Pinning | pip-tools | Edit `requirements.in`, regenerate `requirements.txt` |

Where `python` is on `PATH`, use it plainly, never a full
interpreter path.

## Structure

Separate layers by what they are allowed to do, and enforce it by where things are testable:

- **I/O layer**: network, disk, database. No arithmetic.
- **Compute layer**: all the arithmetic, takes a plain input object, touches nothing outside
  memory. This is the layer that gets tested exhaustively with invented data.
- **Assembly layer**: shapes results for the caller. Adds no new facts.

The payoff is that the arithmetic is testable with no network and nothing stubbed, because
there is nothing to stub.

## Idioms that matter here

- **Explicit `None` checks over truthiness.** `if x is None`, not `if not x`, wherever `0`,
  `""`, or `False` is a legitimate value.
- **Dataclasses for structured inputs**, not dictionaries passed between layers. A typo in a
  dict key fails at runtime and far from its cause.
- **f-strings** for formatting. Never `%` or `.format()` in new code.
- **Type hints on public functions**, especially where money or units are involved. The hint is
  documentation that cannot drift.
- **Context managers for anything that opens.** Files, connections, locks.
- **`pathlib.Path` over string paths.** Joining paths with `+` or `os.path.join` on a
  user-supplied string is how directory traversal happens.

## Money

For personal-scale projects, floats are acceptable and `Decimal` is deliberately not used. That
is a recorded decision of Olympus's maintainer, not an oversight: across four real money bugs in
those projects, none was a rounding error. Every one was a validation or currency-typing
failure. Spend the effort there. A project that needs exact decimal arithmetic, such as
accounting or invoicing, decides otherwise and says so in its own `CLAUDE.md`; do not flag
`Decimal` there, and do not flag floats here.

See `common/data-integrity.md` for currency and scale rules, which matter far more.

## Encoding on Windows

What the console accepts depends on where output goes. A real Windows console takes any
character, but output that is piped or captured can be cp1252 and crash on a character outside
it (2026-09-12: `cp1252` in one captured shell, UTF-8 in another). Reconfigure stdout to UTF-8
once, at package import, so every entry point behaves the same wherever its output goes.

## Testing

An autouse fixture redirects storage paths to a temporary directory, so no test can forget and
touch real data. See `common/testing.md`.

Mark tests that need a network with a marker and exclude them by default, so the everyday run
stays fast and offline.

## Traps worth a reviewer's attention

Moved here from `apollo-python-reviewer` when it was folded into `olympus:helios-code-reviewer`
(2026-09-25), which was renamed `olympus:apollo-code-reviewer` on 2026-10-03. These are the ones that pass review in another language and bite in Python. Three
of that agent's traps are not repeated here because they already live elsewhere: falsy zero is
"Explicit `None` checks over truthiness" above, float money is the `Money` section above and is
settled the other way, and bare or broad `except` is in `common/error-handling.md`. A fourth,
string concatenation for paths, is "`pathlib.Path` over string paths" above; only its encoding
half is repeated below.

**Mutable default arguments.** `def f(items=[])` binds one list at definition time, shared by
every call. The same goes for `{}` and any object constructed in the signature.

**Late binding in closures.** A lambda defined in a loop captures the variable, not its value
at the time. Every one of them ends up seeing the last value.

**Silent pandas coercion.** A column read as `object` because one row is a string. A merge
that drops rows because the key dtypes differ. An `astype` that turns a parse failure into
`NaN` with no signal. Check what happens to the bad row, not the good one.

**`open()` with no `encoding=`.** It takes the platform default, which on Windows is not UTF-8.

**Equality versus identity.** `is` against a small integer or a short string works by accident
of interning and stops working when the value changes.

**Shadowing.** A local variable, a module, or a test fixture named after something in the
standard library.

## What not to flag in Python

On top of the shared false-positive list in `common/code-review.md`:

- Missing type hints in a file or project that does not use them.
- `import *` in a `conftest.py` or a package `__init__.py` where it is the convention.
- A long function that is an exhaustive `match`, a config dict, or a parametrised test table.
- Not using a comprehension where a plain loop reads more clearly.
- `assert` in tests. That is what it is for. Only flag `assert` used as a runtime guard in
  shipped code, where running with `-O` removes it.
