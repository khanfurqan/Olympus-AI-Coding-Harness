# Error handling

## Blank beats wrong

A field that could not be determined is reported as missing. It is never guessed, never
defaulted to something plausible, and never silently zero. A wrong figure is worse than an
absent one because an absent one announces itself and a wrong one gets acted on.

> Scar: a document parser that guessed at an undeclared scale would have reported
> 22,400 where the real figure was 22.4 billion. Three orders of magnitude, silent.

## Never swallow an exception

`except Exception: pass`, an empty `catch`, and a bare `except` that logs nothing are all the
same defect: the program continues in a state nobody chose. Every caught failure is either
handled, re-raised, or **recorded and classified**.

If a failure is genuinely acceptable, say so in the code and say why. "This feed is optional
and the caller degrades to cache" is a reason. Silence is not.

> Scar: three bare `except Exception` sites routed around an error taxonomy that already
> existed, so failures the system was built to classify arrived as nothing at all.

## Fail closed on anything that gates

If a check exists to stop something dangerous, its failure mode is **stop**, not **proceed**.
A verifier that dies leaves its finding blocking. A scanner that cannot run blocks the publish.
An unreviewed dimension is never a clean approval.

The test to apply: if this component crashes, does the system become more permissive? If yes,
invert it.

## Falsy is not missing

`0`, `""`, `0.0`, `False` and `[]` are values. `if not x` treats them as absence and is wrong
wherever zero is legitimate: a payment of zero, a balance of zero, an empty result set.
Compare against `None` explicitly.

> Scar: a payment of zero was read as "no payment recorded" and dropped from a total.

## Degrade in a stated order, and say which rung you are on

Where a value has fallbacks, the order is explicit and the result carries which source it came
from: live, then cache, then last known good, then absent. A number whose provenance is
unknown cannot be trusted or debugged.

## Validate at boundaries, trust inside

Input from a user, a file, a network response, or another system is validated once, at the
edge, and is typed and trusted after that. Re-validating internal calls is noise; skipping the
boundary check is the actual vulnerability.
