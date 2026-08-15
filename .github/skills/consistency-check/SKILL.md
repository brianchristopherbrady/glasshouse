---
name: consistency-check
description: "Use this skill to check a chapter or passage for consistency against the Bloomrot world model, character voices, canonical rules, and style guide. Use when reviewing a draft for errors, contradictions, or tonal drift."
---

# Consistency Check Skill

Use this skill to audit a chapter or passage for internal and canonical consistency.

## Steps

### 1. Identify the Scope

Ask the user which chapter or passage to review, or check the currently open file.

### 2. Read the Canonical Sources

Read these files before reviewing (see `meta/README.md` for the full map — the bare-name legacy files like `meta/theory` or `meta/style_guide` no longer exist):

```
meta/02_ontology.md         — Foam/Float/Choir model, ontology
meta/meta_bloomrot.md         — causal model, Bloomrot vs. anomaly distinction, provenance vs. affinity
meta/meta_style_and_voice.md  — voice, tone, guardrails (pointer file — flagged incomplete, see README status note)
meta/meta_characters.md       — voice and arc for each character
meta/meta_lexicon.md          — correct usage of technical terms (pointer file — flagged incomplete, see README status note)
meta/meta_institutions.md     — institutional blind spot, Choir/Asterion fragmentation
```

### 3. Check the Following

**World accuracy:**
- Is the Foam/Float/Choir model used correctly?
- Is correction portrayed as integrated (not deletion-then-repair)?
- Is the causal sequence for Bloomrot accurate (correction → displacement → carrier → recombination)?

**Anomaly classification:**
- Are primary anomalies distinguishable from Bloomrot manifestations?
- Does the prose preserve the causal distinction, or does it conflate them?

**Character voice:**
- Does B speak with precision, dry wit, and load-bearing humor?
- Does Noor speak exploratorily, discovered in the moment, not prophetically?
- Does Mote maintain bureaucratic precision, avoid flattering B, and avoid directly transmitting Noor?

**Canonical guardrails (from `meta/meta_style_and_voice.md` and `.github/copilot-instructions.md`):**
- No Bloomrot manifestation carries an intentional message for B.
- Mote does not become a telephone for Noor.
- No institution is portrayed as singularly evil or unified.
- The Choir does not collapse as a moral solution.
- Bloomrot is not portrayed as truth, liberation, or authenticity made manifest.

**Institutional language:**
- Does Asterion/Choir language use the correct register (clinical, courteous, jurisdictional, never overtly sinister)?

**Tonal consistency:**
- Is humor load-bearing rather than decorative?
- Is metaphor revealing character, system, or consequence?
- Is Meridian feeling like lived propaganda?

### 4. Report

Provide a brief structured report:

- **Passes:** what is working well and is consistent
- **Issues:** specific contradictions, misclassifications, voice drift, or canonical violations — with line or paragraph reference
- **Suggestions:** proposed fixes or alternative phrasings for any flagged issues
