---
name: issue-tracking
description: How issues are logged, classified, and assigned in the City Hall example world -- the provenance-vs-affinity classification taxonomy, which institutions have authority to log an issue, and how a fix in one place can require a different agent to resolve a consequence elsewhere. Use when investigating any issue, logging a new one to world/issues.json, or deciding who it should be assigned to.
---

# Issue Tracking

`world/issues.json` is the world's open task queue: unresolved problems,
remaining work, and consequences of past actions that still need attention
-- not unlike the downstream fixes a single change in a codebase can leave
behind for someone else to pick up. An issue is not closed just because the
agent who noticed it isn't the one who can fix it; it's closed when the
problem is actually resolved, by whoever `assignedTo` says is responsible.

## Logging authority

Not every agent formally logs an issue. Building Inspector holds general
authority to log and classify issues (`loggedBy: "building-safety-division"`
in most cases), since that's its domain. Public Works and other institutions
can notice and flag a suspected issue in their own `actions.md`, but the
formal `world/issues.json` entry -- the one the validator and other agents
actually read -- should be logged by whichever institution's `domain` in
`world/institutions.json` actually covers it. Logging without real
authority is the same mistake as citing an authorization an institution
doesn't hold (Municipal Code Section 4) -- it looks official without being
official.

## Assignment: logging and fixing are different jobs

Every issue may carry two different institution ids:

- **`loggedBy`** -- who formally logged and classified this issue.
- **`assignedTo`** -- who is actually responsible for resolving it.

These are very often different agents. Building Inspector logs and
classifies `issue-water-pressure` as `systemic_candidate`, but assigns it to
Public Works (`assignedTo: "department-of-public-works"`) because
resolving it is a `reconcile` operation within Public Works's own
`correctionPermissions`. Building Inspector logs `issue-overpass-load` as
`systemic_confirmed` but assigns it to City Council (`assignedTo:
"city-council"`), because only the Mayor's office can authorize a fix that
touches a `systemic_confirmed` dependency. **An issue with no `assignedTo`
is not necessarily a mistake** -- it can honestly mean nobody has claimed it
yet, the same way an unassigned ticket sits in a backlog.

## The taxonomy

- **`local_pressure`** — an ordinary, contained problem with a plausible
  local cause. Most issues are this. Does not need a `sourceRelationshipId`
  or `semanticAffinityChain`.
- **`correction_residue`** — a side effect of a correction that was already
  performed; check `world/corrections.json` for the correction that likely
  caused it. This is exactly the "you fixed one thing and it broke another"
  case -- log it as a new issue rather than silently patching around it,
  and assign it to whichever institution owns the affected area, even if
  that's not the institution that performed the original correction.
- **`displaced_consequence`** — a consequence that a correction's
  reconciliation explicitly moved elsewhere rather than resolved. Should
  trace back to a `reconciliation` entry with `disposition: "displaced"`.
- **`systemic_candidate`** — evidence suggests this issue is not isolated,
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

**Provenance** is where an issue's affected relationship *came from* --
traced via `sourceRelationshipId` back through `relationships.json` and
`corrections.json`. **Affinity** is whether this issue *resembles* other
issues in kind or pattern, tracked via `semanticAffinityChain` (a list of
free-text pattern tags, not entity ids).

Two issues can share a provenance (same source relationship) without
sharing an affinity (different kind of problem), and can share an affinity
(same recognizable pattern) with completely unrelated provenance (same kind
of problem, unrelated cause). Classifying `systemic_confirmed` requires
**both**: a traceable source relationship *and* a real, checkable reason to
believe it's part of a larger pattern -- not just "this feels bigger than it
looks."

## Downstream consequences

When resolving one issue creates or reveals another -- the dev-environment
case of "fixed the build, now the tests are red" -- log the new issue
separately rather than expanding the scope of the correction that caused
it. Set its `provenance` to `correction_residue` (caused by a specific past
correction) or `displaced_consequence` (explicitly moved rather than
resolved), and `assignedTo` whichever institution actually owns the newly
affected area -- which may not be the institution that performed the
original correction. This is what keeps a chain of fixes from quietly
becoming one unaccountable mega-change.

## What "PASSED can still be wrong" means here

The validator only checks structure (`ERR_*`) and surfaces decisions that
need a human (`WARN_*`). It cannot tell you whether a `local_pressure`
issue was actually misclassified and is secretly `systemic_confirmed`, or
whether an issue was logged by an institution that didn't really have
standing to -- that judgment call is exactly what this Skill exists for,
and a clean validator run is not evidence that every classification or
assignment was made correctly.
