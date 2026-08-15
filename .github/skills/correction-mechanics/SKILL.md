---
name: correction-mechanics
description: How to perform a correction on the Float — operations, reconciliation, authorization, and protected invariants. Use when implementing, planning, or authorizing any change to world/float.json.
---

# Correction Mechanics

Correction is one integrated procedure — it does not delete first and repair
continuity afterward (see `meta_correction.md`). This Skill covers the mechanical
requirements the validator enforces; `bloomrot-classification` covers what the
mechanics can't see.

## The twelve operations

`sever`, `attach`, `reconcile`, `redirect`, `attenuate`, `reinforce`,
`constrain`, `partition`, `bind`, `substitute`, `anchor`, `isolate`, `release`
(see `meta_lexicon.md` §Correction Operation Verbs for full one-line glosses).
Each correction in `world/corrections.json` names exactly one `operation`.

## Authorization is mandatory and must actually permit the operation

- Every entry in `corrections.json` requires an `authorizationId`.
- That id must resolve to an entry in `institutions.json`'s `authorizations`
  array, under an institution whose `correctionPermissions` actually includes
  the correction's `operation`. An institution authorizing an operation
  outside its own permissions is `ERR_NO_AUTH`, same as no authorization at all.
- Only the Choir and Asterion currently hold correction permissions in this
  world. House Vey holds none — she inspects, she does not authorize.

## Reconciliation is mandatory for every listed dependent

- The target relationship's `dependentRelationships` array lists what depends
  on it. Every one of those ids must appear in the correction's
  `reconciliation` array, with a `disposition` of `redirected`, `transferred`,
  `excluded`, or `displaced`.
- `excluded` requires a `justification` — "not in scope" is an honest and
  acceptable justification, but it must be written down, not silently omitted.
  This is the Tomas Vale case exactly: the birthday ritual was excluded, with
  the note "Birthday ritual not in scope. Left where it fell."
- A dependent left off the list entirely (not even marked excluded) is
  `ERR_UNCOUNTED_DEPENDENT` — the validator does not require you to reconcile
  everything, only to *account* for it.

## Protected invariants

- `protectedInvariants` on a correction names what must survive regardless of
  the operation — e.g. `no-risk-to-employees-or-public-identified`,
  `continuity-of-care`, `prevention-of-secondary-injury`. These are not
  currently validator-enforced fields; they are a discipline for whoever
  drafts the correction to make explicit what they refuse to sacrifice.

## Procedure

1. Identify the target relationship and read its full current state,
   including every listed dependent.
2. Confirm authorization exists and actually covers the intended operation.
3. Decide the disposition of every dependent — don't default to `excluded`
   just because it's easiest; a master practitioner asks what each dependent
   actually means before deciding.
4. Make the minimal edit needed, then run `npm run validate:world`.
5. If `WARN_BLOOMROT_CASCADE` fires, stop and escalate — see `correction-debt`.
