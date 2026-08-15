---
name: event-book
description: Assembles a session's real Storyboard (.agentarium/storyboards/<sessionId>.json, written by event-storyboard) into styled Book narration at .agentarium/books/<sessionId>.json, using the consuming repo's own agentarium.config.json narration style. Generic and repo-agnostic. Run after event-storyboard has covered the beats you want narrated.
---

# Event Book

Event Book is the last stage of the generic narrative pipeline: it turns a
session's Storyboard into prose an operator actually reads, in whatever
style the **consuming repo** has defined for itself -- not a fixed voice
this Skill invents on its own.

```
event-storyboard Skill writes .agentarium/storyboards/<sessionId>.json
  -> event-book Skill reads agentarium.config.json's narration style
  -> event-book Skill writes .agentarium/books/<sessionId>.json (this Skill)
```

## When to invoke this Skill

After `event-storyboard` has produced Storyboard entries for every beat you
want the Book to cover. Do not narrate a beat with no Storyboard entry --
report which `beatId`s are missing and stop, same principle as this repo's
own `writer` Skill.

## What it does

1. **Read the consuming repo's narration style.** `GET /api/narrative/config`
   or read `agentarium.config.json` at the repo root directly (see
   `shared/narrative-types.ts`'s `NarrationConfig`). If the file is absent,
   the style is the default: plain, precise, technical-spec narration --
   write like a written spec of what the flow did, no invented voice, no
   assumed characters.
   - If `voiceGuide` and/or `characters` are set (as this repo's own
     `agentarium.config.json` sets them to
     `.github/instructions/meta_style_and_voice.md` and
     `world/characters.json`), read those before writing a single word of
     prose -- they are the actual style contract, not decoration.
2. **Collect the Storyboard's beats**, in the order their underlying
   `StoryBeat`s occurred (chronological event order, not beat-kind order).
3. **Resolve multi-beat sections.** A single `BookSection` can cover more
   than one beat when they form one continuous scene (e.g. a decision
   immediately followed by the validation it triggered) -- don't default to
   one section per beat if that reads as choppy, and don't default to one
   giant section if beats are genuinely unrelated.
4. **Write styled prose per section**, honoring the configured style:
   - `style: "fiction"` (this repo): full narrative prose in the configured
     voice/characters, the same drafting standards as this repo's own
     `writer` Skill (poetic where earned, sardonic humor load-bearing,
     institutional register correct, perspective boundaries respected).
   - `style: "technical-spec"` (default, most consuming repos): a plain
     written account of what happened -- what was decided, why, what
     changed, what validated or failed, and what completed. No invented
     narrator, no character voice, no scene-setting. Think incident report
     / design-doc changelog, not fiction.
   - Any other `style` value: follow its `description` field literally;
     if the description doesn't resolve an ambiguity, default toward the
     technical-spec register rather than inventing embellishment.
5. **Do not invent plot or outcomes.** Every sentence must trace back to a
   Storyboard beat's `description`/`citedEventIds`. If the Storyboard is
   thin, the Book is thin.
6. **Persist.** `PUT /api/narrative/:sessionId/book` with
   `{ "title": string, "sections": BookSection[] }`, or write
   `.agentarium/books/<sessionId>.json` directly in the shape of
   `shared/narrative-types.ts`'s `NarrativeBook`.

## What this Skill does not do

- It does not reinterpret or re-derive beats from raw events -- it trusts
  `event-storyboard`'s descriptions as its input.
- It does not invent a style when `agentarium.config.json` is silent on one
  -- silence means the technical-spec default, not creative license.
- It does not touch `world/chapters/*.md` -- that is this repo's own
  `writer` Skill's output, from `world/storyboard.json`, a separate pipeline.
