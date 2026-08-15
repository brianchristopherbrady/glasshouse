---
description: Conventions for editing world/*.json in the City Hall example world.
applyTo: world/**
---

# Editing the City Hall world

`world/*.json` is a small, hand-authored example of the generic world model
(`shared/world-types.ts`): relationships, corrections, issues, characters
(individual structures/systems), and institutions (governing/executing
bodies). It demonstrates the pattern this repo's MCP world-inspection tools
operate on -- a consuming repo should eventually replace this content with
its own domain, keeping the same shape.

## Before editing

1. Read the current state with `inspect_world` (or `npm run validate:world`)
   rather than assuming what's on disk.
2. Know which file you're changing and why: `relationships.json` (the graph),
   `corrections.json` (changes made to it), `issues.json` (open
   issues), `characters.json` (individual structures), `institutions.json`
   (governing/executing bodies).
3. Check `.github/instructions/municipal-code.instructions.md` for the real
   engineering-practice ordinances every in-world action is grounded in --
   an agent proposing or performing a correction should be able to cite the
   relevant section.

## Rules

- Every relationship's `subject`/`object` must be an id that exists in
  `characters.json` or `institutions.json` -- never invent an id in
  `relationships.json` alone.
- A correction that severs, redirects, or otherwise removes a relationship
  must reconcile, exclude, or explicitly flag every id listed in that
  relationship's `dependentRelationships` (see the `zoning-review` Skill).
- Every correction needs an `authorizationId` that some institution actually
  has on file, for an operation that institution is permitted to authorize.
- A character's `provenanceStatus` should only be `"closed"` if its
  `identityAnchorRelationshipId` genuinely resolves to a relationship with
  known provenance. If a structure's origin genuinely doesn't close (like
  the Overpass), mark it `"open"` -- do not force it closed to make the
  validator quiet.
- An issue classified `systemic_candidate` should document a
  `semanticAffinityChain` once one is known; leaving it empty is a real,
  visible admission that the pattern isn't understood yet, not an error to
  suppress. See the `issue-tracking` Skill for how logging authority
  (`loggedBy`) and assignment (`assignedTo`) work.
- Always run `npm run validate:world` after editing and read the **World
  Validation** Skill before treating any `ERR_*`/`WARN_*` result as
  resolved.
- After any agent action that touches `world/**`, follow the
  `dispatch`/`downstream` Skills so other agents' `_actions/` ledgers stay
  accurate.
