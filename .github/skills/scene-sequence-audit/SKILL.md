---
name: scene-sequence-audit
description: "Use this skill to audit Bloomrot chapters for scene-sequence continuity errors: duplicate beats, knowledge-state violations (a character discovering something they already know), event repetition across chapters, and structural breaks in the accumulation of plot facts. Use when a scene beat may have been drafted twice, when a character's first encounter with something needs verification, or after a chapter is restructured."
---

# Scene Sequence Audit Skill

This skill targets one specific class of continuity failure: **structural beat errors** — where the same discovery, event, or dramatic moment occurs more than once, or where a character reacts to something as new that the manuscript has already established they know.

This is distinct from the broad `continuity` skill, which audits world-model accuracy and canon compliance. Use this skill when the question is: *has this already happened, and does the reader — or the character — already know this?*

---

## When to Use This Skill

- A chapter has been rewritten and you suspect a beat from the old draft survived into another chapter
- A character has an "first encounter" with something (a place, an object, a person, a revelation) and you want to confirm it is genuinely their first
- Two chapters in sequence cover the same location or event from different angles, and you need to verify they don't duplicate the dramatic payload
- A chapter was restructured and its original setup beat may now exist in the wrong place
- You are printing or publishing and want a final structural pass

---

## Steps

### 1. Read the Chapters in Sequence

Load all chapters relevant to the audit scope. If auditing a specific beat, read at minimum:
- The chapter where the beat currently appears
- Every preceding chapter in the same part
- Any chapter summaries available in `meta/18_chapter_outline.md` (candidate restructure — see `meta/README.md` for status)

Do not rely on memory or prior session context. Read the files.

### 2. Build a Beat Inventory

For each chapter, extract and list:

**Discovery beats** — the first time a character encounters an object, person, place, or piece of information
- Who discovered it
- Where and when
- What they knew before the discovery
- What they know after

**Knowledge state** — at the end of each chapter, what does each POV character know, believe, or suspect?
- Flag anything a character learns in chapter N that they appear not to know in chapter N+1

**Physical location of objects and people** — where is each significant object or person at the end of each chapter? Does the next chapter's opening position match?

**Emotional beats** — what has each character accepted, refused, or committed to by the end of the chapter? A character cannot uncommit between scenes without an intervening event.

### 3. Check for Duplicate Beats

Compare beats across chapters. Flag any of the following:

| Error type | Description |
|---|---|
| **Duplicate discovery** | Character encounters something as new when they have already encountered it |
| **Repeated revelation** | The same information is delivered to the same character twice, without the second delivery being intentional (e.g., a reminder, a correction, a different framing) |
| **Scene echo** | Two scenes cover the same physical event or dramatic payload in different chapters without structural justification |
| **Knowledge regression** | A character behaves as though they do not know something the manuscript has confirmed they know |
| **Object displacement** | An object appears in a location the manuscript has not moved it to |
| **Temporal impossibility** | Two events are sequenced in a way that cannot fit the stated or implied elapsed time |

### 4. Check Character Knowledge State Across the Boundary

At every chapter break, verify:

- Does the opening of chapter N+1 assume the same knowledge state that chapter N ended with?
- Has any character been reset to a prior emotional or informational state without cause?
- If a character withholds something from another character, is that withholding intentional and supported?

Pay special attention to:
- **B's knowledge of Bloomrot cases** — he cannot recognize a manifestation type in chapter N+1 as new if he identified it in chapter N
- **Mote's disclosed information** — once Mote has revealed a fact, it has been revealed; subsequent scenes cannot treat it as undisclosed unless a specific reason is given
- **Simon Kade's role** — Simon operates through implication and arrangement; verify that B's suspicion level is consistent with what Simon has actually said and shown

### 5. Report

Structure findings as:

**Clean:** beats that are correctly sequenced, no duplication

**Flagged:** specific beat errors with:
- Chapter and approximate location
- What the error is
- What both instances say
- Whether it is a duplicate beat, a knowledge regression, or an object/location displacement
- Recommended resolution (usually: remove from the chapter where it arrived second, or reframe the second instance as a *recognition* rather than a *discovery*)

**Canon Decision Required:** cases where it is unclear which instance is intended to be canonical

---

## Common Errors in Bloomrot Specifically

**The duplicate first encounter** — B sees a Bloomrot manifestation "for the first time" in two different chapters. The most recently drafted chapter is usually the culprit; the earlier chapter established the beat and was not updated when the later chapter was added.

**The explained discovery** — B arrives at a conclusion the reader already watched him reach. The revision removed the scene that paid it off but left the setup, or vice versa.

**Simon's orchestration visible too early** — Simon arranges for B to see something; if B has already seen it through a different path, Simon's arrangement becomes redundant and his role collapses.

**The Mote leak** — Mote discloses information in one scene that it should not possess until a later revelation. Check Mote's disclosures against the chapter outline's intended sequence.

**The Noor memory** — B's access to memories of Noor is governed by the correction on him. A scene where he half-remembers her too explicitly before the correction begins to fail is a structural beat error, not just a tone note.
