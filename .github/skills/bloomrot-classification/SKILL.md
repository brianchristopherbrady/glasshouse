---
name: bloomrot-classification
description: The provenance-vs-affinity distinction, the classify-anomaly taxonomy, and how to tell an ordinary Float anomaly from a Bloomrot manifestation. Use when investigating any anomaly, or before proposing a classification write to anomalies.json.
---

# Bloomrot Classification

## The one question that matters

Not: *is this physically possible?* (Physical impossibility is not diagnostic
of Bloomrot — an ordinary chair can throw itself downstairs under sufficient
relational contradiction, no Bloomrot required.)

The actual question: **does the local relational environment contain a
sufficient reason for this particular behavior?**

- If yes → ordinary Float anomaly (`local_pressure` or `correction_residue`).
  Strange where it was formed. A skilled Dev can trace it to its source.
- If no → the cause is displaced. The event is strange because it has arrived
  wearing the wrong body. Consult the taxonomy below.

## The classification taxonomy

| Provenance | Meaning |
|---|---|
| `local_pressure` | Ordinary Float anomaly; sufficient relational cause exists locally. No Bloomrot. |
| `correction_residue` | Consequence of a recognized correction, still within expected decay window. |
| `displaced_consequence` | Consequence of a correction whose source relationship has been removed; no recognized local provenance, but not yet confirmed as networked. |
| `bloomrot_candidate` | Evidence suggests connection to the extra-consensus network; requires a documented `semanticAffinityChain` before the classification is trustworthy (`WARN_AFFINITY_UNRESOLVED` fires otherwise). |
| `bloomrot_confirmed` | Confirmed Bloomrot manifestation; a correction has been attempted and fed the network. |
| `unresolvable` | Acknowledged that the Float cannot currently account for this. Filed and watched, not forced to a conclusion. |
| `unresolved` | Investigation ongoing — this is the correct, honest default while ambiguous (see the Halloway cake). |

## Same mechanism, different provenance

Ordinary anomalies and Bloomrot manifestations use the same Float mechanism —
relational pressure becoming actionable through the Float. The only diagnostic
difference is **where the sufficient relational pressure came from**:

- Ordinary: recognized local relationships → local contradiction → manifestation.
- Bloomrot: displaced relationships → network → semantic affinity with a local
  carrier → manifestation.

**Do not treat physical severity as evidence of Bloomrot.** The South
Quay/Western Tolerance Hall pair is canonical: identical physical behavior
(chairs moving toward exits), different causal architecture. South Quay had a
real local labor contradiction. Western Tolerance Hall did not — it received
network pressure through semantic affinity alone, eleven weeks after South
Quay was corrected.

## Escalation staging — do not jump ahead

- **Early**: alters interpretation, meaning, system behavior, semantic
  infrastructure, responsive physical systems.
- **Moderate**: increasingly bizarre material behavior, still through
  infrastructure already capable of acting on the world.
- **Mature** (reserve for a deliberate, weighty escalation): the network
  exerts semantic pressure directly on the Float, exceeding known limits — the
  thirteenth chair. Do not introduce this early.

## Procedure

1. Read the anomaly's `carrier` and ask what relational vocabulary that
   carrier actually has (a toaster knows bread, heat, crumbs — not grief).
2. Check whether a prior correction in `corrections.json` displaced a
   relationship whose semantic content matches the anomaly's behavior.
3. If proposing `bloomrot_candidate` or `bloomrot_confirmed`, document the
   `semanticAffinityChain` — the specific chain of affinity that connects the
   displaced relationship to this carrier. An undocumented chain is
   `WARN_AFFINITY_UNRESOLVED`.
4. Remember: `classify-anomaly` produces a recommendation. Only Asterion Dev
   executes the resulting write to `anomalies.json`.
