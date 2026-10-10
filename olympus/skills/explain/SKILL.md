---
name: explain
description: Explain a file, function, subsystem or concept top-down with no assumed knowledge, then offer to record what was learned in LEARNING.md. Use when the user asks how something works, says they do not follow a piece of code, is about to change something unfamiliar, says "learning check" or asks what happened in a task, or types /explain.
---

# Explain

Understanding, then a record of it. The second half is what makes this different from asking a
question: an explanation you read once and lose is worth less than one you can find again.

**Two jobs share this skill.** If the user says "learning check", or asks what happened in a task,
go to **Learning check** at the end of this file; Steps 1 and 2 do not apply. Anything else is a
question about how something works: Steps 1 to 4.

## Step 1: Find out what is actually being asked

Explanations fail most often by answering the wrong question. Three distinct things arrive
looking identical:

| The ask | What they want |
|---|---|
| "What does this file do?" | The job it holds in the system |
| "How does this work?" | The mechanism, step by step |
| "Why is it written like this?" | The decision and its alternative |

If the request is ambiguous and the answers would differ, ask once, in one sentence. If they
would not differ much, pick the reading that covers the most ground and say which you chose.

## Step 2: Run `olympus:hermes-code-explainer`

Give it the specific target, the question from step 1, and one line on what the user already
knows if that is established. It is read-only and runs on `opus`, so let it do the work rather
than summarising the code yourself first.

For a concept with no code behind it (what a port is, what a runtime is), answer directly using
the same ladder rather than dispatching an agent at nothing.

## Step 3: Check the explanation before passing it on

The bar is not accuracy. It is **could the reader re-explain this to someone else after reading
it once.** Before delivering, check three things and fix them yourself if they are wrong:

- **Did it start at the top?** What the person experiences, then the flow in plain words, then
  the mechanism. An explanation opening with a class name has skipped two rungs.
- **Is there undefined jargon?** Every term defined in the sentence *before* it is used, not
  after and not in a glossary. Including the ones that feel too basic to define.
- **Are the file paths quarantined?** Concepts clean, references in one "Under the hood"
  section at the end.

If the explanation fails any of these, say so and fix it rather than shipping it with a caveat.

## Step 4: Offer the LEARNING.md entry

This is the step that makes it a skill rather than a question. Ask once, briefly:

> Worth recording in `LEARNING.md`?

Offer it only when there is a **transferable concept**, not merely a fact about this codebase.
"Flask routes map URLs to functions" is a concept. "The price column is called `px_last`" is
not; that belongs in the project's `CLAUDE.md` if anywhere.

If yes, append to the `LEARNING.md` at the root of the Olympus repository, the folder that also
holds `THIRD_PARTY_NOTICES.md` (not `~\.claude\skills`, where a link to the plugin may live). If
that file does not exist, ask the user where to keep it rather than creating one. Add the entry
at the **top**, following the existing shape
exactly:

```markdown
## <The insight as a sentence, not a topic label>

**Met:** <date>, <the situation that produced it>.

**The concept:** <plain English, no jargon, the idea itself and not this codebase's version>

**Why it matters:** <what it changes about how you would do something>

**Could now explain:** <the specific thing they could now say to someone else>
```

The heading is a claim, not a category. "Context is the scarce resource, and where a file loads
decides its cost" beats "Context management".

Do not append without asking, and do not ask twice.

## Learning check: explain what just happened

Added 2026-10-03. Two chats had read "learning check" as a request for a quiz, then as the
`LEARNING.md` offer. Neither is right: the user is new to programming, so **the chat explains and
the user listens.** Do not ask the user to explain anything first, and do not quiz them.

### 1. Find the change in the record, not in memory

Build the explanation from what git records as changed, never from this chat's memory of the task,
which can be wrong.

- If this chat made the change, use its changes, committed or not: `git diff`, and `git show` for
  any commit it made.
- If this chat made no change, use the most recent commit, and name it (short hash and message)
  before explaining. The first time the word "commit" appears, say what it is: a saved change, with
  a note saying why it was made.
- If there is nothing to explain, or it is unclear which change is meant, say so in one sentence
  and ask. Never invent a change, and never fall back to a quiz or a `LEARNING.md` offer instead.

### 2. Explain it in four parts

Plain words, about one screen in all: four short paragraphs, not four lists.

1. **What happened.** What the user would see or notice, then which part hands what to which,
   then the mechanism.
2. **Why it happened.** The reason, and the option that was turned down.
3. **How it helps.** What is better now, for the user or for the app.
4. **What this teaches about building software.** One idea the user could use in another project.
   Check the headings in `LEARNING.md` first; if the idea is already there, name that entry
   instead of teaching it again.

Run Step 3's three checks before showing it. File names and commands go in one "Under the hood"
line at the end.

### 3. Ask how it landed

End with exactly this question:

> Could you re-explain this to a colleague: yes, partly or no? If partly or no, which part lost you?

The first answer is the score. If it is partly or no, explain the part named once more, from a
different angle. Then give the user one line to carry back:
`Learning check: <the task in a few words>, <yes / partly / no>, lost at <the part, or none>`.

### 4. The offer

Step 4 applies once, and only if this task has not already made it. The idea from part 4 is
usually the entry.
