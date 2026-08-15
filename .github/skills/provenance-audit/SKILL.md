---
name: provenance-audit
description: How to trace a structure or relationship's provenance through world/history/*.json and world/changes.json in the City Hall example world. Use when a request questions who approved something, whether a structure's origin genuinely closes, or whether a pattern spans multiple institutions.
---

# Provenance Audit

Provenance is the answer to "where did this actually come from, and who
said it was okay" -- not "does it currently work." A structure can function
perfectly and still have `provenanceStatus: "open"` if nobody can produce
the permit.

## How to audit a structure's provenance

1. Read the structure's entry in `world/structures.json`. If
   `provenanceStatus: "closed"`, its `identityAnchorRelationshipId` must
   resolve to a relationship in `world/relationships.json` whose
   `provenance` is not `"unknown"` -- verify this yourself rather than
   trusting the flag; a stale `"closed"` marking is exactly what
   `ERR_OPEN_PROVENANCE` exists to catch, but only if someone runs the
   validator.
2. Use `find_dependencies` (MCP tool) on the structure's id to see every
   place it's referenced -- a structure referenced as `affects` in
   `world/issues.json` or as the `subject`/`object` of an undocumented
   (`provenance: "organic"` or `"unknown"`) relationship is a sign its
   origin story isn't as closed as it looks.
3. Check `world/history/*.json` snapshots for what the world looked like
   before -- if a relationship exists now that isn't reflected in an
   earlier snapshot, something changed it, and that something should have
   a corresponding entry in `world/changes.json`.

## Cross-institution patterns

A pattern "spans institutions" when the same kind of undocumented
dependency or authorization gap shows up under more than one institution's
domain (e.g. both Public Works and Building Safety have structures with
`provenance: "unknown"` connections). This is worth escalating as a
`systemic_candidate` even before any single instance is `systemic_confirmed`
-- see `issue-tracking`.

## What closes and what doesn't

Do not force a structure to `provenanceStatus: "closed"` because leaving it
`"open"` is inconvenient or makes the world map look messier. The Overpass
is the canonical example in this world's example data: it demonstrably
works, is demonstrably load-bearing, and still has no permit. That is the
honest state, not a defect in the record.
