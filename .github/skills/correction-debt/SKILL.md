---
name: correction-debt
description: Known cross-domain failure patterns in the Float — how one correction quietly creates another problem, and how to resolve a validation failure that spans more than one world file. Use when a fix would visibly break something else, or a correction "passes" but shouldn't be trusted.
---

# Correction Debt

Correction in this world does not restore global coherence — at best it
creates local compatibility, and even local success can require repeated
maintenance (see `meta_correction.md` §Correction Debt). This Skill lists the
known interaction patterns so you check for them before declaring a repair
complete.

## Known patterns

### Uncounted dependents hiding in plain sight

A relationship's `dependentRelationships` list is often incomplete on first
read — a birthday ritual, a workflow, a habit built *through* the corrected
relationship but not identical to it. `ERR_UNCOUNTED_DEPENDENT` only catches
dependents that are *listed*; it cannot catch ones nobody wrote down. Before
declaring a correction's reconciliation complete, ask what forty-three years
of accumulated pattern would have built around this relationship that the
petition scope never mentioned. See `meta_correction.md`'s Thomas/Susan and
Tomas Vale worked examples.

### Authorization that's technically valid but institutionally blind

A correction can have a perfectly valid `authorizationId`, pass every `ERR_*`
check, and still be the wrong call — because the Choir's authorization check
(`institutional-sign-off`) never asks whether the correction will leave
residue. That is not a bug in the validator; it is the accurate shape of the
institutional failure this world models. Do not treat a clean `ERR_*` pass as
proof the correction was wise.

### Correcting a Bloomrot-linked relationship feeds the network

`WARN_BLOOMROT_CASCADE` fires when a correction targets a relationship already
tied to a `bloomrot_confirmed` anomaly. This does not block automatically. If
the Choir proceeds without House Vey's sign-off, the correction may remove the
visible symptom while creating new displaced consequences that feed the same
network — the positive feedback loop in `meta_bloomrot.md` §The Choir's Systemic
Error. Flag this explicitly; do not let it pass silently.

### Anomaly classification without a documented affinity chain

Classifying an anomaly `bloomrot_candidate` without a `semanticAffinityChain`
(`WARN_AFFINITY_UNRESOLVED`) usually means the classification is a hunch, not
yet a finding. See `bloomrot-classification` for the provenance-vs-affinity
distinction that should resolve this before the classification is trusted.

## General procedure when a fix creates a new failure

1. Do not revert the original fix reflexively — check whether the new failure
   was actually latent (the world was one edit away from this contradiction all
   along) or genuinely caused by the fix.
2. Identify the smallest additional filing (a `reconciliation` entry, an
   `authorizationId`, a `semanticAffinityChain`) that resolves the new failure
   without undoing the original one.
3. Re-run `npm run validate:world` after every edit, not just at the end.
4. If two institutional mandates are in genuine, unresolvable tension (the
   Choir authorizes; House Vey blocks), report this explicitly rather than
   picking a silent winner — this is exactly what House Vey's inspection
   should catch if Asterion Dev doesn't surface it first.
