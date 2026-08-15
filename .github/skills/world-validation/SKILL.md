---
name: world-validation
description: How to run the deterministic world validator, what constitutes ERR_* vs WARN_* issues, and how to repair failures. Use before declaring any world-changing task complete.
---

# World Validation

## How to run it

```bash
npm run validate:world
```

This runs [`scripts/validate-world.ts`](../../../scripts/validate-world.ts)
against every file in `world/`. It exits `0` and prints `WORLD VALID` when
there are no `ERR_*` issues, or exits non-zero and prints each issue's rule
code, subject, message, and severity.

A convenience copy of the same command is available at
[scripts/run-validator.sh](./scripts/run-validator.sh) (macOS/Linux) and
[scripts/run-validator.ps1](./scripts/run-validator.ps1) (Windows).

## Critical distinction: ERR_* blocks, WARN_* does not

In this world, **PASSED can still be wrong** (see the `incident-classification`
Skill). The validator therefore separates:

- **`ERR_*` codes** — structural errors. These fail validation. A world with
  any `ERR_*` issue is not valid.
- **`WARN_*` codes** — require a human/institutional decision, not a code fix.
  They do **not** block validation, and no agent may treat them as something
  to silently resolve. `WARN_SYSTEMIC_CASCADE` specifically requires explicit
  human sign-off before a correction targeting a systemic-linked relationship
  may proceed.

## The eight rules

| Code | Description |
|---|---|
| `ERR_OPEN_PROVENANCE` | A character marked `provenanceStatus: "closed"` has an identity anchor relationship with unknown or missing provenance. |
| `ERR_ORPHANED_REL` | A relationship's `subject` or `object` does not exist in `characters.json` or `institutions.json`. |
| `ERR_UNCOUNTED_DEPENDENT` | A correction removed a relationship but didn't reconcile, exclude, or flag one of its listed dependents. |
| `ERR_NO_AUTH` | A correction has no `authorizationId`, or cites one no institution has on file, or cites an operation that institution isn't permitted to authorize. |
| `ERR_CLOSED_WITH_RESIDUE` | An anomaly is marked closed but an active relationship's `displacedConsequences` still points to it. |
| `ERR_TEMPORAL_DUPLICATE` | Two active relationships both claim `kind: "identity-anchor"` for the same character simultaneously. |
| `WARN_SYSTEMIC_CASCADE` | A correction targets a relationship already linked to a `systemic_confirmed` anomaly (a systemic issue, not a one-off). Does not block — requires explicit human sign-off. |
| `WARN_AFFINITY_UNRESOLVED` | An anomaly is classified `systemic_candidate` but documents no `semanticAffinityChain`. |

## How failures should be repaired

1. Read the rule code and subject from the validator's output — don't guess.
2. Match the code to the relevant Skill (`zoning-review` for
   `ERR_UNCOUNTED_DEPENDENT`/`ERR_NO_AUTH`, `provenance-audit` for
   `ERR_OPEN_PROVENANCE`/`ERR_ORPHANED_REL`, `incident-classification` for the
   `WARN_*` codes and `ERR_CLOSED_WITH_RESIDUE`).
3. Make the smallest edit that resolves the violation — do not silently
   restructure unrelated relationships.
4. Re-run `npm run validate:world`. Repeat until no `ERR_*` issues remain, or
   until you can articulate a genuine, unresolvable conflict.
5. Never edit the validator itself to make a failure disappear. The rules are
   the specification; the world must conform to them, not the reverse.
6. A `WARN_*` issue is not a failure to fix — it is a decision to make and
   record. Do not "solve" it by editing data until the warning vanishes; that
   would hide the exact institutional blindness this validator is built to
   surface.
