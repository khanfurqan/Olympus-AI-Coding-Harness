# Rules

Generalised engineering standards, true across every project in the workspace.

## How these load, and why that matters

ECC, the system these are modelled on, loads its rules **always**, into every session. Ours
are **agent-loaded**: a rule file is read by the specialist agent that needs it, inside that
agent's own context window. Your main session pays nothing for a rule it is not using.

That is only possible because the agents exist. It is the single biggest structural difference
from copying ECC directly, and it is why introducing these rules should make the `CLAUDE.md`
files **shorter**, not the total volume larger.

| Reader | Loads |
|---|---|
| `olympus:apollo-code-reviewer` | `common\code-review.md`, `common\error-handling.md`, plus `python\` when the change touches `.py` |
| `olympus:artemis-silent-failure-hunter` | `common\error-handling.md`, `common\code-review.md` |
| `olympus:ares-security-reviewer` | `common\security.md`, `common\data-integrity.md`, `common\code-review.md` |
| The main chat, running the `test-first` skill | `common\testing.md` |
| The main chat, writing a blueprint in `/plan-product` step 5 | `common\testing.md` |
| `olympus:hestia-docs-updater` | `common\documentation.md` |
| `olympus:hephaestus-agent-evaluator` | `common\code-review.md` |
| A human | Whichever one is being argued about |

## What belongs here versus in a CLAUDE.md

The dividing line, and it is worth applying strictly:

- **A rule** is true of any well-run project. "Money needs an explicit currency."
- **A CLAUDE.md fact** is specific and permanent to one codebase. "Gold is priced per tola
  here, so multiply the Yahoo ounce price by 0.375."

When something reads as general, it moves here and the project file keeps only the local
instance of it.

## Why each rule carries a scar

Most entries end with a line naming the real incident that produced them. That is deliberate:
a rule with a cost attached gets followed, and a rule whose origin nobody remembers gets
argued away by the next person in a hurry. Where a rule has no scar yet, it says so.
