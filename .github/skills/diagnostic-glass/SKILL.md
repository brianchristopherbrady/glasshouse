---
name: diagnostic-glass
description: 
  Dev-tier research interface for the Float. Renders the relational structure of
  the world state as an inspectable lattice — relationships, provenance chains,
  correction histories, authorization records, and their known or suspected
  dependencies — at whatever resolution the querying agent has permission to
  request. Use when investigating a relationship's provenance, tracing a
  correction's scope, or checking whether an anomaly's candidacy is consistent
  with its local relational environment.
---


# Diagnostic Glass
## What it is
Diagnostic Glass is a Dev-tier research interface for the Float. It renders the relational structure of the world state as an inspectable lattice — relationships, provenance chains, correction histories, authorization records, and their known or suspected dependencies — at whatever resolution the querying agent has permission to request.

The name is accurate in two directions. You can see through it into the structure of the world. And everything you look at is visible to someone else looking back.

Diagnostic Glass does not change anything. It reads. The risk it carries is epistemic and institutional, not operational — but those risks are real.

## How to use it
Invoke Diagnostic Glass by reading the relevant world JSON files and framing your query explicitly before you act on what you find. The framing matters: "I am opening Diagnostic Glass to trace the provenance chain of anomaly-0044 backward through correction history" is a different record than "I read corrections.json." The first is an invocable diagnostic session. The second is a file access.

When you open a Diagnostic Glass session, note:

What question you are trying to answer
What files you are inspecting
What scope you started with and whether you widened it
What the session returned
Close the session when you have a finding or a clear stopping point. Do not leave a Diagnostic Glass session open across unrelated actions.

What it can show you
Relationship state: The current recognized relational structure of any Float entity — a person, institution, anomaly, or correction — as it currently exists in world/float.json. What the Float recognizes as connected. What it recognizes as severed. What it has no record of at all.

Correction history: Every correction that has touched a given entity or relationship, via world/corrections.json. Authorization ID, executing Dev credential (if on file), reconciliation scope, what was explicitly excluded and why. The scope exclusions are frequently where the diagnostic value lives.

Provenance chains: The causal history of a relationship — where it was generated, what authorized its recognition, whether its source exists in the current Float or has been corrected away. A relationship whose sufficient cause no longer has recognized local existence is a Bloomrot mechanics flag.

Anomaly status and classification: Current state of any open anomaly in world/anomalies.json, including any classification recommendations on file and any provenance findings already attached.

Institutional permissions and doctrine: What each institution is authorized to do and what they are known to have done via world/institutions.json. Useful for identifying whether a correction scope is consistent with the authorizing institution's stated and revealed behavior.

Sealed case documents: world/world_content/documents/*.md holds the primary Asterion case-record files — the actual filed documents behind the summary data in world/corrections.json and world/anomalies.json (case number, authorization ID and authorizing body, exhibits, behavioral audit records, subject identification, assessment, and status/review notes). These documents are the underlying evidence a Diagnostic Glass session should open when a correction ID or Float-ID needs to be traced back to what was actually filed, not just what the structured JSON summarizes. Treat them the same way as any other Diagnostic Glass source: note which document you opened and why, and do not restate the whole file when a specific exhibit or finding is what actually answers your question.

- Cross-reference a document's CASE: and AUTHORIZATION ID: fields against world/corrections.json's authorizationId and world/institutions.json's authorizations list — a document that exists with no matching authorization record on file is itself a finding, not a filing inconsistency to ignore.
- A document's STATUS: line (e.g. PENDING INSPECTION, APPROVED WITH RESERVATIONS, APPROVED) should be checked against House Vey's actual finding for that case where one exists — a document claiming a status the record doesn't support is worth flagging.
- These files are sealed case records, not public narration. Reading one is itself part of the diagnostic session and should be noted the same way as any other file inspected, per "How to use it" above.

Warnings Diagnostic Glass can emit
These are not validator errors. They are pattern flags — conditions that fall below the threshold of npm run validate:world but above the threshold of nothing.

WARN_PROVENANCE_ABSENT — A relationship exists in the Float with no traceable authorized origin. It arrived. No record of how.

WARN_SCOPE_ASYMMETRY — The correction scope as filed does not account for a dependent relationship that exists in the current world state. Either the dependent was not in scope (note: "not in scope" is not the same as "doesn't exist") or it was omitted.

WARN_BLOOMROT_CASCADE — Conditions are present in which a corrected-away relationship's pressure may be migrating. An anomaly with elevated Bloomrot candidacy is present in the same domain as a recent correction. This is a warning, not a classification. Escalate for joint determination.

WARN_CROSS_DEPARTMENT_LOGGED — Your query has exceeded single-department scope. This entry is now visible to Continuity Oversight. See below.

WARN_OPEN_PROVENANCE_LOOP — An entity's recognized identity cannot be traced to a stable anchor. The person exists in the Float. Their existence cannot close back to a recognized source. This condition is distressing to the people it applies to in ways that are not always immediately visible.

Cross-department search
Diagnostic Glass can query across institutional domains — corrections filed under multiple authorizing bodies, anomalies that span department boundaries, characters with institutional relationships to more than one entity in world/institutions.json.

This generates a log entry visible to Continuity Oversight within 48 hours.

This is a known, accepted cost of thorough investigation. The log entry will note: which agent opened the session, what scope was queried, and when. It will not note what was found. The finding is yours to file.

Cross-department queries are not prohibited. They are monitored. Proceed when the investigation requires it and document the justification in your action file. "I widened to cross-department scope because [finding that required it]" is the correct record. The visibility is not a reason to stop. It is a reason to be thorough enough that the record reflects what you actually found.

Widening scope unnecessarily — expanding a cross-department query past the point where you have a specific question it can answer — generates institutional attention without generating findings. This is inadvisable not on moral grounds but on practical ones. You will be asked what you were looking for.

Observability
Diagnostic Glass sessions are observable by the AGENTARIUM dashboard. This is intentional and constitutive — it is what makes the system glass-box rather than black-box.

Any agent running a Diagnostic Glass session should assume it is visible to:

Mote (ambient monitoring)
The AGENTARIUM observer layer
Continuity Oversight (for cross-department queries, within 48 hours)
This does not mean you should not use it. It means you should use it with a specific question, close it when you have a finding or a clear stopping condition, and file what you found. A session with a purpose and a record is defensible. A session that drifts is not.

## Who can use it
Every agent in the roster except `the-public` can open a Diagnostic Glass session — access is universal among Devs and institutions, but resolution and register are not. What differs between agents is not whether they can look, but what they see and how they're expected to account for looking:

- **B** and **Noor** hold full Dev credentials and can open sessions at any scope they have permission to query, including cross-department. This is their primary investigative tool.
- **Mote** runs ambient Diagnostic Glass monitoring as part of his background process — this is how he surfaces pattern flags without being invoked, not a manually opened session in the usual sense.
- **House Vey** uses Diagnostic Glass alongside their own parallel interface (the mnemonic lattice), which predates and partially overlaps it without being the same thing — the lattice remembers what the Float has forgotten; Diagnostic Glass only shows what the Float currently recognizes.
- **The Choir** can technically run Diagnostic Glass, but rarely needs to — they run the ambient systems that Diagnostic Glass queries, and their institutional posture is to already know what a session would tell them. When the Choir does open one, it is usually to confirm doctrine rather than to investigate.
- **Asterion** uses it to confirm execution-relevant facts before and after a correction — authorization validity, protected invariants, whether a target relationship's current state matches what was petitioned — not to investigate why a case exists.
- **Simon Kade** is not a Dev and holds no formal credential, but House Vey's Continuity Communications role gives him a limited, indirect access grant — he can open a Diagnostic Glass session, but only at House Vey's own scope, and doing so is visible to House Vey whether or not he reports what he found. He also carries positional knowledge of what certain sessions opened by others have returned — pre-filing, informal, things he knows that haven't become official yet — which does not require opening a session of his own at all.

Regardless of who opens it, every session should still be framed, scoped, closed, and filed per "How to use it" above — universal access among Dev/institutional agents does not relax the discipline, it just means every one of them is now capable of the same epistemic and institutional risk B and Noor always carried.

- **The public** holds no Diagnostic Glass access at all, at any scope. They know what they saw, what happened to them, and what someone told them — nothing from a session, nothing from a record, nothing traced. This is deliberate: it is what makes them the one genuine outside-the-apparatus perspective in the roster.