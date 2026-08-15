---
name: storyboard
description: Reviews every story beat (each chapter.thread.entry recorded across world/<agent>_actions/actions.md and downstream_effects.md) and writes a real, in-voice narrative description for it into world/storyboard.json. Run this after dispatch/downstream have processed a beat, and before the writer Skill assembles a chapter.
---

# Storyboard

Storyboard turns the raw ledger (`world/<agent>_actions/actions.md`,
`world/<agent>_actions/downstream_effects.md`, `world/dispatch.json`) into a
node-by-node narrative description — the connective tissue between "here is
what got logged" and "here is an actual chapter." It does for prose what
`shared/story.ts` does for the dashboard's Story graph: one real description
per beat, not an auto-generated label.

Storyboard is a Skill, not a character. It writes in third person about the
beat, in a voice appropriate to whichever character the beat belongs to, but
it does not roleplay as that character the way `write-dialogue` would for a
full scene.

## When to invoke this Skill

After an acting agent has appended a new `chapter.thread.entry` to its own
`actions.md`, and after `downstream` and `dispatch` have both run for that
entry (see `.github/skills/downstream/SKILL.md` and
`.github/skills/dispatch/SKILL.md` for that order). Storyboard is the third
step in the pipeline, not a replacement for either:

```
acting agent writes actions.md entry
  -> downstream Skill writes zero or more downstream_effects.md entries
  -> dispatch Skill writes world/dispatch.json
  -> storyboard Skill writes world/storyboard.json (this Skill)
  -> writer Skill assembles world/chapters/chapter-<N>.md (once a chapter's beats are all storyboarded)
```

## What it does

1. **Identify the new beat(s).** Read the `chapter.thread.entry` locator(s)
   just written. A single acting-agent turn can produce one `actions.md`
   entry plus several `downstream_effects.md` entries (one per involved
   agent, per `dispatch`'s routing) — each of those is its own beat and
   needs its own storyboard entry.
2. **Read everything about the beat**, not just its own text:
   - The entry's own text (from `actions.md` or `downstream_effects.md`).
   - `world/dispatch.json`'s routing for that locator — who else was
     involved, and how (`read-actions` vs `read-downstream`), since that
     shapes what the description can honestly say other characters knew.
   - The relevant `world/*.json` state (`float.json`, `corrections.json`,
     `anomalies.json`, `characters.json`, `institutions.json`) so the
     description is grounded in the actual data, not just the prose gloss.
3. **Write one storyboard entry per beat** into `world/storyboard.json` (see
   schema below): a real, specific, single-paragraph description of what
   happens at that beat — written the way a storyboard panel description
   reads (what's seen, who's present, what changes), not a bureaucratic
   restatement of the source ledger text.
4. **Respect the Bloomrot-evidence rule** (`.github/agents/rules/rules.md`):
   a storyboard description must not have a character reference, reason
   about, or speak of Bloomrot unless that character has actually been
   given sufficient in-world evidence to understand it. Check what that
   character's own `actions.md`/`downstream_effects.md` entries have
   actually shown them before writing a description that assumes they know
   more than the record supports. When in doubt, describe the observable
   behavior without the Bloomrot-specific framing the character wouldn't
   have.
5. **Do not invent plot.** Every storyboard description must be traceable to
   the source ledger entry and/or the `world/*.json` state it cites. If the
   source material is thin (e.g. a placeholder entry like "action 1.1.1"),
   the storyboard description should be equally minimal and say so, not pad
   itself out with invented incident.

## `world/storyboard.json` schema

```json
{
  "beats": [
    {
      "locator": "1.1.3",
      "agentId": "b",
      "source": "actions",
      "description": "...",
      "involves": ["b", "mote"],
      "bloomrotAware": false,
      "citedSources": ["world/b_actions/actions.md#1.1.3", "world/float.json:rel-tomas-birthday-ritual"]
    }
  ]
}
```

- `locator` / `agentId` / `source` identify which ledger entry this
  storyboards (matches the `BookEntry` shape used by `world/*_actions/`).
- `involves` lists every character who appears or is referenced in the
  description — this is what lets `writer` know who needs a line in the
  assembled chapter.
- `bloomrotAware` records whether this specific beat is one where Bloomrot
  is legitimately in view for the involved characters — set `true` only if
  you actually verified their evidence per step 4, never as a default.
- `citedSources` is the paper trail: which ledger entries and which
  `world/*.json` records the description is grounded in.

## What storyboard does not do

- It does not write chapter prose. That is `writer`'s job, once every beat
  in a chapter has a storyboard entry.
- It does not decide routing (`involved`/`mode`/`availableAt`) — that
  belongs to `dispatch`, which has already run by the time storyboard sees
  the beat.
- It does not skip the Bloomrot-evidence check because a description
  "obviously" needs the framing to make sense. If the record doesn't
  support a character knowing, the description doesn't get to know either.
