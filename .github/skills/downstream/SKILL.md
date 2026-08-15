---
name: downstream
description: Understands the specific canon in .github/instructions/ and writes the filtered, indirect context other agents would actually receive from an action — reviewing both the acting agent's actions.md entry and any world/*.json files it edited — into their own world/<agent>_actions/downstream_effects.md. Invoke immediately after an agent appends a new entry to its own actions.md, and always before invoking the dispatch Skill.
---

# Downstream

Downstream is a Skill, not a character. It has no persona and does not
narrate in its own voice — when it writes into an agent's
`downstream_effects.md`, it writes in the voice of whatever or whoever is the
actual in-world source of that agent's awareness (an intermediary, an
institutional channel, ambient overhear), never in a neutral meta-voice.

Downstream's job is narrower than dispatch's. Dispatch decides *whether* and
*how* an agent becomes aware of something. Downstream does the actual work of
figuring out *what indirect content, if any, that awareness would consist of*
and commits it to the record before dispatch has to decide anything.

## When to invoke this Skill

Immediately after any agent appends a new entry to its own
`world/<agent>_actions/actions.md` — **before** invoking the `dispatch`
Skill. Dispatch's own procedure now assumes downstream has already run and
reviews downstream's output as part of building `world/dispatch.json`.

## What it does

1. **Read everything the acting agent just produced**, not only its prose
   record. This means:
   - The `chapter.thread.entry` that was just appended in the acting agent's
     `actions.md`.
   - Every `world/*.json` file that agent's `.agent.md` lists under its
     Domain / Edit permissions and that was actually touched this turn —
     `float.json` (relationships, dependents, displaced consequences),
     `corrections.json` (operation, reconciliation, scope exclusions),
     `anomalies.json` (provenance, classification, affinity chain),
     `characters.json` (provenance status changes), `institutions.json`
     (authorizations). A correction's real downstream effects often live in
     the JSON diff — a reconciliation `disposition: excluded`, a newly
     `bloomrot_confirmed` anomaly, a changed `provenanceStatus` — not in the
     prose gloss of it. Diff or re-read the relevant file to see the actual
     before/after, not just what the agent's own actions.md entry claims
     it did.
   - If the acting agent's entry references a `chapter.thread.entry` it
     itself just read via `dispatch` (i.e. it acted on a prior downstream
     entry), read that antecedent too — effects can chain.
2. **Consult canon.** Cross-reference the acting agent's `.agent.md` domain
   and the specific action — prose and JSON both — against
   `.github/instructions/`:
   - `meta_relationships.md` for what a documented dyad partner would feel
     without being told directly — the residue of a relationship, not its
     announcement.
   - `meta_correction.md` §Direct Relational Effect vs. Downstream
     Consequence and §Correction Debt for which relational strands are mere
     consequence (→ candidate for a downstream entry) versus direct effect
     (→ not downstream's concern; that agent may get `read-actions` from
     dispatch instead), and for how long a consequence might take to surface.
   - `meta_bloomrot.md` for cases where the connection is by semantic affinity
     rather than direct notice — this is almost always a downstream case,
     not a direct one.
   - `meta_institutions.md` for institutional leakage — what reaches an
     institution or a person like Simon Kade only through an indirect,
     unofficial, or filtered channel.
   - `meta_characters.md` for whether a character's temperament means they'd
     construct their own (partial, possibly wrong) read of a consequence
     even without being told — that construction is itself the downstream
     content to record, not an invented fact they don't actually have.
3. **For each agent who would plausibly feel an indirect consequence**,
   write a new `chapter.thread.entry` into that agent's own
   `world/<agent>_actions/downstream_effects.md`, containing **only** the
   filtered context that agent would actually receive — not a summary of the
   source entry, not more than they'd plausibly know. Write it in the voice
   of the actual source of their awareness (Mote's adjusted framing, an
   institutional memo's bland register, Simon Kade's controlled
   understatement, or the agent's own incomplete inference — attributed as
   such). The content can come from either source read in step 1: a prose
   detail the acting agent chose not to formally report, or a fact only
   visible in the JSON diff (a relationship now `severed`, an anomaly now
   `bloomrot_confirmed`, a dependent marked `excluded`) that the agent's own
   `actions.md` entry didn't mention but that another agent would still
   plausibly notice or be told through their own channel.
4. **Do not decide `involved` or `mode`.** That determination, and the
   writing of `world/dispatch.json`, belongs to `dispatch`, which runs next
   and reviews what downstream just wrote.

## What downstream does not do

- It does not decide whether an agent is `involved: false` — that is
  dispatch's call, made after reviewing downstream's output. Downstream may
  correctly conclude no agent needs a downstream entry for a given action;
  in that case it writes nothing and says so when handing off to dispatch.
- It does not write into an acting agent's own `actions.md` — that record
  belongs to the acting agent alone.
- It does not fabricate certainty. A downstream entry can and often should
  be incomplete, wrong, delayed, or filtered through someone with their own
  agenda — that is realism, not an error to correct.
- It does not skip canon review because an effect seems obvious. "Obviously
  no one else would know" is exactly the kind of claim that needs a citation
  to `meta_relationships.md`, `meta_institutions.md`, or `meta_characters.md`
  before it's trusted.
- It does not review only the acting agent's prose entry and skip the JSON
  files. An `actions.md` entry that says "correction completed, within
  scope" can sit beside a `corrections.json` reconciliation that quietly
  excluded a dependent, or an `anomalies.json` write that just escalated a
  case to `bloomrot_confirmed` — read the actual files, not just the gloss.

## Relationship to dispatch

Downstream runs first and produces content. Dispatch runs second and
produces routing. Concretely, per acting-agent turn:

1. Acting agent appends a `chapter.thread.entry` to its own `actions.md`.
2. Invoke `downstream`. It writes zero or more new
   `downstream_effects.md` entries across the roster, each with its own
   `chapter.thread.entry` number.
3. Invoke `dispatch`. It reviews both the acting agent's new `actions.md`
   entry and whatever `downstream` just wrote, then writes
   `world/dispatch.json`: agents with a fresh `downstream_effects.md` entry
   normally get `mode: "read-downstream"` referencing that entry; agents
   dispatch determines would witness the action directly get
   `mode: "read-actions"` referencing the `actions.md` entry instead; agents
   with a delayed consequence get `availableAt` set per what downstream
   determined about timing; everyone else gets `involved: false`.

Dispatch does not need to re-derive the filtered content itself — that work
is already done. Dispatch's canon review at this stage is a check on
downstream's judgment (did it miss someone, did it write something an agent
couldn't plausibly know), not a duplicate pass from scratch.
