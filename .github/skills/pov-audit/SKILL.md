---
name: pov-audit
description: "Use this skill to audit a Bloomrot chapter or passage for perspective violations — unauthorized access to a non-POV character's interior, accidental head-hopping, and narratorial intrusion that crosses the line from worldbuilding voice into a wrong character's consciousness. Use when a scene feels like it knows too much, when a character's thoughts appear without justification, or when a passage's focalization is unclear."
---

# POV Audit Skill

This skill targets one specific class of craft failure: **unauthorized perspective access** — moments where the prose enters a character's interiority, emotion, or perception without that character being the authorized point of view.

This is distinct from the `consistency-check` skill (which audits canon accuracy) and `continuity` (which audits world-model and knowledge-state). Use this skill when the question is: *whose eyes are we in, and are we allowed to be there?*

---

## Authorized Perspectives in Bloomrot

### Close Third, B-Anchored

The novel is written in close third person, anchored to **B** as the primary POV character. The prose perceives through B: what B sees, hears, notices, infers, or feels. Other characters are observed from the outside — their interiority is accessible only through what B can read from behavior, expression, voice, and action.

The narrator has a slightly elevated register for worldbuilding — describing how the Float functions, how Asterion systems operate, what Meridian looks like — but this is authorial texture, not a second POV character.

### Authorized perspectives by chapter

| Chapter | Primary POV | Notes |
|---|---|---|
| `bloomrot_v2/chapter_1` (flashback) | **Dual: Noor, then B** | Noor's solo investigation (opening through B waking) is a full, sustained POV section — not a brief exception. It is cleanly separated from B's section by a hard scene break (B entering the kitchen) with no head-hopping within either half. This reflects the extended-Noor-presence draft (`meta/18_chapter_outline.md`) and supersedes the legacy single-POV assumption below. Within B's section, Noor is still observed from outside, not entered. |
| Legacy `parts/part_one/chapter_1` | B | Only chapter where Noor is embodied under the *original* outline; she is still observed from outside, not entered. Applies to the legacy draft, not `bloomrot_v2/chapter_1`. |
| Part One, Ch 2–7 (present day) | B | Noor is absent; no access to her interiority |
| Parts Two–Four | B (default) | Update this table when new POV characters are introduced |

---

## What Constitutes a Violation

### 1. Thought attribution to non-POV character

Any sentence that tells the reader directly what a non-POV character thinks, wants, believes, or intends — without routing it through observable behavior.

**Flags:**
- "He/she thought..."
- "He/she knew..."
- "She was afraid that..."
- "He hoped..."
- "She did not want B to see..."

**Test:** Could B observe this? If yes, rephrase as observation. If no, it is interior access and must be cut or moved into dialogue/action.

### 2. Free indirect discourse drift

Free indirect discourse is permitted for the POV character. It is a violation when it slips into a non-POV character's register — when the prose starts thinking in another character's idiom without announcing a POV shift.

**Watch for:** Noor's voice appearing in narrative summary. Mote's register appearing in description of the world.

**Test:** Read the sentence and ask: whose perspective does this sentence belong to? If it cannot be B's, flag it.

### 3. Emotional state summary for non-POV characters

Stating directly that another character feels something, without grounding it in what B can see.

**Permitted:**
> *Noor's hand had gone still on the glass.*

**Not permitted:**
> *Noor was frightened.*

The distinction: the first is B observing. The second is the narrator reporting Noor's interiority.

Exception: brief narrator synthesis is permitted in clearly worldbuilding passages that describe how Meridian systems work, not what a specific character experiences.

### 4. Narratorial over-explanation of character motivation

Sentences that explain why a non-POV character acted or chose something, beyond what B could reasonably infer.

**Flag:** Any explanatory sentence about a secondary character's motivation that goes beyond what B has witnessed or been told.

**Test:** Does B know this, or has B been told this? If neither, it is unauthorized narrator access.

### 5. Head-hopping within a scene

Switching POV mid-scene without a structural break (white space, section break, or chapter change).

**Flag:** If the prose tracks B's perception for several paragraphs, then tracks another character's perception for several paragraphs, then returns to B — that is head-hopping, regardless of chapter.

---

## Special Cases

### Mote

Mote is not a POV character. The prose does not enter Mote's processing, architecture, or decision-making. Mote's interiority — to the extent it exists — is conveyed through behavior, speech, pause, and the accumulation of choices the reader must interpret.

Permitted: describing Mote's behavior, output, and speech.
Not permitted: explaining what Mote is "thinking," "choosing," or "experiencing" from inside.

Late-novel language drift (Mote using idiom incorrectly, Mote hesitating in patterns that suggest something) is permitted as observable behavior — not as reported interior experience.

### The worldbuilding narrator voice

Passages that describe how Meridian functions, what the Float is, how institutional corrections work — these are permitted as authorial texture. They are not a character POV. They become a violation when they:
- Use language that only one character could know or think
- Report what a specific character is privately experiencing while describing a system
- Slip from systemic description into emotional access ("The correction took from people what they had relied on, and they felt it as a quiet loss")

The last example is a narrator imposing an emotional generalization. It can slide toward violation if it is attributed to a specific character rather than the collective system.

### B's inferences about other characters

B is an exceptionally observant person. He can infer emotional states, intentions, and motivations from behavior. These inferences are permitted — they are B thinking, not the narrator reporting.

The line:
- **Permitted:** *He thought she was afraid.* / *She looked as if she had not slept.* / *Something in her voice had changed, and B did not know what it meant.*
- **Not permitted:** *She had not slept. She had been afraid since the review was scheduled.*

The first group is B observing. The second group is the narrator reporting without routing through B's perception.

---

## Steps

### 1. Identify the chapter's authorized POV

Check the table above first — `bloomrot_v2/chapter_1` is the one exception, with a dual Noor/B structure. For every other chapter, B is the sole POV character. The narrator has worldbuilding elevation but does not enter any other character's consciousness. Within a dual-POV chapter, treat each POV section independently: no head-hopping is permitted within either section, and each section's non-POV characters (e.g., Mote, or B within Noor's section) follow the same observed-from-outside rules as any other non-POV character.

### 2. Read the chapter looking specifically for perspective leaks

Do not look for plot problems or canon issues — those are other skills. Only look for: whose consciousness is the prose inside?

For each paragraph or passage that feels like it might be in the wrong perspective, ask:
- Who is perceiving this?
- Is that character the authorized POV?
- If not, can the passage be read as B observing/inferring?
- If it cannot be read that way, it is a violation.

### 3. Classify each violation

| Type | Description |
|---|---|
| **Direct attribution** | Prose directly states non-POV character's thought or feeling |
| **FID drift** | Free indirect discourse slips into non-POV character's voice |
| **Motivation summary** | Narrator explains non-POV character's reasoning beyond what B knows |
| **Emotional summary** | Non-POV character's emotional state reported, not observed |
| **Head-hop** | POV switches mid-scene without structural break |
| **Noor overuse** | The Noor exception exceeds one or two beats in Ch 1 |

### 4. Check Noor specifically in Chapter 1

Count the number of times the prose enters Noor's perspective. One or two is the limit. Flag anything above that, noting whether each instance is observational (permitted) or interior (violation).

### 5. Report

**Violations found:** List each violation with the exact passage, its type, and a proposed fix direction (rephrase as B's observation, move into dialogue, cut).

**Noor count (Ch 1 only):** Number of times Noor's perspective appears and whether each instance is within the permitted observational form.

**Clean passages:** If the chapter is clean, say so directly. Do not add false caveats.

**Priority:** Flag any violation that actively misleads the reader about what B knows or does not know — these are highest priority, because they affect the reader's relationship to every scene that follows.
