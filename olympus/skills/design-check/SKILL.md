---
name: design-check
description: Check an interface against the project's own recorded design mandate rather than generic good taste, then route to the right specialist design skill. Use after any change to a template, stylesheet, component or page, when the user asks whether something looks right or is consistent or accessible, or types /design-check.
---

# Design check

The question this answers is **not** "is this good design". It is "is this the design this
project decided to be". Those are different questions, and only the second one is answerable.

## Step 1: Establish the scope

What changed, from `git diff --stat`, filtered to templates, stylesheets, components and
anything rendered. If nothing rendered changed, say so and stop rather than reviewing the
interface generally because the command was typed.

## Step 1b: Look at it once

Open the changed page in the Browser pane and take **one** screenshot, at half scale or zoomed
on the change. A full screenshot costs about 1,330 tokens; half scale about 345. Say in one line
what you looked at, and pass what you saw to the reviewer in words: the screenshot stays in this chat and is not saved
to a file it could read.

## Step 2: Run `olympus:aphrodite-design-reviewer`

It reads the project's `CLAUDE.md` and `DECISIONS.md` first to find the mandate, then checks
consistency against the project's own tokens, hierarchy, state coverage, responsive behaviour,
and the obvious accessibility failures.

It is read-only, with no `Bash`. It produces a critique and a routing recommendation, never a
redesign.

## Step 3: If there is no mandate, say so and offer to write one

A project with no recorded design decisions cannot be checked against itself, and this is worth
surfacing rather than working around. When `olympus:aphrodite-design-reviewer` reports no mandate found, the
useful response is not to review against generic taste anyway. It is:

> This project has no recorded design mandate, so I can only check internal consistency.
> Want to write one into `DECISIONS.md` first? Three lines is enough: what the interface is
> for, the palette and type scale it uses, and what it deliberately is not.

Three lines genuinely is enough, and every future check gets sharper for it.

## Step 4: Route, and route narrowly

`olympus:aphrodite-design-reviewer` names the specialist skill to run next. Run **one**, or at most two.

| For | Invoke |
|---|---|
| Interface critique, hierarchy, cognitive load, polish | `olympus:impeccable` |
| A formal WCAG 2.1 AA audit | `design:accessibility-review` |

Carry the mandate into whichever you invoke. A specialist skill given no constraints returns
its house style, which is exactly the generic answer this whole skill exists to avoid.

## Step 5: Separate the two kinds of finding

Report them apart, because they have different weights:

- **Violations.** The interface contradicts its own recorded decisions or its own tokens. These
  are objective and should be fixed.
- **Suggestions.** The specialist skill would do it differently. These are opinions, possibly
  good ones, and they are the user's call.

Collapsing the two is how a design review becomes something people stop running.
