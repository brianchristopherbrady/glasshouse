---
name: writer
description: Assembles a real chapter of prose from world/storyboard.json's per-beat descriptions, in locator order, once every beat for that chapter has been storyboarded. Writes world/chapters/chapter-<N>.md, which is what Book mode reads. Run this after the storyboard Skill, as the final step of the actions -> downstream -> dispatch -> storyboard -> writer pipeline.
---

# Writer (chapter assembly)

Writer is the last stage of the pipeline. Everything upstream of it
(`dispatch`, `downstream`, `storyboard`) works beat-by-beat. Writer is the
first Skill in the pipeline that thinks in terms of a whole **chapter**: it
reads every storyboarded beat belonging to a chapter number, in
`chapter.thread.entry` order, and turns that sequence of panel descriptions
into connected prose — the thing a reader actually reads in Book mode.

Writer is a Skill, not a character. Prose it assembles should be written in
the voice appropriate to whichever character a scene is centered on (per
`.github/instructions/meta_style_and_voice.md` and each agent's own voice
notes in their `.agent.md` file), but writer itself does not roleplay.

## When to invoke this Skill

After `storyboard` has produced an entry for every beat currently recorded
under a given chapter number. Do not assemble a chapter that's missing
storyboard coverage for a beat that exists in the ledger — that beat's
absence from the chapter would be a silent narrative gap, not a deliberate
omission. If coverage is incomplete, report which locators are missing and
stop rather than assembling around the gap.

## What it does

1. **Collect the chapter's beats.** Read `world/storyboard.json` and filter
   to every entry whose `locator` starts with the target chapter number
   (e.g. all `1.x.x` entries for chapter 1). Sort by `thread`, then `entry`.
2. **Resolve multi-perspective beats.** A single `chapter.thread.entry` can
   have several storyboard entries (one per involved agent/source, matching
   how `world/<agent>_actions/` records the same locator from multiple
   angles — see `.github/skills/dispatch/SKILL.md`). Writer decides, per
   beat, whether the chapter needs: one character's account (most beats),
   more than one in sequence (when a scene genuinely has two witnessed
   sides worth showing), or a synthesis that draws on multiple accounts
   without simply concatenating them. Do not default to dumping every
   perspective in a row — that is a storyboard artifact, not prose.
3. **Draft connected prose.** Turn the ordered, resolved beat descriptions
   into an actual chapter: scene transitions, character voice, pacing.
   Reuse the same drafting standards as `write-chapter`'s Step 4 (poetic,
   tactile, sardonic; humor load-bearing; dialogue economical, in-voice;
   institutional register correct for the Choir/Asterion; primary anomalies
   distinguishable from Bloomrot manifestations).
4. **Enforce the Bloomrot-evidence rule** (`.github/agents/rules/rules.md`)
   at the prose level, not just the storyboard level: even if a storyboard
   entry is marked `bloomrotAware: true` for one character, do not let that
   awareness leak into a scene from another character's point of view who
   hasn't earned it. Perspective boundaries in prose are a second,
   independent check on top of storyboard's per-beat check — see the
   `pov-audit` Skill.
5. **Write the assembled chapter** to `world/chapters/chapter-<N>.md`, with
   `## <chapter>.<thread>.<entry>` headings preserved at each beat boundary
   (same convention as `world/<agent>_actions/*.md`) so Book mode can still
   deep-link into a specific beat within the assembled prose, in addition
   to reading each character's own raw account.
6. **Run the consistency passes** before declaring the chapter done: use
   `consistency-check`, `continuity`, `scene-sequence-audit`, and `pov-audit`
   Skills as appropriate — these are audits, not drafting steps, and can
   catch a perspective violation or a duplicated beat introduced during
   assembly.

## `world/chapters/chapter-<N>.md` format

```markdown
# Chapter <N>

## <N>.1.1

<assembled prose for this beat>

## <N>.1.2

<assembled prose for this beat>
```

Locator headings are mandatory, exactly like the source ledger files —
Book mode's parser (`shared/book-loader.ts`) relies on the same
`## chapter.thread.entry` heading format to deep-link and cross-reference.

## What writer does not do

- It does not invent scenes that have no storyboard coverage. If the
  ledger is thin, the chapter is thin — pad with connective prose, not
  invented incident.
- It does not re-derive routing or Bloomrot-awareness from scratch. It
  trusts `dispatch`'s routing and `storyboard`'s `bloomrotAware` flags as
  inputs, and only adds its own independent perspective-boundary check at
  the prose level (step 4), not a redo of the upstream classification work.
- It does not overwrite a chapter file that a human has hand-edited without
  being asked to — check for existing manual edits (content that doesn't
  correspond to any storyboard beat) before regenerating.
