You are designing and building a developer tool tentatively called **Flowbook**.

Flowbook should feel conceptually similar to Storybook, but instead of documenting and testing UI components, it documents, visualizes, runs, traces, tests, and debugs **agentic AI systems**.

The core idea is:

> Flowbook is an interactive explorer and debugger for agentic systems that turns agents, prompts, instructions, skills, tools, artifacts, handoffs, evaluations, scenarios, and runtime traces into an understandable visual system.

Do not treat this primarily as a drag-and-drop workflow builder.

The source repository should remain the source of truth.

Flowbook is primarily a **lens over the actual codebase**.

---

# PRODUCT MODEL

The most important distinction in the entire application is between:

## Blueprint

What the agent system is designed to do.

This comes from static analysis of the repository.

Example:

User Request
→ Builder Agent
→ Builder can reference Instructions
→ Builder can use Prompt
→ Builder can invoke Skill 1
→ Skill 1 can modify Document 1
→ Builder can invoke Skill 2
→ Skill 2 can run tests
→ Builder can hand off to Auditor Agent
→ Auditor can invoke Audit Skill
→ Audit Skill evaluates the resulting changes

This represents architecture and possibility.

## Run Trace

What actually happened during one specific execution.

Example:

User Request
→ Builder started
→ Prompt resolved
→ repository inspection skill executed
→ Button.tsx modified
→ tests failed
→ Builder resumed
→ Button.tsx modified again
→ tests passed
→ Builder handed context to Auditor
→ Auditor invoked audit skill
→ audit passed
→ workflow completed

This represents history and observed behavior.

Never collapse these concepts into one graph.

The Blueprint answers:

> How is this system designed?

The Run answers:

> What actually happened?

---

# DISTRIBUTION / ARCHITECTURE

Flowbook should be **package-first, browser-workbench-first, VS Code-extension-second**.

Do NOT build the entire product as a VS Code extension.

The preferred architecture is:

```text
Repository
    │
    ▼
@flowbook/core
    │
    ├── repository indexer
    ├── resource discovery
    ├── blueprint builder
    ├── workflow runner
    ├── trace collector
    ├── artifact tracker
    ├── evaluation runner
    └── local server
            │
            ▼
http://localhost:4300
            │
            ▼
Flowbook Browser Workbench
```

Users should install Flowbook similarly to Storybook:

```bash
npm install -D @flowbook/core @flowbook/cli
```

Initialize:

```bash
npx flowbook init
```

Run:

```bash
npm run flowbook
```

Flowbook should launch a local browser application.

Later, also create:

```text
@flowbook/vscode
```

The VS Code extension should be a thin bridge that provides:

* resource explorer
* commands
* source navigation
* “Open in Flowbook”
* “Run current workflow”
* “Run affected scenarios”
* “View last run”
* “Open source from Flowbook”

Do not make VS Code the primary visualization surface.

The graph, traces, diffs, comparisons, and execution debugging need more space than an IDE sidebar provides.

---

# PACKAGE ARCHITECTURE

Design the repository so the system can eventually support:

```text
@flowbook/core
@flowbook/cli
@flowbook/ui

@flowbook/openai-agents
@flowbook/langgraph
@flowbook/opentelemetry

@flowbook/vscode
```

The core package should know nothing about React.

It should understand a canonical domain model.

---

# CORE DOMAIN MODEL

Flowbook should normalize agent systems into these concepts:

```typescript
type Resource =
  | Workflow
  | Agent
  | Prompt
  | Instruction
  | Skill
  | Tool
  | Artifact
  | Evaluation
  | HumanGate;
```

Relationships should be semantic:

```typescript
type RelationshipType =
  | "references"
  | "uses"
  | "invokes"
  | "reads"
  | "writes"
  | "modifies"
  | "produces"
  | "validates"
  | "handsOff"
  | "branchesTo"
  | "dependsOn";
```

Possible runtime state:

```typescript
type RunState =
  | "idle"
  | "queued"
  | "running"
  | "waiting"
  | "success"
  | "failure"
  | "skipped";
```

---

# VISUAL HIERARCHY

Do NOT display every resource as an equally important node.

That will create graph spaghetti.

Use the following hierarchy.

## Agents are containers.

An Agent owns or references:

* instructions
* prompt templates
* skills
* tools
* model configuration
* handoff definitions

Example:

```text
┌─────────────────────────────────┐
│ BUILDER AGENT                   │
│                                 │
│ Model: GPT-5.x                  │
│                                 │
│ Configuration                   │
│ Instructions: builder.md        │
│ Prompt: implementation-v7       │
│                                 │
│ Capabilities                    │
│ inspect-repository              │
│ modify-document                 │
│ run-tests                       │
│                                 │
│ Handoffs                        │
│ → Auditor                       │
└─────────────────────────────────┘
```

Instructions and prompts should generally appear as metadata/chips attached to an Agent rather than giant graph nodes.

The user can click them to inspect their definitions.

---

# PROMPTS

Every prompt must support two views:

```text
Template
Resolved
```

Template:

What exists in source.

Resolved:

Exactly what the model received during a particular run after variables, context, artifact references, and runtime values were inserted.

This is extremely important.

Developers need to see the actual model input, not merely the prompt template.

---

# INSTRUCTIONS

Instructions should work similarly.

Show:

* source file
* version/hash
* agent using them
* durable definition
* resolved instructions for a particular execution

---

# SKILLS

Skills represent reusable procedural capabilities.

Examples:

```text
inspect-repository
modify-document
run-tests
accessibility-audit
review-changes
```

Skills may use lower-level Tools.

Example:

```text
run-tests
   │
   ├── shell
   ├── vitest
   └── repository-reader
```

Do not treat Skills and Tools as interchangeable.

A Skill describes capability/behavior.

A Tool performs an executable action.

---

# ARTIFACTS

Artifacts should exist outside Agents because they represent shared state.

Examples:

* source files
* documentation
* databases
* generated reports
* images
* Figma data
* test snapshots
* tickets
* structured outputs

Example relationship:

```text
Builder ──writes────┐
                    ▼
                 Button.tsx
                    ▲
Auditor ──reads─────┘
```

An Artifact inspector should answer:

* who created it?
* who modified it?
* who read it?
* when?
* which Skill caused the change?
* what changed?
* what downstream agents saw this version?

Example:

```text
Button.tsx

Observed during Run #184

14:08:12
Builder
Skill: modify-document
+31 / -12

14:08:17
Test Runner
read

14:08:24
Auditor
read

[View Diff]
```

Artifact provenance is a major product feature.

---

# HANDOFFS

Agent handoffs must be first-class objects.

Do not represent them as anonymous arrows.

Example:

```text
Builder ═════════════▶ Auditor
            HANDOFF
```

Clicking the handoff should display:

```text
From:
Builder

To:
Auditor

Reason:
Implementation completed

Transferred:

✓ Original request
✓ Implementation summary
✓ Changed files
✓ Artifact diffs
✓ Test results
✓ Relevant metadata
✓ Selected conversation context

Excluded:

○ Unrelated browser history
○ Full tool history
○ Unrelated artifacts
```

Also allow inspection of:

* exact context payload
* receiving agent prompt
* runtime metadata
* handoff condition
* source definition

The question Flowbook should answer is:

> What slice of reality did Agent A give Agent B?

---

# MAIN APPLICATION LAYOUT

Design one primary workbench.

Do not create a SaaS dashboard as the homepage.

Preferred composition:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ FLOWBOOK   Project ▾  Branch ▾  Scenario ▾   Blueprint Run Compare │
│                                                       ▶ Run         │
├────────────────┬───────────────────────────────────┬────────────────┤
│ EXPLORER       │ WORKSPACE                         │ INSPECTOR      │
│                │                                   │                │
│ Workflows      │ workflow architecture / trace     │ selected       │
│ Agents         │                                   │ resource       │
│ Skills         │                                   │ details        │
│ Prompts        │                                   │                │
│ Instructions   │                                   │                │
│ Tools          │                                   │                │
│ Artifacts      │                                   │                │
│ Evaluations    │                                   │                │
│ Runs           │                                   │                │
├────────────────┴───────────────────────────────────┴────────────────┤
│ TRACE | MESSAGES | ARTIFACTS | EVALUATIONS | LOGS | COST           │
└─────────────────────────────────────────────────────────────────────┘
```

The graph is important but it is not the entire application.

---

# EXPLORER

The left navigation should feel similar to Storybook's resource browser.

Example:

```text
Search resources...

WORKFLOWS
▾ Document Refactor
    Happy Path
    Tests Fail
    Audit Rejects

▾ Design-to-Code
    Basic Component
    Complex Component

AGENTS
    Builder
    Auditor
    Planner
    Accessibility Reviewer

SKILLS
    inspect-repository
    modify-document
    run-tests
    accessibility-audit

PROMPTS
    implementation
    remediation
    review

INSTRUCTIONS
    builder
    auditor

ARTIFACTS
    Button.tsx
    design-system.md

EVALUATIONS
    Unit Tests
    Accessibility
    Audit

RUNS
    Today
    Yesterday
```

Add excellent fuzzy/global search.

Eventually support a command palette.

---

# SCENARIOS

A Scenario is Flowbook's equivalent of a Storybook Story.

Example:

```typescript
export const happyPath = scenario({
  workflow: documentRefactor,

  input: {
    request: "Update the Button component."
  },

  mocks: {
    figma: "fixtures/button.json"
  },

  expectations: {
    tests: "pass",
    accessibility: "pass"
  }
});
```

Other scenarios:

* Happy Path
* Tests Fail
* Missing Documentation
* Audit Rejects
* Missing Tool
* Ambiguous Requirement
* Human Approval Required
* Large Repository
* Tool Timeout
* Model Failure

Scenarios should be reproducible.

---

# CONTROLS

Like Storybook Args/Controls, expose scenario inputs.

Example:

```text
SCENARIO CONTROLS

Request
[ Refactor Button.tsx... ]

Model
[ GPT-5.x ▼ ]

Repository
[ current worktree ▼ ]

Mock browser
[✓]

Mock external APIs
[✓]

Failure injection
[ None ▼ ]

Run
```

Allow:

```text
Run with changes
Save as scenario
Reset
```

---

# WORKSPACE MODES

The central workspace should support:

```text
[ Blueprint ] [ Run ] [ Compare ]
```

## Blueprint

Shows possible architecture.

## Run

Shows the actual path for one execution.

## Compare

Shows differences between two executions.

---

# SEMANTIC ZOOM

Do not render every internal detail all the time.

Use progressive detail.

## Level 0

Only major actors:

```text
Input
 ↓
Builder
 ↓
Auditor
 ↓
Result
```

## Level 1

Capabilities and artifacts:

```text
Builder
 ├─ inspect
 ├─ modify → Button.tsx
 ├─ tests
 └─ handoff → Auditor
```

## Level 2

Full internals:

* prompts
* instructions
* model turns
* tools
* artifact operations
* evaluations
* guardrails
* handoff payloads

Allow a control such as:

```text
Detail:
[ Agents ] [ Capabilities ] [ Everything ]
```

---

# EDGES

Edges must communicate semantics.

Never display anonymous arrows.

Examples:

```text
Agent ──uses────→ Skill

Skill ──invokes─→ Tool

Skill ──writes──→ Artifact

Agent ──reads───→ Artifact

Evaluation ──validates→ Artifact

Agent ══handoff══▶ Agent
```

Hovering or selecting an edge should explain why it exists.

---

# BLUEPRINT VS OBSERVED RELATIONSHIPS

Visually distinguish possible relationships from observed relationships.

For example:

```text
- - - - - - → possible from source

───────────→ observed historically

═══════════→ observed in current run
```

Unused paths in Run mode should remain visible but subdued.

This allows users to understand both what could have happened and what did happen.

---

# RUNNING REAL FLOWS

Flowbook must execute workflows against the actual repository or an isolated worktree/sandbox.

Do not merely animate a predefined diagram.

Static repository analysis builds the Blueprint.

Runtime instrumentation builds the Run Trace.

Example runtime events:

```text
workflow.started
agent.started
instructions.resolved
prompt.resolved
generation.started
generation.completed
skill.started
skill.completed
tool.called
tool.completed
artifact.read
artifact.modified
evaluation.started
evaluation.completed
handoff.started
handoff.completed
agent.completed
workflow.completed
```

The UI consumes these normalized events.

---

# LIVE EXECUTION EXPERIENCE

When running:

```text
Builder Agent                RUNNING

inspect-repository           ✓
        │
        ▼
model turn                   ✓
        │
        ▼
modify-document              ✓
        │
        └────→ Button.tsx    MODIFIED
        │
        ▼
run-tests                    ● RUNNING
```

If tests fail:

```text
run-tests                    ✕ FAILED

Button.test.tsx
Expected accessible name
Received undefined
```

Then if the agent retries:

```text
Tests ✕
  │
  ▼
Builder resumes
  │
  ▼
modify-document ✓
  │
  ▼
Tests ✓
  │
  ▼
handoff → Auditor
```

Do not erase failed or recursive execution paths.

The actual trace is the product.

---

# SYNCHRONIZED EXECUTION VIEWS

The same underlying Run should support:

```text
[ Map ] [ Sequence ] [ Timeline ]
```

## Map

Shows causal relationships.

## Sequence

Shows communication over time:

```text
User       Builder       Tests       Auditor

 │──────────>│
 │           │──run──────>│
 │           │<──fail─────│
 │           │──run──────>│
 │           │<──pass─────│
 │           │──────────────────────>│
```

## Timeline / Trace

Example:

```text
00:00.000 Workflow started
00:00.021 Builder started
00:00.043 Instructions resolved
00:00.081 Prompt resolved
00:01.433 Model response
00:01.449 modify-document started
00:02.119 Button.tsx modified
00:02.174 tests started
00:04.981 tests passed
00:05.011 handoff → Auditor
```

Selecting an event in one representation should highlight the corresponding object everywhere else.

---

# TRACE WATERFALL

Also support a waterfall trace view:

```text
Workflow       █████████████████████

 Builder         ███████████
  Model            ████
  Skill             ███
   Artifact           █
  Tests                ████

 Auditor                     █████
  Audit                        ███
```

This allows developers to find latency bottlenecks.

---

# INSPECTOR

The right panel should adapt to the selected resource.

Agent example:

```text
Builder Agent

Status
Success

Model
GPT-5.x

Duration
4.91s

Tokens
7,291

Tabs:

Definition
Instructions
Prompt
Inputs
Outputs
Skills
Tools
Context
Runs
Source
```

Skill example:

```text
SKILL
modify-document

Version
4

Source
.agents/skills/modify-document/SKILL.md

Used by
Builder
Migration Agent

Inputs
document
requestedChanges

Outputs
documentRevision
summary
```

Handoff example:

```text
Builder → Auditor

Condition
tests.status === "passed"

Context
[Inspect Payload]

Observed
91 / 96 runs

Current Run
Taken at 14:32:08

Source
src/workflows/refactor.ts:118
```

---

# SOURCE PROVENANCE

Every important relationship should link to both static source and runtime evidence.

Example:

Click:

```text
Builder → Auditor
```

Flowbook should answer:

```text
WHY DOES THIS EDGE EXIST?

Definition
src/workflows/refactor.ts:118

Condition
tests.status === "passed"

Historically observed
91 / 96 runs

Current run
Taken at 16:32:08

Context transferred
[Inspect]

Receiving prompt
[Inspect]

Open source
[Open in IDE]
```

This is one of the main product differentiators.

---

# EVALUATIONS

Evaluations are first-class resources.

Examples:

```text
✓ Unit Tests                 118 / 118
✓ TypeScript                 0 errors
✓ Accessibility              Passed
✓ Design System Compliance   94 / 100
⚠ Documentation              1 warning
✓ Agent Audit                Passed
```

An evaluation can influence branching.

Example:

```text
Tests
  ├── PASS → Auditor
  └── FAIL → Builder resumes
```

---

# FAILURE UX

Failure information should be explicit.

Example:

```text
Skill: run-tests

FAILED

Expected
118 passing

Actual
117 passing
1 failing

Failure
Button.test.tsx
"should expose accessible name"

[View Test]
[View Artifact]
[Re-run From Here]
```

---

# REPLAY / FORKING

Completed runs should be immutable.

But allow users to fork execution from an intermediate point.

Example:

```text
Run #184

Builder
  ↓
Tests FAILED
  ↓
[Fork From Here]
```

The new run should inherit captured state up to that point.

Allow changing:

* model
* prompt
* instructions
* context
* skill
* tool response
* artifact
* scenario input

Then resume.

---

# RUN COMPARISON

Compare two runs.

Example:

```text
Run #184                 Run #185

Prompt v3                Prompt v4

Builder 4.2s             Builder 3.8s

Button.tsx
+42 -17                  +31 -12

Tests
FAILED                   PASSED

Auditor
not executed             executed
```

Also explicitly show path differences:

```text
Run #184
Builder → edit → tests → FAIL

Run #185
Builder → edit → tests → Auditor → PASS
```

---

# IMPACT ANALYSIS

One of the long-term killer features should be dependency-aware regression testing.

If someone modifies:

```text
.agents/skills/a11y/SKILL.md
```

Flowbook should determine:

```text
Used by
3 agents

Affected workflows
7

Affected scenarios
19

Last baseline
18 / 19 passing

Recommended action
Run affected scenarios
```

Eventually:

```bash
flowbook test --affected
```

This transforms Flowbook from a visualizer into actual agent infrastructure.

---

# AUTOMATIC DOCUMENTATION

Every resource should automatically receive documentation derived from source metadata.

Example:

```text
Builder Agent

Purpose
Implements requested repository changes.

Model
GPT-5.x

Instructions
builder.md

Capabilities
• inspect-repository
• modify-document
• run-tests

Handoffs
→ Auditor

Reads
Repository

Writes
Source files
Documentation

Scenarios
Happy Path
Test Failure
Audit Rejection
```

---

# FRAMEWORK INDEPENDENCE

Do not tightly couple Flowbook to one AI framework.

Use adapter packages.

Potential adapters:

```text
@flowbook/openai-agents
@flowbook/langgraph
@flowbook/opentelemetry
```

The adapter's responsibility is to convert framework-specific behavior into Flowbook's canonical resource and event model.

---

# TRACE MODEL

Internally model each Workflow Run as a Trace.

Operations become Spans.

Example:

```text
Workflow Run = Trace

Agent = Span
Model generation = Span
Skill = Span
Tool = Span
Evaluation = Span
Handoff = Span
Artifact write = Span/Event
```

Prefer compatibility with OpenTelemetry rather than inventing an entirely proprietary telemetry transport.

Flowbook adds domain semantics on top:

```text
generic tracing
+
agent resource metadata
+
repository provenance
+
artifact relationships
=
Flowbook execution model
```

---

# CONFIGURATION

Aim for minimal configuration.

Example:

```typescript
export default defineFlowbook({
  workflows: [
    "src/workflows/**/*"
  ],

  agents: [
    "src/agents/**/*"
  ],

  skills: [
    ".agents/skills/**/*"
  ],

  prompts: [
    "src/prompts/**/*"
  ],

  adapters: [
    openAIAgents(),
    openTelemetry()
  ]
});
```

Use conventions and adapters to discover as much as possible automatically.

---

# VS CODE EXTENSION

The extension is secondary.

It should provide:

```text
FLOWBOOK

WORKFLOWS
▾ Document Refactor
  ○ Happy Path
  ○ Tests Fail

AGENTS
▾ Builder
▾ Auditor

SKILLS
▾ inspect-repository
▾ run-tests
```

Commands:

```text
Flowbook: Open Workbench
Flowbook: Run Current Workflow
Flowbook: Run Affected Scenarios
Flowbook: Inspect Agent
Flowbook: Inspect Skill
Flowbook: Show Last Run
```

Add:

```text
Open in Flowbook
```

from source code.

And from Flowbook:

```text
Open Source in IDE
```

Deep-link to the exact file and line.

---

# DO NOT BUILD THESE FIRST

Avoid the temptation to start with:

* drag-and-drop workflow editing
* hosted SaaS dashboards
* arbitrary workflow code generation
* team analytics
* organization administration
* huge observability dashboards
* production monitoring

Those may come later.

First prove the development interaction.

---

# MVP

Build one vertical slice.

Use this example workflow:

```text
User Request
   ↓
Builder Agent

Builder references:
- builder instructions
- implementation prompt

Builder invokes:
1. inspect-repository
2. modify-document

Artifact:
Button.tsx modified

Builder invokes:
3. run-tests

If tests fail:
Builder resumes → modify-document → tests again

If tests pass:
Builder hands off to Auditor

Handoff includes:
- original request
- implementation summary
- Button.tsx diff
- test results
- relevant metadata

Auditor invokes:
audit-changes

Auditor returns:
PASS / FAIL
```

Build this end to end.

MVP requirements:

## 1. Repository resource model

Represent:

* workflow
* 2 agents
* instructions
* prompts
* skills
* tools
* artifact
* test evaluation
* handoff
* audit evaluation

## 2. Explorer

Browse those resources.

## 3. Blueprint graph

Show the intended relationships.

## 4. Scenario

Create Happy Path.

## 5. Run button

Execute a real mocked or local workflow through a runner abstraction.

## 6. Streaming execution

Send normalized events to the browser.

## 7. Live graph

Highlight the currently running operations.

## 8. Inspector

Inspect every resource and event.

## 9. Artifact diff

Show Button.tsx before/after.

## 10. Handoff inspector

Show exact context transferred.

## 11. Trace

Display chronological execution events.

---

# UI TECHNOLOGY

Frontend:

```text
React
TypeScript
```

Graph:

```text
@xyflow/react
```

Use automatic hierarchical layout.

Prefer ELK or similar rather than requiring users to manually organize nodes.

State:

```text
Zustand
```

Server state:

```text
TanStack Query
```

Streaming:

```text
SSE or WebSocket
```

Editor/diff:

```text
Monaco
```

Do not over-engineer initially.

---

# DESIGN LANGUAGE

This should look like serious developer tooling.

Avoid:

* rainbow cards
* generic no-code workflow aesthetics
* oversized gradients
* excessive glow
* unnecessary animation
* giant decorative empty spaces

Use:

* neutral surfaces
* excellent typography
* strong information hierarchy
* subtle node categorization
* semantic icons
* restrained state colors
* clear selected/running/failure states

The product should feel closer to:

```text
Storybook
browser DevTools
distributed tracing
Git diff tooling
IDE inspectors
```

than:

```text
Zapier
Miro
marketing SaaS dashboard
```

---

# IMPORTANT UX PRINCIPLE

At every level Flowbook should answer:

> What is this thing?

> What can it touch?

> Why is it connected to that thing?

> What did it receive?

> What did it produce?

> What source code defines it?

> What happened during this run?

> What happened next because of it?

---

# CORE DIFFERENTIATOR

The graph itself is not the product.

Plenty of systems can draw boxes and arrows.

The differentiator is:

> Every visible relationship can be connected to the source definition that created it and the runtime evidence proving what actually occurred.

For example:

```text
Agent 1 → Skill 2
```

should be inspectable as:

```text
DEFINED BY

src/agents/builder.ts:84

CURRENT RUN

Run #184
Invoked at 14:32:08.123

INPUT

{
  "document": "Button.tsx"
}

OUTPUT

{
  "testsPassed": true
}

ARTIFACT EFFECT

Button.tsx
+31 / -12
```

That combination of:

```text
architecture
+
source
+
execution
+
context
+
artifacts
+
evaluation
```

is the actual product.

---

# PRODUCT POSITIONING

The simplest product description should remain:

> Flowbook is Storybook for agentic systems.

A more accurate description:

> Flowbook is a local interactive explorer and debugger for agentic systems that discovers agents, prompts, instructions, skills, tools, artifacts, evaluations, and handoffs from the repository, lets developers execute reproducible scenarios against the real codebase, and visualizes exactly what happened during each run.

Architecture summary:

> The package is the engine.
> The browser is the workbench.
> The VS Code extension is the bridge.
> A future hosted service can become the team's shared execution history.

---

# YOUR TASK

Before implementing significant UI code:

1. Inspect the existing repository.
2. Determine the cleanest package/workspace architecture.
3. Design the canonical Flowbook data model.
4. Design the normalized runtime event model.
5. Determine how repository discovery should work.
6. Determine how a workflow runner should emit events.
7. Design the Blueprint / Run distinction.
8. Design the resource hierarchy so the graph does not become cluttered.
9. Design the first vertical slice described above.
10. Then implement it.

Do not immediately produce arbitrary components without first understanding the architecture.

When making product decisions, optimize for:

* comprehensibility
* inspectability
* source provenance
* runtime causality
* progressive disclosure
* framework independence
* reproducibility
* debugging usefulness

The goal is not to make agents look impressive.

The goal is to make complicated agentic systems **understandable**.
