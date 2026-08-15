Yes. I’d make the IDE build the whole thing as a **real instrumented agent playground**, not a dashboard that pretends to observe agents. I verified the current VS Code primitives first: workspace custom agents live under `.github/agents`, project skills can live under `.github/skills`, MCP config can live in `.vscode/mcp.json`, and current hooks expose lifecycle events including `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `SubagentStart`, `SubagentStop`, `PreCompact`, and `Stop`. Custom agents can restrict tools and define handoffs, while Skills are loaded on demand and can use isolated/forked context. ([Visual Studio Code][1])

The important design choice below is that the UI never lies about “reading the AI’s mind.” It visualizes **observable events**, plus concise decision summaries the agent explicitly emits. That distinction will make the project much more credible.

# Build AGENTARIUM

## A Glass-Box Laboratory for Watching Agentic AI Work

Act as a senior AI systems architect, developer-tools engineer, interaction designer, frontend engineer, and agent-platform engineer.

Build the complete application described below in this repository.

Do not create a mockup.

Do not create a static architecture diagram.

Do not merely scaffold files and tell me how the rest could work.

The finished repository must be an actual interactive demonstration of modern agentic AI concepts:

* agents
* custom agents
* subagents
* skills
* prompt files
* repository instructions
* scoped instructions
* hooks
* tool calls
* MCP
* handoffs
* file access
* context routing
* validation
* failures
* retries
* self-correction
* agent permissions
* planning
* execution
* review
* replay
* observability

The central goal is simple:

> Make normally invisible agent behavior visible.

This repository should be useful as an educational artifact, portfolio project, developer tool experiment, and reference implementation for understanding how modern coding agents actually move through a task.

---

# THE PRODUCT

Call the project:

# AGENTARIUM

Subtitle:

**A glass-box laboratory for agentic software.**

The application lets someone give an AI coding agent a task and then watch the resulting agent activity unfold visually in real time.

The agent itself works inside a deliberately absurd fictional repository called:

# The Bureau of Impossible Geography

The fictional world exists purely to give the agents something entertaining and understandable to reason about.

The real product is the observability system.

---

# THE CORE IDEA

Most agentic AI demos show:

```text
prompt
↓
magic
↓
code
```

AGENTARIUM should show:

```text
prompt
↓
agent selected
↓
instructions applied
↓
available skills considered
↓
skill accessed
↓
files searched
↓
files read
↓
subagent spawned
↓
tool selected
↓
tool executed
↓
hook fired
↓
result observed
↓
plan changed
↓
file edited
↓
validation failed
↓
agent investigated
↓
repair performed
↓
validation passed
↓
task completed
```

The application should make this sequence spatial, temporal, inspectable, and replayable.

---

# IMPORTANT TRUTHFULNESS RULE

Do NOT pretend this application can expose private model chain-of-thought.

Do not label anything:

> Hidden reasoning

or:

> Actual thoughts

or anything similarly misleading.

Instead distinguish between:

### Observable activity

Things the system actually knows occurred:

* hook fired
* tool invoked
* file read
* file written
* command executed
* subagent started
* MCP tool called
* validation failed
* validation succeeded

### Agent-declared decisions

Concise structured summaries deliberately emitted by the agent, such as:

```json
{
  "decision": "Consult temporal-physics skill",
  "reason": "The request changes the location of a weekday rather than a physical object.",
  "next": "Inspect the world's temporal topology.",
  "confidence": 0.82
}
```

These are explanations produced for observability.

They are NOT private chain-of-thought.

### Inferred activity

Something AGENTARIUM derives from evidence.

For example:

> SKILL.md was read immediately before the cartography operation.

This may suggest a Skill was being used, but unless the runtime directly reports Skill activation, label it:

**Inferred**

rather than:

**Observed**

This distinction is extremely important.

The UI should visually distinguish:

```text
OBSERVED
DECLARED
INFERRED
```

Never manufacture certainty.

---

# THE FICTIONAL WORLD

The playground inside AGENTARIUM is:

# The Bureau of Impossible Geography

This is a tiny fictional world represented by ordinary repository files.

Example:

```text
world/
├── world.json
├── geography.json
├── municipalities.json
├── creatures.json
├── temporal-laws.json
├── physical-laws.json
├── bureaucratic-law.json
└── history/
```

The world should intentionally contain strange but internally consistent rules.

Examples:

* Tuesday has a geographic location.
* The Moon may apply for municipal status.
* Forests can acquire legal classifications.
* Some roads only exist when nobody is traveling on them.
* One mountain migrates annually.
* Circular structures require permits.
* A snail runs the Department of Taxation.
* Rivers may file appeals.
* Weather can be subpoenaed.
* Bridges can connect semantically related locations even when geographically separated.

Keep the actual world small.

Do not write a novel.

We need enough interconnected rules to force interesting agent behavior.

---

# EXAMPLE TASKS

Create reusable prompt files for entertaining scenarios such as:

### Moon Municipality

> The Moon has applied for municipal status. Approve the application and update everything affected without violating celestial zoning law.

### Move Tuesday

> Tuesday is causing congestion. Move it three kilometers east.

### Soup Forest

> The Blue Forest has been legally classified as soup. Update all affected systems while preserving ecological continuity.

### Outlaw Circles

> The mayor has outlawed circles. Determine what breaks and bring the city into compliance.

### Impossible Bridge

> Build a bridge between two locations that cannot physically touch.

### Tax Snail

> The municipal tax snail has resigned. Determine which services cease functioning and appoint the least disastrous replacement.

These prompts should be funny, but their real purpose is to trigger:

* file discovery
* Skill selection
* multiple domains
* delegation
* contradiction detection
* validation
* recovery

Store them as real reusable VS Code prompt files where appropriate.

---

# WHY THE WORLD IS ABSURD

The nonsense is intentional.

A normal repository forces the viewer to understand:

```text
React
database architecture
product requirements
business rules
company history
```

before understanding what the agent is doing.

The Bureau of Impossible Geography gives us concepts that are immediately understandable.

Someone can watch:

```text
Moon
↓
municipal law
↓
temporal physics
↓
cartography
↓
world validation
```

and understand why an agent explored those branches.

The ridiculous domain makes the agent architecture easier to see.

---

# AGENT ARCHITECTURE

Create real custom agents.

Use thematic names, but make each one's engineering responsibility obvious.

Recommended agents:

```text
.github/agents/
├── bureau-chief.agent.md
├── world-smith.agent.md
├── surveyor.agent.md
├── impossible-clerk.agent.md
├── naturalist.agent.md
├── chronologist.agent.md
└── inspector.agent.md
```

---

# BUREAU CHIEF

The orchestrator.

Responsibilities:

* understand user objective
* inspect available context
* decide whether specialists are needed
* delegate independent investigations
* combine findings
* decide when implementation can begin
* track acceptance criteria
* initiate review/verification

It should generally avoid directly editing large portions of the world.

It coordinates.

Give it access to appropriate read/search/subagent tools, but intentionally restrict unnecessary powers where supported.

---

# WORLD SMITH

The implementation agent.

Responsibilities:

* modify repository files
* implement approved world changes
* run targeted commands
* respond to validation failures
* make repairs
* finish implementation

This agent gets editing tools.

---

# SURVEYOR

Spatial/cartographic specialist.

Handles:

* geography
* boundaries
* roads
* bridges
* location relationships
* impossible spatial topology

It should have access to the relevant cartography Skill.

---

# IMPOSSIBLE CLERK

Legal/bureaucratic specialist.

Handles:

* municipal law
* classifications
* permits
* administrative dependencies
* snail-related taxation matters

---

# NATURALIST

Ecology specialist.

Handles:

* creatures
* forests
* rivers
* migration
* ecosystems
* interactions between bizarre organisms

---

# CHRONOLOGIST

Temporal specialist.

Handles:

* weekdays
* temporal geography
* chronology
* temporal contradictions
* events that occur out of order

---

# INSPECTOR

Independent reviewer and QA agent.

Responsibilities:

* inspect resulting world
* challenge assumptions
* run validation
* identify contradictions
* verify requested task
* report failures
* refuse to approve an inconsistent world

The Inspector should be slightly adversarial.

It should not merely congratulate the World Smith.

---

# SUBAGENTS

Demonstrate real subagent behavior.

For a complex request, the Bureau Chief should be able to do something like:

```text
                   BUREAU CHIEF
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
    SURVEYOR         CLERK         CHRONOLOGIST
        │               │               │
        │               │               │
   geography         law          temporal rules
        │               │               │
        └───────────────┼───────────────┘
                        ▼
                 combined findings
                        │
                        ▼
                  WORLD SMITH
```

Parallelize investigations only when they are actually independent.

Do not spawn subagents merely because the feature exists.

---

# HANDOFFS

Where supported, define meaningful agent handoffs.

Example:

```text
Bureau Chief
    ↓
World Smith
    ↓
Inspector
```

Or:

```text
Bureau Chief
    ↓
Surveyor
    ↓
World Smith
```

Expose these handoffs in the visualization when observable.

---

# SKILLS

Create real Agent Skills.

Use:

```text
.github/skills/
```

Recommended Skills:

```text
.github/skills/
├── impossible-cartography/
│   └── SKILL.md
├── municipal-law/
│   └── SKILL.md
├── creature-ecology/
│   └── SKILL.md
├── temporal-physics/
│   └── SKILL.md
├── contradiction-resolution/
│   └── SKILL.md
└── world-validation/
    ├── SKILL.md
    └── scripts/
```

Each Skill should be small, useful, and genuinely different.

A Skill should contain specialized knowledge or workflow.

Do not simply write:

> You are an expert in cartography.

For example:

`impossible-cartography/SKILL.md` should describe:

* world coordinate conventions
* semantic bridges
* geographic invariants
* allowed topology mutations
* validation procedure

`temporal-physics/SKILL.md` should describe:

* temporal coordinates
* weekday location rules
* chronology constraints
* paradox handling

`world-validation/SKILL.md` should describe:

* how to run the validator
* what constitutes a valid world
* how failures should be repaired

---

# SKILL OBSERVABILITY

AGENTARIUM must show:

### Skills available

The repository scanner can deterministically discover:

```text
.github/skills/*/SKILL.md
```

Display these around the active agent as inactive nodes.

### Skills accessed

If the system directly observes `SKILL.md` being read, a Skill script being invoked, or another reliable runtime signal, display that activity.

### Skills inferred active

If direct runtime evidence is unavailable but nearby evidence strongly suggests usage, label it:

**INFERRED**

Do NOT claim:

> Skill loaded

without evidence supporting that claim.

Display provenance in the inspector.

Example:

```text
Temporal Physics

STATUS
Inferred active

EVIDENCE
SKILL.md read at 00:14.211
chronologist started at 00:14.450
temporal-laws.json read at 00:15.002
```

This evidentiary approach should be used throughout AGENTARIUM.

---

# PROMPT FILES

Create real reusable prompt files for the scenarios.

For example:

```text
.github/prompts/
├── moon-municipality.prompt.md
├── move-tuesday.prompt.md
├── soup-forest.prompt.md
├── outlaw-circles.prompt.md
└── impossible-bridge.prompt.md
```

The README should explain how to invoke them.

---

# REPOSITORY INSTRUCTIONS

Create:

```text
AGENTS.md
```

Keep it concise.

It should establish global world engineering rules and explain:

* inspect before editing
* do not falsify trace data
* use specialists appropriately
* emit decision summaries at major decision points
* run world validation before completion
* respond to failures rather than bypassing them
* distinguish observation from inference

Do not put every domain rule in `AGENTS.md`.

Put specialized knowledge in Skills.

---

# SCOPED INSTRUCTIONS

Create scoped instruction files where useful.

Examples:

```text
.github/instructions/
├── world.instructions.md
├── tests.instructions.md
└── observability.instructions.md
```

Use them only where applicable.

Demonstrate context routing instead of creating one enormous system prompt.

---

# DECISION TELEMETRY

Create a local mechanism allowing agents to deliberately emit concise decision summaries.

Preferably expose it as an MCP tool:

```text
agentarium.trace_decision
```

Arguments:

```ts
{
  decision: string;
  reason: string;
  next?: string;
  alternatives?: string[];
  confidence?: number;
}
```

Example:

```json
{
  "decision": "Delegate municipal classification to the Impossible Clerk",
  "reason": "The Moon's location is already valid; legal status is now the blocking uncertainty.",
  "next": "Wait for classification requirements.",
  "alternatives": [
    "Inspect bureaucratic-law.json directly"
  ],
  "confidence": 0.91
}
```

Do not require agents to emit one before every tool call.

That would become noise.

Emit these at meaningful transitions:

* major interpretation
* specialist selection
* plan change
* failure diagnosis
* implementation strategy
* final completion decision

Visualize decision summaries as distinct nodes.

---

# MCP SERVER

Build a small local MCP server for the Impossible World.

Suggested name:

```text
impossible-world
```

Configure it through:

```text
.vscode/mcp.json
```

Expose a useful but small set of capabilities.

Possible resources:

```text
world://summary
world://laws
world://geography
world://history
```

Possible tools:

```text
inspect_world
validate_world
find_dependencies
trace_decision
```

Optional:

```text
simulate_change
```

Do NOT move all repository operations behind MCP.

We want normal file access to remain visible too.

MCP should demonstrate what MCP contributes, not replace the filesystem.

---

# HOOKS

Hooks are one of the most important parts of the project.

Create:

```text
.github/hooks/
```

Instrument useful lifecycle events.

At minimum capture:

```text
SessionStart
UserPromptSubmit
PreToolUse
PostToolUse
SubagentStart
SubagentStop
PreCompact
Stop
```

Use supported hook schemas.

Do not invent hook events.

---

# HOOK EVENT PIPELINE

Each hook should invoke a shared script.

For example:

```text
scripts/agentarium-hook.mjs
```

The hook script should:

1. Read hook JSON from stdin.
2. Determine hook type.
3. Normalize it into an AGENTARIUM event.
4. Redact sensitive values.
5. Append it to the current session JSONL trace.
6. Best-effort POST it to the running collector server.
7. Produce valid hook output expected by VS Code.
8. Never corrupt the agent session merely because the dashboard is not running.

Tracing must fail gracefully.

The agent should continue working if AGENTARIUM is closed.

---

# EVENT ARCHITECTURE

Make AGENTARIUM event-sourced.

Everything should become an event.

Define something similar to:

```ts
interface AgentariumEvent {
  id: string;
  sessionId: string;

  timestamp: string;
  durationMs?: number;

  type: AgentEventType;

  actor?: {
    id: string;
    kind:
      | "agent"
      | "subagent"
      | "skill"
      | "tool"
      | "hook"
      | "user"
      | "system";
    name?: string;
  };

  parentId?: string;

  source:
    | "hook"
    | "mcp"
    | "filesystem"
    | "agent-declared"
    | "system"
    | "demo";

  evidence:
    | "observed"
    | "declared"
    | "inferred";

  label: string;

  metadata?: Record<string, unknown>;

  raw?: unknown;
}
```

Create a clear union for event types.

Possible event types:

```text
session.started
prompt.received

agent.started
agent.stopped

subagent.started
subagent.stopped

decision.declared

skill.discovered
skill.accessed
skill.inferred

file.read
file.written
file.searched

tool.requested
tool.started
tool.completed
tool.failed

mcp.resource.read
mcp.tool.called

hook.started
hook.completed

validation.started
validation.passed
validation.failed

context.changed

world.changed

task.completed
```

Only emit an event type when you actually have evidence for it.

Store raw evidence when safe.

---

# EVENT STORE

Persist sessions as append-only JSONL.

For example:

```text
.agentarium/
├── sessions/
│   ├── 2026-08-12T11-03-22Z.jsonl
│   └── ...
└── current-session.json
```

Add:

```text
.agentarium/
```

to `.gitignore`.

The application should reconstruct views from the event log.

This makes replay straightforward.

---

# REAL-TIME ARCHITECTURE

Use this flow:

```text
VS CODE AGENT
      │
      │
      ├──────── hook event
      │
      ▼
agentarium-hook.mjs
      │
      ├──────── append JSONL
      │
      └──────── HTTP POST
                     │
                     ▼
             COLLECTOR SERVER
                     │
                     ▼
                EVENT BUS
                     │
                     ▼
                    SSE
                     │
                     ▼
               REACT CLIENT
```

Prefer Server-Sent Events unless bidirectional communication materially requires WebSockets.

SSE is sufficient for live event streaming.

---

# APPLICATION TECH STACK

Use:

* React
* TypeScript
* Vite
* Node.js
* Express or another tiny Node HTTP server
* SSE
* `@xyflow/react` / React Flow for the primary live graph
* Zod for event/schema validation
* a lightweight YAML parser where needed
* native CSS or CSS modules
* Vitest

Use additional small dependencies only when justified.

Avoid:

* Next.js
* giant UI frameworks
* database servers
* cloud requirements
* Docker as a prerequisite
* unnecessary state-management frameworks

This should run entirely locally.

---

# RUNNING THE PROJECT

I want this to work with:

```bash
npm install
npm start
```

`npm start` should launch:

1. the AGENTARIUM collector/server
2. the Vite frontend

Use `concurrently` or an equally simple mechanism if necessary.

The terminal should print useful URLs.

Example:

```text
AGENTARIUM
Dashboard: http://localhost:5173
Collector: http://localhost:4317
```

Ports may differ.

Keep configuration centralized.

---

# FRONTEND EXPERIENCE

The interface should feel like:

* scientific instrument
* strange museum exhibit
* developer observability console
* living circuit diagram
* field notebook from an impossible bureaucracy

Not:

* generic SaaS dashboard
* admin panel
* crypto terminal
* giant table of logs
* childish cartoon interface

Make it strange, clean, precise, and tactile.

---

# PRIMARY SCREEN

Desktop concept:

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ AGENTARIUM                  LIVE ●                  SESSION 03 • 00:18.42 │
├─────────────────┬─────────────────────────────────────────┬───────────────┤
│                 │                                         │               │
│ IMPOSSIBLE      │              LIVE AGENT GRAPH           │   INSPECTOR   │
│ WORLD           │                                         │               │
│                 │               USER                      │  selected:    │
│ Moon            │                │                        │  tool call    │
│ Blue Forest     │                ▼                        │               │
│ Tuesday         │          BUREAU CHIEF                   │  source       │
│ Tax Snail       │             /      \                    │  evidence     │
│                 │        SURVEYOR    CLERK                │  input        │
│ current state   │            │        │                   │  output       │
│                 │         SKILL     SKILL                 │  duration     │
│                 │            \        /                   │               │
│                 │           WORLD SMITH                   │               │
│                 │                │                        │               │
│                 │             VALIDATE                    │               │
│                 │                │                        │               │
│                 │             FAILED                      │               │
│                 │                │                        │               │
│                 │              REPAIR                     │               │
│                 │                                         │               │
├─────────────────┴─────────────────────────────────────────┴───────────────┤
│ LIVE GRAPH │ TIMELINE │ FILES │ SKILLS │ TOOLS │ CONTEXT │ REPLAY │ RUNS │
└───────────────────────────────────────────────────────────────────────────┘
```

Do not copy this literally.

Use it as the information architecture.

---

# LIVE AGENT GRAPH

This is the centerpiece.

Use React Flow.

Nodes should appear as events happen.

Node types:

### User

Prompt origin.

### Agent

Bureau Chief, World Smith, etc.

### Subagent

Specialist instance.

### Skill

Available/accessed/inferred.

### Tool

Filesystem, terminal, MCP tool, etc.

### File

Only show important files in the central graph.

### Hook

Visually distinct.

### Decision

Agent-declared summary.

### Validation

Pass/fail.

Connections should represent causality when known.

Do not draw fake causal arrows.

If causality is uncertain, represent chronological association differently.

---

# GRAPH ANIMATION

When an event occurs:

* node gently appears
* relevant edge animates briefly
* current actor receives a subtle pulse
* completed nodes settle
* failed validation becomes visibly distinct
* repair branches visibly loop back

Avoid constant particle animation.

The graph should feel alive without becoming visual soup.

Respect reduced-motion preferences.

---

# EVENT INSPECTOR

Click any node.

The right panel shows:

```text
TYPE
PostToolUse

ACTOR
World Smith

TIME
00:14.221

DURATION
382 ms

EVIDENCE
Observed

SOURCE
VS Code Hook

TOOL
editFiles

FILES
world/municipalities.json

RESULT
Completed
```

Provide:

**Raw Event**

as an expandable section.

This is important for credibility.

Someone should be able to see exactly why AGENTARIUM believes something happened.

---

# TIMELINE

Create a horizontal or vertically stacked timeline.

Example:

```text
00s       05s       10s       15s       20s

USER ━━━┓
        ┗ BUREAU CHIEF ━━━━━━━┓
                              ├ SURVEYOR ━━━━━┓
                              └ CLERK ━━━━━━━━┫
                                              ┗ WORLD SMITH
                                                   │
                                                VALIDATE ✕
                                                   │
                                                 REPAIR
                                                   │
                                                VALIDATE ✓
```

Allow zooming or expanding dense runs.

Clicking timeline items selects the corresponding graph event.

---

# FILE HEATMAP

Create a Files view.

Example:

```text
world/
  geography.json         ██████████  5 reads
  municipalities.json    ███████     3 reads
  temporal-laws.json     ████        2 reads
  creatures.json         ░           unread
```

Click a file to show:

```text
READ 5 TIMES

00:03 Bureau Chief
00:06 Surveyor
00:11 World Smith
...

WRITTEN 1 TIME

00:18 World Smith
```

Where evidence is available, show:

* tool
* agent
* timestamp
* operation

Do not claim precise line ranges unless those are actually present in telemetry.

---

# SKILLS VIEW

Make Skill behavior extremely understandable.

Display:

```text
AVAILABLE SKILLS

○ impossible-cartography
○ municipal-law
○ creature-ecology
○ temporal-physics
○ contradiction-resolution
○ world-validation
```

As evidence arrives, statuses change.

For example:

```text
● municipal-law
  accessed

◐ temporal-physics
  inferred

○ creature-ecology
  available
```

Clicking one shows:

* description
* path
* agent(s) associated
* access timestamps
* evidence
* resources/scripts included
* whether status is observed or inferred

This screen should be able to teach someone what an Agent Skill is without reading documentation.

---

# TOOLS VIEW

Show available versus used tools.

Example:

```text
FILESYSTEM
✓ read
✓ search
✓ edit

TERMINAL
✓ npm test

MCP: IMPOSSIBLE WORLD
✓ inspect_world
✓ validate_world
○ find_dependencies

AGENT
✓ spawn_subagent

BLOCKED
× destructive-shell
```

Allow clicking a used tool to see calls.

---

# AGENTS VIEW

Show all configured agents and their responsibilities.

Example:

```text
BUREAU CHIEF

role
orchestrator

tools
search
read
agent

subagents
surveyor
clerk
naturalist
chronologist

current state
active
```

Make tool restrictions visible.

This is a teaching feature.

---

# CONTEXT VIEW

Do NOT claim access to exact model token context unless the runtime actually provides it.

Instead show the known context sources.

For example:

```text
KNOWN CONTEXT SOURCES

AGENTS.md                    active
world.instructions.md       active
municipal-law/SKILL.md      accessed
world/geography.json        read
world/municipalities.json   read
conversation                present
```

If token counts are known, show them.

If not known, do NOT fabricate percentages.

Use:

```text
size unavailable
```

where necessary.

This entire application should prefer an honest blank over invented telemetry.

---

# WORLD VIEW

Provide a small visualization of the Impossible World.

It does not need to become a real GIS application.

A whimsical node/map visualization is enough.

Show entities such as:

```text
Moon
Tuesday
Blue Forest
Municipality 7
Tax Snail
Migrating Mountain
```

Relations can include:

```text
located-in
governed-by
feeds
occurs-after
taxes
legally-classified-as
connected-to
```

When agents modify the world, animate the affected relations subtly.

This lets the viewer connect agent behavior to its consequences.

---

# WORLD VALIDATOR

Build a deterministic validator.

This is extremely important.

Create rules such as:

```text
Every municipality requires a jurisdiction.

A celestial body cannot become a municipality
unless celestial zoning approval exists.

Every weekday must have exactly one temporal coordinate.

A legally-soup forest must still declare ecological substrate.

Bridges require valid endpoints.

Every tax authority must have exactly one collector.

No circle may exist while circle prohibition is active
unless it has a grandfathered permit.
```

The actual rules can be strange.

They must be deterministic.

Run:

```bash
npm run validate:world
```

The validator should return non-zero on failure.

---

# EXPECTED FAILURES

Design some scenarios where the obvious first change violates another rule.

This produces genuinely interesting agent behavior.

Example:

User asks:

> Make the Moon a municipality.

World Smith changes:

```text
municipalities.json
```

Validator responds:

```text
WORLD INVALID

MOON:
Municipality requires zoning jurisdiction.

Celestial zoning approval not found.
```

The agent must then investigate.

Perhaps it loads municipal law.

Perhaps it delegates.

Perhaps it discovers:

```text
bureaucratic-law.json
```

Then repairs the world.

This creates:

```text
IMPLEMENT
↓
VALIDATE
↓
FAIL
↓
INVESTIGATE
↓
NEW CONTEXT
↓
REPAIR
↓
VALIDATE
↓
PASS
```

That loop is one of the most important things AGENTARIUM should demonstrate.

---

# HOOK VISUALIZATION

Hooks should appear as small gate nodes.

Example:

```text
WORLD SMITH
     │
     ▼
 edit file
     │
     ▼
┌─────────────┐
│ POST TOOL   │
│    HOOK     │
└──────┬──────┘
       │
       ▼
  type check
```

Clicking shows:

```text
HOOK
PostToolUse

PURPOSE
Record completed tool usage and trigger targeted validation.

INPUT
<safe normalized payload>

RESULT
success
```

This should make hooks intuitive.

---

# OBSERVABILITY PROVENANCE

Every displayed event must show provenance.

Use small badges:

```text
OBSERVED
DECLARED
INFERRED
DEMO
```

Suggested meanings:

### OBSERVED

Direct event received from a hook, tool, filesystem event, MCP server, or validator.

### DECLARED

Agent intentionally emitted a decision summary.

### INFERRED

AGENTARIUM derived a likely relationship from observable data.

### DEMO

Synthetic sample trace used for demonstration.

Do not blur these categories.

---

# LIVE MODE

When a real VS Code agent session is using the repository:

AGENTARIUM should update automatically.

No refresh.

New events appear live.

Graph updates.

Timeline extends.

Inspector remains interactive.

If the viewer selects an old event, do not constantly steal selection as new events arrive.

Provide:

```text
Follow Live
```

toggle.

---

# DEMO MODE

The project must remain demonstrable even when no agent session is currently running.

Ship at least two prerecorded traces.

Example:

```text
demo/
├── moon-municipality.jsonl
└── move-tuesday.jsonl
```

Add:

**Play Demo**

The exact same UI should replay these traces.

Clearly label:

```text
DEMO TRACE
```

Do not pretend prerecorded events are live.

This is essential for portfolio/demo usability.

---

# REPLAY

Every real run should be replayable.

Add:

```text
REPLAY
```

with:

```text
◀──────────────●────────────────────────▶
00:00          00:17                    00:41
```

Scrubbing reconstructs:

* active graph
* events
* agents
* Skill status
* tool usage
* files touched
* world state when possible

Provide:

* play
* pause
* speed
* step event
* jump to failure
* jump to decision

---

# RUN COMPARISON

Implement a lightweight comparison mode.

Choose two sessions.

Show:

```text
RUN A                      RUN B

22.4 sec                   14.8 sec

18 tool calls              11 tool calls

7 files read               4 files read

2 subagents                1 subagent

3 skills accessed          2 skills accessed

2 validation failures      0 validation failures

1 repair loop              0 repair loops
```

Also show notable strategy differences.

Do not ask an LLM to invent these differences.

Derive them from event logs.

---

# SESSION SUMMARY

At completion, compute deterministic metrics:

* duration
* agents used
* subagents spawned
* files read
* files written
* tools used
* hooks fired
* Skill evidence
* validation failures
* repair loops
* final status

Display a simple final card.

---

# TRACE SECURITY

Observability must not become credential exfiltration.

Before storing telemetry:

Redact likely:

* API keys
* bearer tokens
* passwords
* `.env` values
* authorization headers
* cookies
* obvious secrets

Avoid storing enormous tool responses.

Truncate large payloads.

Provide:

```text
payload truncated
```

when appropriate.

Do not read `.env` merely for visualization.

---

# FILESYSTEM WATCHER

Optionally use a small filesystem watcher for the fictional world.

If `world/*.json` changes:

emit:

```text
world.changed
```

This gives the UI an independent deterministic signal that the world changed.

Do not infer which agent changed it unless tool telemetry provides that information.

---

# UI VISUAL LANGUAGE

Make this beautiful.

Desired feeling:

**museum of computation + botanical specimen cabinet + strange government observatory**

Use:

* warm paper-like neutrals
* charcoal
* dusty greens
* amber
* muted violet
* restrained red for failures
* tiny labels
* monospaced telemetry text
* humanist UI typography
* thin connector lines
* small status lights
* subtle paper/grid texture if tasteful

No neon matrix aesthetic.

No generic Tailwind dashboard.

No giant glowing AI brain.

No robot illustrations.

No gradient-purple SaaS nonsense.

The intelligence should come from the information design.

---

# MICROCOPY

Use strange but restrained language.

Examples:

Empty trace:

> Nothing is thinking where we can see it.

Waiting:

> The Bureau is quiet.

Validation passed:

> Reality remains provisionally legal.

Validation failed:

> Reality has developed an administrative problem.

No Skill activity:

> All specialist manuals remain closed.

No subagents:

> No additional bureaucrats have been summoned.

Demo mode:

> Replaying a previously documented incident.

Do not put a joke in every sentence.

---

# REPOSITORY STRUCTURE

Aim for something like:

```text
agentarium/
├── AGENTS.md
├── package.json
├── README.md
├── .gitignore
│
├── .github/
│   ├── agents/
│   │   ├── bureau-chief.agent.md
│   │   ├── world-smith.agent.md
│   │   ├── surveyor.agent.md
│   │   ├── impossible-clerk.agent.md
│   │   ├── naturalist.agent.md
│   │   ├── chronologist.agent.md
│   │   └── inspector.agent.md
│   │
│   ├── skills/
│   │   ├── impossible-cartography/
│   │   │   └── SKILL.md
│   │   ├── municipal-law/
│   │   │   └── SKILL.md
│   │   ├── creature-ecology/
│   │   │   └── SKILL.md
│   │   ├── temporal-physics/
│   │   │   └── SKILL.md
│   │   ├── contradiction-resolution/
│   │   │   └── SKILL.md
│   │   └── world-validation/
│   │       ├── SKILL.md
│   │       └── scripts/
│   │
│   ├── prompts/
│   │   ├── moon-municipality.prompt.md
│   │   ├── move-tuesday.prompt.md
│   │   ├── soup-forest.prompt.md
│   │   ├── outlaw-circles.prompt.md
│   │   └── impossible-bridge.prompt.md
│   │
│   ├── instructions/
│   │   ├── world.instructions.md
│   │   ├── observability.instructions.md
│   │   └── tests.instructions.md
│   │
│   └── hooks/
│       └── agentarium.json
│
├── .vscode/
│   └── mcp.json
│
├── world/
│   ├── world.json
│   ├── geography.json
│   ├── municipalities.json
│   ├── creatures.json
│   ├── temporal-laws.json
│   ├── physical-laws.json
│   ├── bureaucratic-law.json
│   └── history/
│
├── server/
│   ├── index.ts
│   ├── collector.ts
│   ├── eventStore.ts
│   ├── redaction.ts
│   ├── replay.ts
│   └── session.ts
│
├── mcp/
│   ├── server.ts
│   ├── tools/
│   └── resources/
│
├── scripts/
│   ├── agentarium-hook.mjs
│   ├── validate-world.ts
│   └── seed-demo.ts
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── graph/
│   ├── timeline/
│   ├── inspector/
│   ├── skills/
│   ├── files/
│   ├── tools/
│   ├── agents/
│   ├── world/
│   ├── replay/
│   ├── runs/
│   ├── events/
│   ├── api/
│   └── styles/
│
├── demo/
│   ├── moon-municipality.jsonl
│   └── move-tuesday.jsonl
│
└── tests/
```

Adjust intelligently.

Avoid pointless file fragmentation.

---

# PACKAGE SCRIPTS

Provide at minimum:

```json
{
  "scripts": {
    "start": "concurrently -k \"npm:server\" \"npm:client\"",
    "client": "vite",
    "server": "tsx server/index.ts",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "validate:world": "tsx scripts/validate-world.ts"
  }
}
```

Adjust as required by the final architecture.

The important requirement is:

```bash
npm install
npm start
```

works.

---

# TESTING

Write tests for the important deterministic pieces.

At minimum:

### Event normalization

Hook input becomes the expected AGENTARIUM event.

### Redaction

Secrets are removed.

### Event storage

JSONL append/read works.

### Replay

Reconstructing events up to timestamp works.

### World validation

Known valid world passes.

Known invalid worlds fail.

### Metrics

Session metrics are calculated correctly.

### Provenance

Inferred events cannot accidentally be marked observed.

---

# README

Write a README that immediately explains the idea.

Suggested opening:

# AGENTARIUM

AGENTARIUM is a glass-box laboratory for observing coding agents.

It instruments agent lifecycle hooks, tools, subagents, repository Skills, MCP interactions, file activity, validation, and explicit decision summaries, then renders those events as a live interactive graph.

The included fictional repository, **The Bureau of Impossible Geography**, exists purely to make agent behavior easy and entertaining to observe.

Then explain:

## What You're Looking At

## Live Agent Graph

## Agents

## Skills

## Hooks

## MCP

## Decision Summaries

## Observed vs Declared vs Inferred

## Impossible Geography

## Run It

```bash
npm install
npm start
```

## Try a Scenario

Explain how to invoke one of the provided prompts in VS Code.

## Replay Mode

## Architecture

## Limitations

Be explicit that AGENTARIUM does not expose private chain-of-thought.

That honesty is important.

---

# DOCUMENT THE ARCHITECTURE

Create:

```text
docs/architecture.md
```

Include:

```text
Agent Runtime
     │
     ▼
VS Code Hooks ─────────┐
                      │
MCP Server ────────────┤
                      ▼
                 Event Normalizer
                      │
                  Event Store
                      │
             ┌────────┴────────┐
             ▼                 ▼
          JSONL               SSE
                               │
                               ▼
                         React Client
                               │
       ┌──────────┬────────────┼───────────┐
       ▼          ▼            ▼           ▼
     Graph     Timeline      Skills      Replay
```

Also document provenance.

---

# BUILD ORDER

Follow this order.

Do not begin with polish.

## Phase 1

Create the fictional world.

Build deterministic world validator.

Make:

```bash
npm run validate:world
```

work.

## Phase 2

Create normalized event schema.

Create JSONL event store.

Create tests.

## Phase 3

Implement hook collector.

Confirm hook payloads become events.

## Phase 4

Implement server and SSE.

Create a manual endpoint or script to inject development events.

## Phase 5

Build basic React UI.

Show incoming event list.

## Phase 6

Build live graph.

## Phase 7

Build timeline and inspector.

## Phase 8

Build custom agents, Skills, prompts, and scoped instructions.

## Phase 9

Build MCP server and decision telemetry.

## Phase 10

Build Files, Skills, Tools, Agents, and Context views.

## Phase 11

Build replay.

## Phase 12

Add demo traces.

## Phase 13

Add run comparison.

## Phase 14

Polish interaction/design.

## Phase 15

Run actual agent scenarios and fix instrumentation gaps.

---

# REAL-WORLD VERIFICATION

This is critical.

After implementation:

1. Run:

```bash
npm test
npm run build
npm run validate:world
```

2. Run:

```bash
npm start
```

3. Confirm dashboard opens.

4. Generate test events.

5. Verify they arrive live.

6. Run a real agent task if the environment supports it.

7. Verify:

* hook events appear
* subagent events appear when used
* tool calls appear
* file operations appear where observable
* decision summaries appear
* validation failures appear
* repair activity appears
* completion appears

8. Reload the dashboard.

9. Verify previous session can be replayed.

10. Play a demo trace.

11. Verify demo mode is clearly labeled.

Do not declare completion simply because the TypeScript compiler passes.

---

# DEFINITION OF DONE

The project is finished when:

* `npm install` succeeds
* `npm start` works
* tests pass
* build passes
* world validator works
* dashboard renders
* SSE live stream works
* hook event collector works
* event data persists as JSONL
* live graph works
* timeline works
* event inspector works
* raw event evidence is inspectable
* agents view works
* Skills view works
* tools view works
* files view works
* replay works
* at least two demo traces work
* custom agents exist
* real Skills exist
* real prompt files exist
* hooks are configured
* MCP server exists
* decision telemetry exists
* deterministic validation can fail
* a failure can produce a visible repair loop
* provenance distinguishes observed/declared/inferred/demo
* no private chain-of-thought claims are made
* secrets are redacted
* README explains everything
* architecture documentation exists
* UI feels deliberate rather than autogenerated

---

# MOST IMPORTANT PRODUCT PRINCIPLE

Do not build:

> an AI dashboard.

Build:

> an interactive scientific instrument for watching agency emerge from context, instructions, tools, specialization, delegation, observation, and feedback.

The fictional world is the specimen.

The agent runtime is the organism.

Hooks and telemetry are the microscope.

The event log is the evidence.

The live graph is what lets a human finally see the shape of what happened.

Make it weird.

Make it rigorous.

Make it understandable.

And above all, make it real.

[1]: https://code.visualstudio.com/docs/agents/reference/hooks-reference "Hooks reference"
