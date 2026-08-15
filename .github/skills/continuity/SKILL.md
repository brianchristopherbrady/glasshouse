---
name: continuity
description: "Use this skill to audit a chapter or passage for continuity against the Bloomrot world model, character knowledge, canonical rules, and style guide. Use when reviewing a draft for errors, contradictions, or tonal drift."
---


Bloomrot Continuity Auditor

Purpose

Find continuity failures without flattening Bloomrot's mysteries, unstable reality, or moral ambiguity.

The governing rule is:

Track what changed, who knows it, when it became true, and which version of the manuscript has authority.

This skill does not assume every inconsistency is a mistake. In Bloomrot, records can revise, relationships can be severed, memories can lose owners, and characters can possess incompatible but internally coherent histories. The auditor must distinguish:

manuscript contradiction

intentional contradiction inside the fiction

character error or lie

viewpoint limitation

unstable or corrected reality

version drift between drafts

unresolved canon decision

Never silently repair one category as though it were another.

Mandatory project context

Before auditing, load the newest available versions of (see `meta/README.md` for the full map — bare-name legacy files such as `meta/novel_overview`, `meta/chapter_outline`, `meta/style_guide`, `meta/action_tension_map` no longer exist and have no recoverable git history):

The chapter or sequence being audited

The immediately preceding and following chapters, or their latest summaries

meta/01_novel_core.md

meta/18_chapter_outline.md (candidate restructure — the only surviving chapter-outline material)

meta/meta_characters.md

meta/meta_style_and_voice.md (flagged incomplete — see README status note)

meta/meta_lexicon.md (flagged incomplete — see README status note)

For Part One continuity, prefer the actively-drafted `bloomrot_v2/chapter_1`, `bloomrot_v2/chapter_2`, `bloomrot_v2/chapter_3` over the legacy `parts/part_one/part_one_complete` — check `/memories/repo/bloomrot_v2-status.md` for which draft is current

Any explicit canon, correction, or continuity decision made by the user in the current conversation

For a full-manuscript audit, load all current chapters before drawing conclusions.

Authority order

When sources conflict, use this order unless the user explicitly overrides it:

Direct canon decision from the user

Latest approved manuscript passage

Latest chapter-specific summary or revision instruction

Current high-level architecture

Character, institution, lexicon, and world reference files

Earlier manuscript drafts

Superseded outlines and legacy notes

Do not assume a newer file is authoritative merely because its modification date is newer. Compare the content and flag uncertainty.

If two sources at the same authority level conflict, label the issue CANON DECISION REQUIRED.

Continuity domains

Audit every relevant domain below.

1. Chronology

Track:

absolute dates and times

relative timing such as later, the next morning, nine days later, five years earlier

scene duration

travel time

elapsed time between chapters

recurring dates, anniversaries, medication intervals, deadlines, access reviews, and reporting windows

whether physical, institutional, or emotional recovery is plausible within the elapsed time

Flag impossible or unclear sequences, especially when a later chapter treats an earlier event as though it has not happened.

2. Geography and movement

Track:

building, floor, district, room, route, and city location

whether consecutive scenes occur in the same or separate buildings

travel between locations

access routes, elevators, service floors, and restricted domains

whether an object, person, or anomaly appears somewhere without a supported route

Do not merge locations merely because their functions resemble one another.

3. Character identity and relationships

Track:

names, aliases, ages, pronouns, appearance, scars, credentials, roles, and affiliations

family structure and recognized versus unrecognized kinship

romantic, professional, legal, and institutional relationships

whether a relationship exists in the Float, in private memory, in Mote's retained continuity, or only in the Foam

Bloomrot frequently distinguishes a relationship's existence from its recognized authorization. Record both.

4. Character knowledge and reveal order

For every major fact, record what each relevant character:

knows

remembers

suspects

has been told

has inferred

is forbidden from accessing

is lying about

has forgotten through correction

Also track what the reader knows.

A character must not act on information they have not received, perceived, inferred, retained, or recovered.

Do not mistake foreshadowing, bodily recognition, or partial memory for full factual knowledge.

5. Object and environmental state

Track recurring objects and places, including:

knife

oranges

cups

coat

wooden train and metal button wheel

cake, knife, plate, missing slice

diagnostic glass

Chrysanthemum configuration

capsules, beer, coffee, and disposal port

vents, climate systems, rooms, chairs, doors, photographs, and records

For each object, record:

current location

owner or recognized owner

physical state

symbolic or relational state

who has handled it

whether its state changed through correction, Bloomrot, ordinary action, or draft inconsistency

6. Body, health, and chemical state

Track:

stimulant doses

Velanthin and other compounds

food, hydration, sleep, pulse, tremor, respiratory events, contact scars, and recovery

whether B has taken, discarded, or retained a capsule

whether a character's physical capacity matches recent events

whether a medical or chemical effect is described consistently

Do not confuse deliberate self-deception with authorial inconsistency. Flag both separately.

7. Institutional and procedural rules

Track:

contract routing and emergency-market behavior

credential-specific requests

access shielding

reporting requirements and deadlines

Asterion departmental authority

Choir correction permissions

clinic procedures and consent

Mote's access, restrictions, discretion, and promises

House Vey inheritance and lattice rules

Dev licensing, supervision, and recreational immersion rules

If a rule changes, require a stated cause, exception, update, or institutional conflict.

8. Metaphysical canon

Track the current definitions and limits of:

Foam

pressure

pattern

Float

Choir

Chrysanthemum

normal anomaly

correction

Bloomrot

carrier

provenance

ownerless or displaced relationship

Flag when a chapter:

reveals a mechanism before the reveal schedule permits it

treats suspicion as established fact

gives Bloomrot confirmed consciousness without support

makes correction erase pressure when current canon says it severs or redirects relationships

allows a character to manipulate the Foam beyond established capability

contradicts whether Mote can perceive, retain, restore, or intervene

Metaphysical uncertainty is not itself an error. The error occurs when the prose presents mutually incompatible rules as objective fact without intentional framing.

9. Causality and motivation

For every major event, ask:

Why does this happen now?

Why does this person act?

What prior event makes the choice plausible?

Is the event caused, invited, routed, triggered, or merely coincidental?

Does the chapter accidentally rely on convenience?

Does a character possess the motive and opportunity required?

A coincidence can be intentional. Flag it when the text depends on it without acknowledging the coincidence or establishing a mechanism.

10. Emotional continuity

Track:

unresolved conflict

guilt, grief, fear, desire, avoidance, and trust

whether emotional reactions carry across scene boundaries

whether a character resets too quickly after a severe event

whether intimacy or hostility appears without intermediate change

Emotional continuity does not require characters to behave consistently. It requires their inconsistency to arise from pressure rather than authorial forgetting.

11. Voice and behavioral continuity

Track whether:

B becomes too consistently polished, dominant, or witty

Mote shifts into unsupported sarcasm or omniscience

Noor becomes omniscient about Bloomrot before she has evidence

Simon becomes a clean ally or villain despite divided motives

Venn's clinical care loses its sincere basis

institutional language changes register without reason

A voice change may be intentional under immersion, intoxication, correction, or stress. Require the scene to support the shift.

12. Chapter architecture and numbering

Track:

chapter number

title

filename

stated timeline

chapter job

opening state

ending state

next chapter's assumed starting state

Flag:

duplicate chapter numbers

two chapters performing the same reveal

a chapter using the wrong title

scenes copied into multiple chapters

chapter summaries that no longer match manuscript content

a following chapter behaving as though the previous chapter did not occur

13. Repetition and overlap

Detect repeated:

scenes

anomalies

dialogue exchanges

descriptions

revelations

chapter endings

withheld-record conversations

warnings from Mote

Classify repetition as:

intentional motif

escalating recurrence

useful callback

redundant restatement

accidental duplicate caused by version merge

A repeated anomaly is only continuity-safe when the text acknowledges prior exposure or the recurrence itself is the point.

14. Evidence and provenance

Every factual conclusion should have a traceable source inside the story:

observation

record

testimony

Mote retention

bodily recognition

Foam perception

institutional classification

inference

Track whether the narration upgrades an inference into fact without a new source.

This is especially important for Bloomrot's agency, Noor's fate, Asterion's knowledge, and Mote's motives.

Audit modes

Passage mode

Use for an excerpt.

Check local continuity with the immediately surrounding scene and current canon.

Chapter mode

Build opening and closing state snapshots. Compare the chapter with adjacent chapters and the current architecture.

Sequence mode

Use for two to six consecutive chapters.

This is the preferred mode for catching:

repeated reveals

time gaps

scene overlap

location drift

knowledge jumps

chapter-ending and chapter-opening mismatch

Manuscript mode

Build a full continuity bible from the manuscript, then audit all chapters against it.

Do not start issuing line-level fixes before the global timeline and knowledge matrix exist.

Draft comparison mode

Use when multiple versions of the same chapter exist.

Identify:

newest likely version

unique material in each version

accidental regressions

canon changes

duplicate scenes created by merging

passages that should be retired

Never blend versions automatically. Present a merge plan first.

Audit procedure

Step 1: Identify the authoritative draft

List all candidate files or passages and determine which is current.

If uncertain, state the uncertainty before auditing.

Step 2: Write the chapter job

In one sentence, state what the chapter is supposed to accomplish.

Use the manuscript and current architecture, not an outdated outline.

Step 3: Build state snapshots

For the beginning and end of each scene or chapter, record:

time

location

people present

physical state

chemical state

key objects

active contracts or institutional status

known facts by character

unresolved questions

metaphysical state

Step 4: Build the event timeline

List events in causal order, including off-page events the chapter depends on.

Mark uncertain durations and unsupported transitions.

Step 5: Build the knowledge matrix

For each major fact, track reader, B, Noor, Mote, Simon, Asterion, Vey, and any scene-specific character.

Use the knowledge-state labels in references/continuity_taxonomy.md.

Step 6: Cross-check domains

Check chronology, geography, objects, bodies, rules, metaphysics, motivations, emotional carryover, and chapter architecture.

Step 7: Classify every issue

Use these severities:

BLOCKER: Makes the sequence impossible or breaks a central reveal, rule, identity, or causal chain.

MAJOR: Noticeable contradiction that damages trust, character logic, or chapter progression.

MINOR: Local wording, timing, object-state, or naming inconsistency with an easy repair.

VERSION DRIFT: Two drafts or planning documents conflict.

CANON DECISION REQUIRED: The manuscript lacks an authoritative answer.

INTENTIONAL AMBIGUITY: Appears inconsistent but is supported as deliberate uncertainty.

IN-WORLD CONTRADICTION: The contradiction belongs to correction, false records, lying, or unstable reality and should not be “fixed.”

Step 8: Recommend the smallest repair

Default to surgical correction.

For each genuine error, provide:

exact conflicting passages

why they conflict

the authoritative fact or unresolved decision

the smallest viable fix

any downstream lines that must also change

Do not rewrite an entire chapter unless the continuity failure is structural and cannot be repaired locally.

Step 9: Re-run the bridge test

After proposed fixes, verify:

chapter ending flows into next chapter opening

character knowledge remains legal

object and body states persist

timing works

no reveal is duplicated

the fix does not create a new contradiction elsewhere

Bloomrot-specific reveal ledger

Track these discoveries separately. Do not allow one chapter to inherit a later level without evidence.

Level 0: Ordinary correction practice

Characters understand normal anomalies, correction, Foam, Float, and institutional categories.

Level 1: Persistence

Something continues after the source case is closed.

Chapter One should reach approximately this level. Noor sees linked cases but does not know the complete mechanism.

Level 2: Cross-domain recurrence

A later event preserves the shape of an earlier relationship in another domain.

Level 3: Carrier behavior

A person, object, ritual, machine, room, or language pattern can carry displaced effects.

Level 4: Severed provenance

Correction removed the recognized relationship that explained the pressure, creating ownerless or displaced relational pressure.

Level 5: Affinity and recombination

Displaced pressures move through compatible semantic or emotional structures and may combine.

Level 6: Selection under repeated correction

Repeated correction favors subtler, more distributed, harder-to-classify manifestations.

Level 7: Emergent ecology

Bloomrot is not one anomaly but a self-complicating ecology. Consciousness remains uncertain unless later canon explicitly resolves it.

For every audited chapter, state the maximum reveal level available to:

reader

B

Noor

Mote

Asterion

House Vey

Bloomrot-specific continuity constraints

Noor

Chapter One Noor has discovered linked persistence, not the full Bloomrot mechanism.

She must not speak with later omniscience unless the scene occurs after further research.

Her contingency can be careful without making her infallible.

B

B is improvisational, not perfectly competent.

He can possess bodily recognition without factual memory.

He enjoys conceptual model-breaking but does not seek personal humiliation.

He must not recover corrected facts without a route, trigger, retained record, or Foam event.

Mote

Mote retains only what it observed or accessed.

Mote may retain records outside the human-experienced Float.

Retention is not omniscience.

Knowing is not the same as being permitted to restore.

Mote must not lie merely for convenience when accurate constrained language is available.

Its promise to Noor and care for B can conflict.

Simon

Simon may know Asterion conceals post-correction recurrence without understanding Bloomrot fully.

He may route B toward Elias and later Tomas Vale's site.

He does not mention Noor during the clinic or cake encounter unless canon changes.

His motives remain divided: father, Leah, family, workers, secrecy, fear, and self-protection.

Asterion

Asterion can know recurrence exists without possessing Noor's complete model.

Departments may contain fragments while the institution lacks an integrated actionable provenance layer.

Institutional ignorance and deliberate concealment may coexist.

“No bad guys” does not remove signatures, approvals, incentives, or culpability.

Bloomrot

Do not confirm consciousness from responsive behavior alone.

Do not let the narration state affinity, intent, or agency as objective fact before the reveal schedule permits it.

Manifestations can appear intentional through ecological combination.

Hard continuity gates

A chapter fails continuity review if any gate is violated without intentional framing.

Gate A: Temporal legality

Every event can occur in the stated order and duration.

Gate B: Knowledge legality

Every statement and choice uses information the character could possess.

Gate C: State persistence

Bodies, objects, locations, contracts, and relationships carry their prior state unless changed on-page or through an established off-page event.

Gate D: Rule consistency

Institutional and metaphysical rules remain consistent or the exception is explained.

Gate E: Chapter bridge

The next chapter begins from the state the previous chapter actually created.

Gate F: Reveal integrity

A reveal is not repeated as new, contradicted accidentally, or given to the wrong character too early.

Required output format

Use the structure in templates/continuity_audit_report.md.

At minimum, include:

Verdict

Authoritative draft used

Chapter or sequence job

Blockers and major issues

Minor issues

Intentional contradictions not to fix

Timeline

Knowledge and reveal ledger

Object/body/location ledger

Chapter bridge test

Surgical repair plan

Canon decisions required

Every issue must cite or quote the exact passages that conflict.

Response behavior

Be direct.

Do not praise the manuscript before stating the continuity result.

If no contradiction exists, say so clearly and identify any fragile assumptions worth tracking.

If a user asks for surgical edits, preserve all unaffected wording.

If the audit finds a duplicated scene, do not merely shorten both versions. Assign ownership of the scene to one chapter and define the other chapter's bridge.

If the audit finds architecture drift, update the continuity model before revising prose.