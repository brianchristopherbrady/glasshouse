---
name: provenance-audit
description: How to trace a character or relationship's provenance through correction history — the audit-provenance and cross-department-query mechanics. Use when a request questions who someone is, whether an identity "closes," or whether a pattern spans institutions.
---

# Provenance Audit

## Provenance closure

- A character's `provenanceStatus` is `"closed"` when every relationship
  through which they exist as a recognized continuous person can be traced to
  a real source. It is `"open"` when it cannot — this is not a bug to fix, it
  is sometimes the honest state of a life (Tomas Vale; what the Choir fears
  about B).
- Do not "close" a character's provenance by inventing a plausible-sounding
  relationship. If the anchor relationship's `provenance` field is `"unknown"`,
  the character's status must say `"open"`, not `"closed"`. Marking it closed
  anyway is exactly `ERR_OPEN_PROVENANCE`.

## The audit-provenance procedure

1. Open the correction record for the relationship in question — not because
   it's obviously relevant, but because it's the largest intervention nearby.
2. Read the full `reconciliation` scope. Notice what wasn't in scope, not just
   what was.
3. Ask the load-bearing question: **is the relational cause present in the
   local Float, or is this anomaly expressing pressure from a relationship
   that was present but has been corrected away?** The second case is not your
   call to make alone — hand it to `bloomrot-classification`, but document the
   citation chain that got you there.
4. Widen the query across institutional domains (`cross-department-query`)
   when a pattern might extend beyond one institution's records. This is
   visible in the world log in real time; proceed anyway — that visibility is
   a known, accepted cost of doing the work properly, not a reason to stop.

## Cross-file invariants (enforced by the validator)

- Every relationship's `subject` and `object` must resolve to a real entry in
  `characters.json` or `institutions.json` — a dangling reference is
  `ERR_ORPHANED_REL`.
- A character may not hold two simultaneous active `identity-anchor`
  relationships (`ERR_TEMPORAL_DUPLICATE`) — provenance requires exactly one
  anchor at a time, even for someone whose history is otherwise unresolved.

## Validation procedure

1. Read `world/characters.json` and `world/float.json` and identify every entity the request touches.
2. Make the edit.
3. Run `npm run validate:world`.
4. If `ERR_ORPHANED_REL` or `ERR_TEMPORAL_DUPLICATE` fails, re-read this
   Skill's relevant section before changing anything else.
