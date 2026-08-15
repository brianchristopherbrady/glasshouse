---
name: zoning-review
description: How to perform a change in the City Hall example world -- operations, reconciliation, authorization, and protected invariants. Use when implementing, planning, or authorizing any change to world/relationships.json.
---

# Zoning Review

A "change" is any deliberate change to the relational structure of the
world: `world/changes.json` entries that operate on
`world/relationships.json`. This Skill covers how to perform one correctly,
and the known failure patterns that make a change quietly create a new
problem.

## The operations

| Operation | Use it for |
|---|---|
| `sever` | Removing a relationship entirely |
| `attach` | Creating a new relationship |
| `reconcile` | Formally documenting a relationship that already existed but was never on file |
| `redirect` | Pointing a relationship at a different object |
| `attenuate` | Weakening a relationship's effect without removing it |
| `reinforce` | Strengthening/stabilizing a relationship rather than removing it |
| `constrain` | Adding a guardrail without changing the relationship itself |
| `partition` | Splitting one relationship into two narrower ones |
| `bind` | Formalizing an implicit contract between two entities |
| `substitute` | Replacing what a relationship points at |
| `anchor` | Establishing an official record where none existed |
| `isolate` | Quarantining a relationship (e.g. pending investigation) without resolving it |
| `release` | Freeing an entity from an obligation/constraint |

Choose the smallest operation that resolves the issue (Municipal Code
Section 2). Reaching for `substitute` or `partition` when `attenuate` or
`constrain` would do is over-correcting.

## Reconciliation is not optional

Before performing a change that removes or redirects a relationship,
check that relationship's `dependentRelationships` in
`world/relationships.json`. Every id listed there must appear in the
change's `reconciliation` array with a real `disposition`
(`redirected`, `transferred`, `excluded`, `displaced`) -- silence on a
dependent is `ERR_UNCOUNTED_DEPENDENT`, a validator error, not a warning.

## Authorization

Every change needs an `authorizationId` that:
1. Actually appears in some institution's `authorizations` array in
   `world/institutions.json`, and
2. Belongs to an institution whose `changePermissions` includes the
   change's `operation`.

Citing an authorization the issuing institution isn't actually permitted to
grant is `ERR_NO_AUTH`, same as citing no authorization at all.

## Protected invariants

State explicitly, before the change, what must not break as a result
(`protectedInvariants`). This is not decoration -- it is the thing you check
against afterward to know whether the change actually worked, not just
whether the validator passed.

## Known failure pattern: change debt

A change that resolves its target relationship but leaves a
`systemic_confirmed`-linked issue untouched has not actually closed the
underlying problem -- it has just moved where it's visible next.
Before marking a change complete, check whether its target relationship
is referenced by any issue's `sourceRelationshipId`; if that issue is
`systemic_confirmed`, the change requires the Mayor's explicit sign-off
(`WARN_SYSTEMIC_CASCADE`) and should say, in `notes`, what happens to the
underlying pattern -- not just the one relationship that got fixed.
