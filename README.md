# Agentic Flows

Observability and visualization for agentic software-development workflows.

Agentic Flows lets engineering teams understand what autonomous or semi-autonomous
agents actually did during a repository workflow: what triggered a run, which
agents and sub-agents participated, what skills were configured versus actually
evidenced as loaded, which tools and MCP servers were called, what files
changed, and what GitHub outputs (PRs, issues, checks) resulted.

The product's core mental model is **definition vs. execution**: the system
separately tracks what a repository *declares* (workflows, agents, skills,
instructions) and what a run *actually did*, with every fact tagged by
evidence source and confidence. Inference is never presented as fact.

## Architecture

```
apps/
  web/      React + TypeScript + Vite + Tailwind + React Router + TanStack Query
  server/   Fastify + TypeScript + Zod + Prisma

packages/
  domain/   Normalized Zod domain model (Repository, WorkflowDefinition,
            AgentDefinition, SkillDefinition, Span, AgentEvent, WorkflowRun,
            evidence/confidence types, redaction service, drift types)
  parser/   Static repository discovery: frontmatter/YAML parsing, a hand-
            rolled file glob matcher, per-definition-type discoverers
            (workflows/agents/skills/instructions/prompts/hooks/MCP servers),
            and relationship extraction (name/path-matched, evidence-tagged,
            never hallucinated from prose similarity)
```

A run is modeled as a tree of **spans** (OpenTelemetry-inspired: id, parentSpanId,
type, actor, start/end, status, attributes, source, confidence), with a parallel
normalized **event stream** for chronological/timeline views. Static repository
definitions (workflows, agents, skills, instructions, hooks, MCP servers) are
kept entirely separate from runtime data and never conflated.

## Tech stack

- **Frontend**: React, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS,
  Lucide icons. (`@xyflow/react` is installed for a future architecture-graph
  view; the Phase 1 build does not yet use it.)
- **Backend**: Node.js, TypeScript, Fastify, Zod, Prisma.
- **Database**: **SQLite** for local development (see note below), swappable to
  PostgreSQL for production via a one-line Prisma datasource change.
- **Testing**: Vitest.
- **Formatting/linting**: ESLint, Prettier.

### Database note: SQLite instead of Docker Compose Postgres

The original spec calls for PostgreSQL via Docker Compose. This machine has
neither Docker nor a usable WSL distribution installed, so local development
uses **SQLite** instead — zero extra installs, same Prisma schema and query
API. Two schema details differ solely because of this substitution:

- All fields that would be a native Prisma `Json` column are declared as
  `String` and JSON-serialized/parsed by hand (`apps/server/src/serialize.ts`,
  `apps/server/prisma/seed.ts`'s `j()` helper) — SQLite's Prisma connector
  does not support the `Json` type.
- `prisma/schema.prisma`'s `datasource` block is `provider = "sqlite"`.

To move to PostgreSQL: install Docker (or a local Postgres), add a
`docker-compose.yml` service, change `provider` to `"postgresql"` in
`apps/server/prisma/schema.prisma`, change the `Json`-eligible `String` fields
back to `Json`, remove the manual `JSON.stringify`/`JSON.parse` calls, and
re-run `prisma migrate dev`.

## Setup

```powershell
npm install
npm run db:migrate --workspace apps/server   # creates apps/server/prisma/dev.db + seeds demo data
npm run dev --workspace apps/server          # Fastify on :4000
npm run dev --workspace apps/web             # Vite on :5173 (proxies /api to :4000)
```

Or build everything and run in production mode:

```powershell
npm run build
npm run start --workspace apps/server
```

The web app has no separate "demo mode" flag — it's simply the only data in
the database until a real GitHub repository is synced. Every demo record goes
through the same Prisma models a live ingestion pipeline would populate.

## Demo data

`apps/server/prisma/seed.ts` seeds a realistic `acme/payments` repository:

- 3 workflow definitions (Issue Triage, Dependency Audit, Documentation Sync),
  each with a compiled `.lock.yml` companion.
- 4 agent definitions (triage-agent, security-reviewer, dependency-agent,
  docs-writer) and 4 skill definitions.
- 15 workflow runs covering: a successful single-agent run, a failed run, a
  multi-agent handoff (triage → security-reviewer), a parallel-agent run
  (dependency-agent + docs-writer overlapping), a deep 3-level handoff chain,
  an unexpected file modification (a real Run Drift finding), a skill that is
  configured but has no runtime evidence (honestly labeled "Unknown", not
  "used"), a tool failure followed by a successful retry, and PR/issue/test
  outcomes throughout.

## Domain model

See [packages/domain/src](packages/domain/src) for the full Zod schemas.
Key types: `Repository`, `WorkflowDefinition`, `CompiledWorkflow`,
`AgentDefinition`, `SkillDefinition`, `InstructionDefinition`,
`DefinitionRelationship` (static architecture graph, always evidence-tagged),
`WorkflowRun`, `Span`, `AgentEvent`, `AgentRun`, `AgentHandoff`, `SkillUsage`,
`FileOperation`, `ToolInvocation`, `DriftFinding`.

Skill usage is deliberately **never** collapsed into a single boolean. It is
tracked as five independent facts: `available`, `configured`, `loaded`,
`referenced`, `executionEvidence` (the latter three are `true | false |
"unknown"`, not just `true | false`) — a skill that is configured in an
agent's frontmatter but never observed executing at runtime is shown as
"Loaded: Unknown", never as "used" or "not used".

## API

REST endpoints served by `apps/server`:

- `GET /api/repositories`, `GET /api/repositories/:repoId`
- `GET /api/repositories/:repoId/{workflows,agents,skills,runs,files,overview,relationships}`
- `POST /api/repositories/:repoId/sync` — discovers static definitions from a
  repository checkout already present on disk (`{ "checkoutDir": "..." }`)
  and persists them. Idempotent (upserts by path); triggerable from the Flows
  page's "Sync from disk" control.
- `GET /api/runs/:runId`
- `GET /api/runs/:runId/{trace,events,files,agents,skills,tools,logs,github,metrics,drift}`
- `POST /api/telemetry/events`, `POST /api/telemetry/batch` — Zod-validated
  ingestion endpoints for the (not-yet-built) runtime telemetry client.

`GET /api/runs/:runId/trace` returns `{ run, trace }` where `trace` is a real
span forest built by `apps/server/src/trace.ts`'s `buildSpanTree` (parent
resolution + start-time sibling sorting), which the web app renders as a
flame-chart in the Run Detail → Trace tab.

## Static repository discovery

`packages/parser`'s `discoverRepository(rootDir)` mechanically walks a
repository checkout and discovers:

- `.github/workflows/*.md` (+ paired `.lock.yml` compiled workflow, if present)
- `.github/agents/*.md`
- `SKILL.md` under `.github/skills/`, `.agents/skills/`, or `.claude/skills/`
  (plus sibling scripts/resources in the same folder)
- `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`,
  `AGENTS.md`
- `.github/prompts/*.prompt.md`
- `.github/hooks/*.json`
- `.vscode/mcp.json`

Relationships between definitions (`COMPILES_TO`, `CONFIGURES`, `CAN_CALL`)
are only emitted when backed by a concrete match — a workflow's `.lock.yml`
found alongside it (`observed` confidence), or an agent's frontmatter naming
a skill/MCP server that was *also* independently discovered (`strong`
confidence, since a rename could desync the two). An agent referencing a
skill name that doesn't resolve to any discovered `SKILL.md` produces no
relationship at all — the UI (Agents page) shows this explicitly as "Not
resolved to a discovered SKILL.md" rather than silently linking it.

`apps/server/src/sync.ts`'s `syncRepositoryFromDisk` persists discovery
results via upsert-by-path, so re-syncing an unchanged repo is a no-op
diff-wise. This is filesystem-only — it does not clone or fetch a remote
repository (see Known limitations).

## Known limitations (Phase 1 scope)

Per the spec's phased build order, this pass stops after Phase 1: monorepo
init, domain model, seed data, application shell, Overview, Runs, and one
excellent Run Detail trace experience — all on demo data. **Not yet built**:

- GitHub API integration (live repository sync from a *remote*, Actions run
  ingestion) — the `api.ts` adapter-method shape described in the spec is not
  implemented yet. Static discovery today only reads a checkout already
  present on the local filesystem (see "Static repository discovery" above).
- The runtime telemetry client package (`packages/telemetry-client`) and the
  `.agentic-telemetry/events.ndjson` file-based ingestion path — only the HTTP
  `/api/telemetry/*` endpoints exist so far.
- The correlation engine that merges GitHub Actions + git + telemetry into one
  `WorkflowRun`.
- The static architecture graph explorer (React Flow node/edge view of
  Workflow/Agent/Skill/Instruction/Hook/MCP relationships) — relationships are
  discovered and queryable via the API today, but not yet visualized as a graph.
- Secret redaction is implemented (`packages/domain/src/redaction.ts`,
  `redactSecrets`) but not yet wired into any log/tool-argument display path.
- Mock/live GitHub mode toggle, workflow manual-trigger action.

As documented in the product spec: GitHub Actions alone will not expose every
internal agent event (model calls, skill context loading, sub-agent
orchestration, tool calls) — high-fidelity views require runtime telemetry or
structured artifacts, which is why the telemetry ingestion endpoints exist
independently of the GitHub adapter.

## Development commands

```powershell
npm run typecheck   # tsc -b across all workspaces
npm run lint        # eslint .
npm test            # vitest run (packages/domain, packages/parser, apps/server)
npm run build       # builds every workspace (domain/parser dist, server dist, web dist)
```
