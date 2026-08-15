---
name: World data conventions
description: Conventions for editing world/*.json in the Float (Meridian).
applyTo: 'world/**'
---

# World data conventions

- Every id is a lowercase-hyphen string, unique within its file. Do not reuse
  an id for a different entity, even after deletion (`characters.json`,
  `institutions.json`, `float.json` relationships, `corrections.json`,
  `anomalies.json`).
- Cross-file references (`subject`, `object`, `targetRelationshipId`,
  `authorizationId`, `identityAnchorRelationshipId`, `sourceRelationshipId`,
  `carrier`, etc.) must resolve to an entity that actually exists in the
  referenced file. A dangling reference is `ERR_ORPHANED_REL` where the
  validator checks it, and a bug even where it doesn't yet.
- Keep `notes` fields in-world and dry rather than explanatory-for-the-reader
  — they are part of the fiction, not developer comments. A correction's
  `notes` field is the right place to record what was deliberately excluded
  from reconciliation and why ("Birthday ritual not in scope. Left where it
  fell.") — this is in-world practice, not a code comment.
- Never mark a character `provenanceStatus: "closed"` unless their identity
  anchor relationship genuinely has traceable (non-`"unknown"`) provenance.
  An open identity is a legitimate state in this world, not an error to hide.
- Prefer the smallest edit that satisfies the request. Do not restructure a
  file's schema to fix one instance of a problem.
- `WARN_*` issues are not failures to silently resolve — they require an
  explicit decision (recorded in `notes` or a correction's `reconciliation`),
  not a data edit that makes the warning disappear without that decision
  actually being made.
- After any edit under `world/`, run `npm run validate:world` before
  considering the change complete.
