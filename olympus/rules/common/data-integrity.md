# Data integrity

Rules for anything holding numbers that matter: money, quantities, measurements, dates.

## A bare monetary float has no currency

Every money figure carries its currency explicitly. A number that is "500" is meaningless
until something says whether that is euros, dollars, or thousands of either.

Where two currencies meet, convert **both** sides at the rate that actually applied. A past
amount converts at the rate on the day it was paid; a current value converts at today's rate.
Converting only one side produces a gain or loss that is partly a currency movement wearing a
performance costume.

> Scar: amounts in two different currencies were summed into a single total as if they were one.

## Scale is a gate, not a footnote

Where figures arrive from a document or an external source, the declared scale ("in
thousands", "in millions") is read before any number is accepted. **If the scale cannot be
determined, refuse the figure.** Do not assume unscaled.

A missed scale is a silent 1000x error that poisons every downstream ratio, and unlike a
parsing failure it produces a plausible-looking number.

## Derive rather than store

Where a value can be computed from a more primitive record, compute it. Store the ledger,
derive the position. Store the transactions, derive the balance.

The payoff: correcting a past entry corrects everything downstream automatically, and the two
can never disagree because there is only one of them. The cost is recomputation, which at
personal-project scale is free.

> Practice: in one project built this way, balances are never stored. That single choice is what
> keeps every date, total and history derived from them simultaneously correct.

## One validation gate per write path

Every write goes through exactly one function that defines what "valid" means. Not a check in
the route, another in the importer, and a third in a bulk helper: those drift, and the one
that gets skipped is the one that matters.

> Scar: a bulk-import helper bypassed validation entirely, so the rule enforced everywhere
> else simply did not apply to the path that wrote the most rows.

## Record provenance per field, not per record

Where a value can come from several sources (a live feed, a cache, a document, a human), store
which one supplied it. Then:

- A hand-entered correction outranks an automated one and is never silently overwritten.
- An automated source may **retract** its own field when it stops supporting it, without
  touching fields it never owned.

Without per-field provenance, a refresh quietly reverts a human correction, which is the
failure that destroys trust in a system fastest.

## Cross-validate where two sources overlap

Where two independent sources state the same figure, compare them. Agreement is worth
recording; disagreement is a **finding to surface**, never something to resolve silently by
picking one. Two sources differing is information about your data quality.

## Show completeness alongside any score

A screen that passed 8 of 11 checks and one that passed 8 of 8 are different claims. Any
derived score travels with how much of it was actually measured.
