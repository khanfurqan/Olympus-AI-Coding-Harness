# Third-party notices

Olympus is released under the MIT licence (see `LICENSE`). Nine of its skills were written by
other people and are included under their own licences, which still apply to them. Each one's
licence text sits in that skill's own folder, so a skill copied out on its own keeps its licence.

Checked against each upstream repository on 2026-10-10.

| Skill | Author | Source | Licence | Licence file(s) in the skill's folder |
|---|---|---|---|---|
| `archify` | tt-a1i | https://github.com/tt-a1i/archify | MIT | `LICENSE`, `THIRD_PARTY_NOTICES.md` |
| `impeccable` | Paul Bakaus | https://github.com/pbakaus/impeccable | Apache 2.0 | `LICENSE`, `NOTICE.md` |
| `graphify` | Safi Shamsi and the Graphify contributors | https://github.com/Graphify-Labs/graphify | Apache 2.0 (earlier contributions also MIT) | `LICENSE`, `LICENSE-MIT`, `NOTICE` |
| `ponytail`, `ponytail-review`, `ponytail-audit` | DietrichGebert | https://github.com/DietrichGebert/ponytail | MIT | `LICENSE` |
| `animate`, `review-animations`, `pick-ui-library` | Emil Kowalski | https://github.com/emilkowalski/skills | MIT | `LICENSE` |

## Changes made for Olympus

| Skill | What was changed |
|---|---|
| `archify` | Nothing. Identical to upstream commit `c4c6b3ba4e`, the `archify/` folder |
| `impeccable` | Nothing. Identical to upstream commit `5d00e30405`, the `.claude/skills/impeccable/` folder |
| `graphify` | One line added to `skill.md`: `disable-model-invocation: true`, so it runs only when typed. The file carries a comment saying so, as the Apache licence requires |
| `ponytail`, `ponytail-audit`, `animate` | The same one line added to `SKILL.md` |
| `ponytail-review` | A section appended to the end of `SKILL.md` and marked there as an addition: checks to run before proposing a simplification, further shapes of over-engineering, what to leave alone, and stating the cost of each cut. The author's text above it is unchanged |
| `review-animations`, `pick-ui-library` | Nothing |

## Notices carried by the included work

- `archify` credits its own sources in `archify/THIRD_PARTY_NOTICES.md`, including Simple Icons
  (CC0 1.0) for its brand marks, and is based on Cocoon-AI's `architecture-diagram-generator` (MIT).
- `impeccable`'s `NOTICE.md` records that two of its reference files are distilled from ehmo's
  `platform-design-skills` (MIT).
- `graphify`'s `NOTICE` records its move from MIT to Apache 2.0; contributions made under MIT
  remain available under MIT, kept in `LICENSE-MIT`.
- The three diagram images in `tools/diagrams/`, made with `archify`, embed the JetBrains Mono
  font, Copyright 2020 The JetBrains Mono Project Authors
  (https://github.com/JetBrains/JetBrainsMono), under the SIL Open Font License, Version 1.1. Each
  image carries that notice inside it.
