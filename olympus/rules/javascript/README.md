# JavaScript

Conventions for browser-side code that has no build step, no bundler and no framework, such
as a single `app.js` served beside a page.

A project built with a framework and a bundler (React with Vite, for example) is **not**
covered by this file; its conventions belong in its own `CLAUDE.md`.

## The constraint that shapes everything: it must run from `file://`

A static export is meant to open by double-clicking, years from now, with no
server and no Python running. That rules out module imports over HTTP, build-time transforms,
and anything requiring a package manager at runtime.

Consequences worth knowing before proposing a change:

- **Guard every `localStorage` read with `try`.** Storage *throws* rather than returning null
  when disabled for the origin. An unguarded read has blanked an entire static export twice.
- **No npm dependency in the runtime path.** If a library is genuinely needed, it is vendored
  deliberately, not installed.
- One file is acceptable. Section it with banners and keep a map at the top rather than
  splitting it and breaking `file://`.

## Judgement belongs in the backend

Thresholds, classifications, and anything that decides what a reading *means* go in Python
where they can be tested. JavaScript renders what it is given.

The test of whether a line belongs here: could it be wrong in a way a test would catch? If yes,
it belongs where the tests are. Front-end code has no test runner in these projects, which is
precisely why it must not hold logic.

> Scar: business logic left in `app.js` drifted from its Python equivalent. Where a
> constant genuinely must exist in both, a test compares the two literally and fails when they
> diverge.

## Style

- `const` by default, `let` when reassigned, never `var`.
- Strict equality (`===`) always.
- Early returns over nested conditionals.
- Named functions over anonymous ones in anything that will appear in a stack trace.
- No `console.log` left in shipped code. Warnings are for the developer, not the user.

## DOM

- Query once, reuse the reference. Repeated `getElementById` in a loop is a real cost.
- Prefer `textContent` over `innerHTML` for anything derived from data. `innerHTML` with a
  value you did not author is an injection.
- `el.hidden = true` over `style.display`, so the intent survives a stylesheet change.
- Rebuilding a subtree with `innerHTML` destroys its listeners, which is usually what you want.
  Attaching a listener to a node that will be replaced is a leak that looks like a bug later.

## Accessibility is not optional and not a separate pass

Keyboard reachability for anything clickable, visible focus states, real contrast (measured,
not assumed), and semantic elements over styled `div`s. The `design:accessibility-review`
skill and `olympus:aphrodite-design-reviewer` agent both check this; it is cheaper to get right first.

## Formatting numbers for humans

Locale-aware formatting, tabular numerals in tables so columns align, and an explicit currency
or unit on every figure. A number without its unit is a defect, not a style choice.
