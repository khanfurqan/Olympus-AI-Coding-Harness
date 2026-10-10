---
name: learned
description: Append one entry to LEARNING.md capturing a concept just understood, in the fixed four-part shape, newest first. Use when the user says they have learned or finally understood something, wants to record an insight, or types /learned.
---

# Learned

Appends one entry to the `LEARNING.md` at the root of the Olympus repository, the folder that
also holds `THIRD_PARTY_NOTICES.md` (not `~\.claude\skills`, where a link to the plugin may live).
If that file does not exist, ask the user where to keep it rather than creating one. One entry,
not several. An entry that is really
three entries is one nobody rereads.

## What belongs here, and what does not

`LEARNING.md` holds **concepts, not project status.** The test is whether the entry would still
mean something to someone who has never seen this codebase.

| Belongs | Goes elsewhere |
|---|---|
| Why a subagent's context is separate, and what that changes | "Stage 3 is done" → `STATE.md` |
| What a Windows junction is and why an audit misreads it | "We chose SQLite" → `DECISIONS.md` |
| Why floats cannot hold money exactly | "Gold is priced per tola here" → project `CLAUDE.md` |

If the thing to record is a status, a decision, or a project fact, say which file it belongs in
and put it there instead. Do not append it here and do not append it twice.

## The shape, which is fixed

Read the existing file first and match it. Newest at the **top**, directly under the `---`
below the preamble.

```markdown
## <The insight stated as a claim, not a topic label>

**Met:** <date>, <the situation that produced it>.

**The concept:** <the idea in plain English, defined without reference to this codebase>

**Why it matters:** <what it changes about how you would do something>

**Could now explain:** <the specific thing they could now say to another person>

---
```

## The four parts each have a job

**The heading is a claim.** "Context is the scarce resource, and where a file loads decides its
cost" is findable in six months. "Context management" is not. If the heading could be a chapter
title in a textbook, rewrite it.

**Met** anchors it. A concept without the situation that produced it is a fact, and facts are
easier to look up than to remember.

**The concept** is the part that must survive leaving this project. Write it so it would make
sense in a different language and a different codebase. If you cannot, it is a project fact
wearing a concept's clothes.

**Could now explain** is the honesty check, and it is the reason the file is worth keeping.
Write the sentence the user could actually say out loud to another person. If you cannot write
it, the concept is not understood yet, and the right move is to say that and run `/explain`
first rather than recording a placeholder.

## Steps

1. Ask what the insight was, unless it is already clear from the conversation. Do not
   interrogate; one question.
2. Decide whether it is a concept or a project fact. Redirect if it is the latter.
3. Draft the entry and **show it before writing**. It is the user's file and their words matter
   more than yours.
4. Append at the top, under the preamble, above the previous newest entry.
5. Confirm in one line. No summary of what was written; they just read it.
