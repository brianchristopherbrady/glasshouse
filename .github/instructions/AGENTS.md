# AGENTS.md — The Float

This repository is the fictional world AGENTARIUM observes: Meridian, governed
by the Float, the Foam, the Choir, Chrysanthemum, and Bloomrot. Follow these
rules whenever you act as an agent inside it.

## Before editing

- Read the relevant `world/*.json` file(s) before changing them. Do not assume
  what a relationship's status, an institution's permissions, or an anomaly's
  classification says — check it.
- If the request spans more than one domain (relational mechanics,
  institutional provenance, correction authorization, Bloomrot classification),
  delegate to the relevant specialist agent rather than guessing outside your
  expertise.

## Honesty about observability

- Do not falsify trace data. If you emit a decision summary (via
  `trace_decision` when available), it must reflect a decision you
  actually made, with a real reason — not a plausible-sounding fabrication.
- Distinguish observation from inference in anything you report. If you did
  not directly read a file or receive a tool result, do not claim you did.
- Remember this world's central premise: **the validator can say PASSED and
  still be wrong.** A clean validator run means the correction is
  structurally sound, not that it was wise, or that nothing was left behind.

## Specialists and delegation

- Use B and Noor for domain-specific investigation (relational mechanics /
  anomaly structure, and institutional provenance research, respectively).
  Use Asterion Dev for implementation and House Vey for independent review.
  The Choir authorizes; it does not investigate. Use The Public for the
  population-level texture of a correction or anomaly — the employees,
  bystanders, and social-media noise around an event — which no other agent
  can plausibly generate, since it holds no Dev credential and no
  institutional access.
- Do not do another agent's job just because you technically have the tools —
  restricted tool access exists on purpose. Only Asterion Dev may edit
  `world/*.json`.

## Decision summaries

- Emit a decision summary at meaningful transitions: interpreting the request,
  choosing a specialist, changing plan, diagnosing a failure, or deciding the
  task is complete. Do not emit one before every tool call — that's noise, not
  observability.

## Validation

- Run `npm run validate:world` before considering any world-changing task
  complete. Any `ERR_*` issue means the task is not done.
- `WARN_*` issues (`WARN_BLOOMROT_CASCADE`, `WARN_AFFINITY_UNRESOLVED`) do not
  block validation — they require an explicit human/institutional decision,
  recorded, not silently resolved away.
- Respond to a validation failure by investigating and repairing it. Do not
  bypass, weaken, or edit the validator to make a failure disappear.

## Scope

- Domain-specific knowledge (correction mechanics, provenance audit, Bloomrot
  classification, Chrysanthemum practice, correction debt, validation
  procedure) lives in `.github/skills/`, not here. Consult the relevant Skill
  instead of guessing.
