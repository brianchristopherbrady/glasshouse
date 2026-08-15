---
name: incident-classification
description: The provenance-vs-affinity distinction and the anomaly classification taxonomy for the City Hall example world -- how to tell an ordinary incident from a systemic_candidate or systemic_confirmed one. Use when investigating any anomaly, or before proposing a classification write to world/anomalies.json.
---

# Incident Classification

Every anomaly in `world/anomalies.json` has a `provenance` field. Getting it
right is the whole job of the Building Inspector -- a wrong classification
either causes false alarms (treating an ordinary incident as systemic) or
hides a real pattern (treating a systemic issue as ordinary).

## The taxonomy

- **`local_pressure`** — an ordinary, contained incident with a plausible
  local cause. Most anomalies are this. Does not need a `sourceRelationshipId`
  or `semanticAffinityChain`.
- **`correction_residue`** — a side effect of a correction that was already
  performed; check `world/corrections.json` for the correction that likely
  caused it.
- **`displaced_consequence`** — a consequence that a correction's
  reconciliation explicitly moved elsewhere rather than resolved. Should
  trace back to a `reconciliation` entry with `disposition: "displaced"`.
- **`systemic_candidate`** — evidence suggests this anomaly is not isolated,
  but the pattern connecting it to others isn't documented yet. Requires a
  `sourceRelationshipId` once one is known; an empty `semanticAffinityChain`
  is expected at first but should not stay empty indefinitely
  (`WARN_AFFINITY_UNRESOLVED`).
- **`systemic_confirmed`** — the pattern is confirmed: this is a load-bearing
  dependency or systemic issue nobody accounted for, not a one-off. Any
  correction targeting its `sourceRelationshipId` triggers
  `WARN_SYSTEMIC_CASCADE` and needs the Mayor's explicit sign-off.
- **`unresolvable`** — investigated and genuinely cannot be traced further
  with current evidence. Different from unclassified — this is an honest
  conclusion, not a placeholder.
- **`unresolved`** — not yet investigated, or investigation is incomplete.

## The provenance-vs-affinity distinction

**Provenance** is where an anomaly's carrier's relationship *came from* --
traced via `sourceRelationshipId` back through `relationships.json` and
`corrections.json`. **Affinity** is whether this anomaly *resembles* other
anomalies in kind or pattern, tracked via `semanticAffinityChain` (a list of
free-text pattern tags, not entity ids).

Two anomalies can share a provenance (same source relationship) without
sharing an affinity (different kind of problem), and can share an affinity
(same recognizable pattern) with completely unrelated provenance (same kind
of problem, unrelated cause). Classifying `systemic_confirmed` requires
**both**: a traceable source relationship *and* a real, checkable reason to
believe it's part of a larger pattern -- not just "this feels bigger than it
looks."

## What "PASSED can still be wrong" means here

The validator only checks structure (`ERR_*`) and surfaces decisions that
need a human (`WARN_*`). It cannot tell you whether a `local_pressure`
anomaly was actually misclassified and is secretly `systemic_confirmed` --
that judgment call is exactly what this Skill exists for, and a clean
validator run is not evidence that every classification was made correctly.
