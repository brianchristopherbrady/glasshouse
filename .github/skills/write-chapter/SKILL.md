---
name: write-chapter
description: Use this skill to draft a new chapter for the Float, or to decide whether one is ready to be drafted. Determines which beats belong to the chapter, confirms storyboard coverage, and either hands off to storyboard (if beats are missing descriptions) or to writer (if the chapter is ready for assembly) — the actual prose Book mode displays comes from writer, not from this Skill directly.
---

# Write Chapter Skill

`write-chapter` is the entry point of the drafting pipeline, not the Skill
that produces prose. It decides **what** needs to happen next for a given
chapter and delegates to the Skill that actually does it:

```
write-chapter (this Skill: decide what's needed)
  -> storyboard   (if any beat in the chapter lacks a description)
  -> writer       (once every beat is storyboarded: assemble world/chapters/chapter-<N>.md)
```

This mirrors the same acting -> downstream -> dispatch pattern the world
ledger already uses (see `.github/skills/dispatch/SKILL.md`): each Skill in
the chain does one job and hands off, rather than one Skill trying to do
everything.

## Steps

### 1. Identify the chapter

Ask the user which chapter number they mean, or infer it from
`world/dispatch.json`'s most recent `source.chapter` field. Chapter content
in this project is **not** pre-outlined in a separate file — it is built
from what has actually happened in the world ledger
(`world/<agent>_actions/actions.md` and `downstream_effects.md`, per the
`chapter.thread.entry` numbering convention), not drafted from a synopsis.
If the user wants to write toward a specific planned beat that hasn't
happened in the ledger yet, that's a request to run the relevant agent(s)
first (see `.github/agents/`), not something this Skill fabricates.

### 2. Check storyboard coverage

Read `world/storyboard.json` and list every `chapter.thread.entry` that
exists in the ledger for the target chapter (across all
`world/<agent>_actions/actions.md` and `downstream_effects.md` files) versus
every locator that already has a storyboard entry.

- **If any locator is missing coverage** → invoke `storyboard` for those
  specific beats. Do not proceed to drafting with gaps — report which
  locators are missing and stop, or invoke `storyboard` yourself if you have
  the authority to do so in this context.
- **If coverage is complete** → proceed to step 3.

### 3. Read reference material

Read these files before drafting or reviewing anything:

```
.github/instructions/meta_style_and_voice.md  — voice, tone, texture, guardrails
.github/instructions/meta_characters.md       — profiles/arcs for characters in this chapter
.github/instructions/meta_bloomrot.md         — canon rules, causal model
.github/instructions/meta_correction.md       — correction mechanics, braids, correction debt
.github/instructions/meta_relationships.md    — documented dyads relevant to this chapter's beats
.github/instructions/meta_lexicon.md          — verify any technical terms used
ontology.md                                    — Foam/Float world mechanics
.github/agents/rules/rules.md                  — the Bloomrot-evidence rule: no character
                                                  may reference, decide from, or speak of
                                                  Bloomrot without in-world evidence for it
```

Only read `.github/instructions/meta_institutions.md` if the chapter needs
sceneable institutional or medical detail, and `meta_world_and_society.md`
if it needs broader social texture.

### 4. Identify the pressure

Every chapter should have at minimum:

- A **commit point** — a correction committing, a train leaving, a district
  settling, a memory becoming inherited, a provenance seam closing.
- A **primary pressure type** — commit, identity, access, consent,
  provenance, carrier, or residue pressure. Ground this in what the
  storyboarded beats actually contain, not an invented outline note — this
  project has no separate outline file to draw the pressure type from.
- An **irreversible cost** — something that does not reset after the scene.

Confirm these are actually present in the storyboarded beats before handing
off to `writer`. If they aren't, that's a sign the chapter isn't ready to
assemble yet, even if every individual beat has a storyboard entry.

### 5. Hand off to writer

Once coverage is complete and the chapter has a real pressure and cost,
invoke `writer` to assemble `world/chapters/chapter-<N>.md`. Do not draft
prose directly in this Skill — `writer` is responsible for turning ordered
storyboard descriptions into connected chapter prose, resolving
multi-perspective beats, and running the consistency/POV audit passes.

### 6. Confirm the output

After `writer` completes, verify:

- `world/chapters/chapter-<N>.md` exists with `## chapter.thread.entry`
  headings matching the storyboarded locators.
- B, Noor, and Mote (and any other characters present) speak in their
  correct voices.
- Any Bloomrot manifestations are distinguishable from primary anomalies,
  and no character exceeds their evidenced Bloomrot awareness (cross-check
  `storyboard`'s `bloomrotAware` flags against the assembled prose).
- The chapter's commit point and irreversible cost from step 4 are actually
  present in the prose, not lost during assembly.

## Output

The deliverable is `world/chapters/chapter-<N>.md`, which Book mode reads
directly (see `shared/book-loader.ts` / `src/book/BookView.tsx`) alongside
each character's own raw ledger account. Do not just paste prose into the
chat as the final output — write it to that file so Book mode can display
it. Liner notes or open questions for the user, if any, go in a bracketed
`[like this]` aside, not inline in the chapter file itself.
