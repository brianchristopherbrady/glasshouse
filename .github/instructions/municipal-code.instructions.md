---
description: The Municipal Code -- real engineering-practice ordinances every City Hall agent (Mayor, City Planner, Building Inspector, Public Works, City Clerk) must cite when proposing, authorizing, or inspecting a change. This is the "meta material on world building" that keeps the fiction and real practice coherent.
applyTo: world/**
---

# The Municipal Code

In the fiction, this is the city's official building code: the standard
every structure, permit, and inspection is measured against. In practice,
it's this repo's actual software engineering conventions, written once so
the game and the guidance are the same document. A consuming repo should
edit the section bodies below to match its own real standards -- keep the
section numbers and titles, since agents cite them by number.

An agent proposing or performing a change should reference the specific
section its action satisfies or violates. "This complies with Section 3" is
a real citation with a real, checkable meaning; "this seems fine" is not.

## Section 1 -- Permits before construction

No structure exists in the record without a permit (`identityAnchorRelationshipId`
resolving to a relationship with known provenance). If a structure's origin
genuinely can't be traced, it is marked **open provenance**, not silently
closed. *Real equivalent: don't merge code whose purpose or ownership can't
be explained in the PR description; if it genuinely can't be explained yet,
say so instead of writing a plausible-sounding justification after the
fact.*

## Section 2 -- Small, reversible work

Changes should be the smallest operation that resolves the issue
(`sever`, `attenuate`, `isolate` before `partition` or `substitute`), and
protected invariants must be named explicitly before the work begins.
*Real equivalent: prefer small, reviewable, revertible changes over large
rewrites; state what must not break before you start, not after something
breaks.*

## Section 3 -- No orphaned dependents

A change that removes or redirects a relationship must account for
every relationship that depended on it -- reconciled, transferred, or
explicitly excluded with a stated reason. Silence is not an accounted-for
dependent. *Real equivalent: before removing or changing a shared
utility/export, find and address every caller -- "I didn't check" is not the
same as "there are no callers."*

## Section 4 -- Authorization matches scope

An authorization only covers what the authorizing institution actually has
permission to authorize. Building & Safety can inspect and condemn; only
City Council can approve new construction. *Real equivalent: the person or
process approving a change should actually have standing over that part of
the system -- a reviewer approving an API contract change they don't own is
not real authorization.*

## Section 5 -- Confirmed systemic issues require a human decision

A `systemic_confirmed` issue is not a normal bug -- it's evidence of a
load-bearing dependency or pattern nobody accounted for. The validator will
not silently pass a change that touches it (`WARN_SYSTEMIC_CASCADE`);
it requires an explicit, recorded human decision, not an automatic fix.
*Real equivalent: when an incident reveals an undocumented architectural
dependency, the fix is a deliberate decision (often: mitigate now, redesign
later), not a quiet patch that hides how close the system came to breaking.*

## Section 6 -- The record outlives the agent

Every action an agent takes against the world should be recoverable from
`world/<agent>_actions/actions.md`, not just from memory. If it isn't
written down, it didn't happen for the purposes of any other agent's
decision-making. *Real equivalent: commit messages, PR descriptions, and
decision logs exist so the next person (or the next session) doesn't have
to reconstruct intent from the diff alone.*
