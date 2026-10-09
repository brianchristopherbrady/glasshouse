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

## Local demo: Agentic City

`examples/agentic-city` is a small text-only city run by Copilot agents (Mayor,
City Planner, Building Inspector, Treasurer, Town Crier) that delegate to each
other and edit Markdown files. Agent hooks record every chat with them, so
Agentic Flows shows each prompt as a run: agents, handoffs, skills, and every
changed file as a diff.

```bash
npm run demo              # web UI on http://localhost:5410, API on 127.0.0.1:4410
code examples/agentic-city
# in Copilot Chat (Local agent): /found-district Noodle Heights, built on a retired noodle factory
npm run city:replay       # no Copilot? play a scripted session through the same recorder
npm run city:reset        # restore the city to its committed state
```

See [examples/agentic-city/README.md](examples/agentic-city/README.md) for details.

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
  Lucide icons, `@xyflow/react` (architecture graph).
- **Backend**: Node.js, TypeScript, Fastify, Zod, Prisma.
- **Database**: **SQLite** by default (zero-install), **PostgreSQL** for
  production — selected automatically from `DATABASE_URL`.
- **Testing**: Vitest (unit + integration against real databases), Playwright (E2E).
- **Formatting/linting**: ESLint, Prettier.

### Database

`apps/server/prisma/schema.prisma` (SQLite) is the canonical schema.
`prisma/postgres/schema.prisma` is generated from it by
`npm run db:sync-postgres --workspace apps/server` and has its own migration
history under `prisma/postgres/migrations`. JSON-shaped columns are stored as
`String` and (de)serialized in `apps/server/src/serialize.ts`, which works on
both providers. CI fails if the two schemas or either migration history drift
(`npm run db:check`, plus a real PostgreSQL job).

When changing the schema: edit `schema.prisma`, run `prisma migrate dev` for
SQLite, run `db:sync-postgres`, and add the matching Postgres migration with
`prisma migrate diff --from-migrations prisma/postgres/migrations
--to-schema-datamodel prisma/postgres/schema.prisma --shadow-database-url <pg>
--script`.

## Install and run

### As a package

```bash
npm install -g @brianbrady/glasshouse
AGENTIC_FLOWS_API_TOKEN=<long-random-string> agentic-flows
```

The `agentic-flows` CLI creates a data directory (`~/.agentic-flows`, or
`AGENTIC_FLOWS_DATA_DIR`), generates the database client for the configured
provider if needed, applies migrations, and serves the API and web UI on one
port (`PORT`, default 4000). Other commands: `agentic-flows ingest <file.ndjson>
[--url <server>]`, `agentic-flows generate` (pre-generate the database client,
e.g. at image build time), `--version`, `--help`.

### With Docker (app + PostgreSQL)

```bash
cp .env.example .env    # set POSTGRES_PASSWORD and AGENTIC_FLOWS_API_TOKEN
docker compose up -d --build
```

The image runs as a non-root user, exposes a `/api/ready` healthcheck, and
shuts down gracefully on `SIGTERM` (drains requests, closes the database,
flushes error reports).

### Local development

```powershell
npm install
npm run db:migrate --workspace apps/server   # creates apps/server/prisma/dev.db + seeds demo data
npm run dev --workspace apps/server          # Fastify on :4000
npm run dev --workspace apps/web             # Vite on :5173 (proxies /api to :4000)
```

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | `file:…` (SQLite) or `postgresql://…`. Defaults to SQLite in the data dir. |
| `AGENTIC_FLOWS_API_TOKEN` | Bootstrap admin token. **When unset, authentication is disabled** (local use only). |
| `AGENTIC_FLOWS_ALLOWED_ORIGINS` | Comma-separated CORS allowlist (default `http://localhost:5173`). |
| `AGENTIC_FLOWS_TRUST_PROXY` | `true` behind a reverse proxy, so rate limits key on the real client IP. |
| `AGENTIC_FLOWS_RATE_LIMIT_PER_MINUTE` | Global per-IP API limit (default 600; stricter limits apply to expensive routes). |
| `AGENTIC_FLOWS_GITHUB_TOKEN` | GitHub personal access token for API calls and cloning. |
| `AGENTIC_FLOWS_GITHUB_APP_ID`, `AGENTIC_FLOWS_GITHUB_APP_PRIVATE_KEY` (or `_PATH`) | GitHub App credentials; preferred over a PAT when set. |
| `AGENTIC_FLOWS_GITHUB_WEBHOOK_SECRET` | Required to accept GitHub webhooks (unsigned deliveries are always rejected). |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | Optional error monitoring; secrets are redacted before events leave the server. |
| `PORT`, `HOST`, `AGENTIC_FLOWS_DATA_DIR` | Listen address and data directory. |

## Security model

- **Authentication**: bearer tokens. The bootstrap admin token comes from
  `AGENTIC_FLOWS_API_TOKEN`; admins issue per-person/per-integration tokens in
  **Settings** (or `POST /api/tokens`). Only a SHA-256 hash is stored and the
  plaintext is shown once. The web UI asks each user for their own token and
  keeps it only in that browser.
- **Roles**: `admin` (everything), `viewer` (read-only), `ingest` (telemetry
  only, optionally restricted to one repository). The full policy is one
  function: `requiredRoles` in `apps/server/src/auth.ts`.
- **Transport/browser hardening**: CORS allowlist, strict Content-Security-Policy
  (inline scripts allowed only by exact hash), `X-Frame-Options: DENY`,
  `nosniff`, `no-referrer`; rate limiting; 5xx responses never include internal
  error details.
- **Secrets in data**: tokens/keys are redacted from span attributes, event data,
  tool arguments/results, logs, and diffs before display, and from error reports.
- **GitHub**: webhook payloads are HMAC-verified; clone credentials are passed
  via git's environment config, never in a URL or command-line argument.

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
- `GET /api/repositories/:repoId/{workflows,agents,skills,runs,files,overview,relationships,architecture}`
- `POST /api/repositories/:repoId/sync` — discovers static definitions from a
  repository checkout already present on disk (`{ "checkoutDir": "..." }`)
  and persists them. Idempotent (upserts by path); triggerable from the Flows
  page's "Sync from disk" control.
- `GET /api/runs/:runId`
- `GET /api/runs/:runId/{trace,events,files,agents,skills,tools,logs,github,metrics,drift}`
- `POST /api/telemetry/events`, `POST /api/telemetry/batch` (max 1000) —
  runtime telemetry ingestion via the correlation engine (see below).
- `POST /api/repositories/github`, `POST /api/repositories/:repoId/github-runs/sync`,
  `POST /api/webhooks/github` — GitHub integration.
- `GET /api/auth/me`, `GET|POST /api/tokens`, `DELETE /api/tokens/:id` — identity
  and token management.
- `GET /api/health` (liveness), `GET /api/ready` (checks the database) — public.
- `POST /api/client-errors` — web UI error reports.

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
diff-wise. It runs against a local checkout, or against a sparse clone when
a repository is connected from GitHub (below).

## Architecture graph

`GET /api/repositories/:repoId/architecture` returns every discovered
definition (across all kinds) as a node and every `DefinitionRelationship`
as an edge — a pure read-model over data that already exists, no new
discovery logic. The web app's **Architecture** tab
(`apps/web/src/pages/ArchitecturePage.tsx`) renders this with `@xyflow/react`:

- `apps/web/src/architecture/layout.ts`: a deterministic layered layout
  (longest-path depth from any root node determines the column; nodes within
  a column are stacked vertically). Not a physics/force simulation —
  appropriate for the tens-of-nodes graphs this product deals with, and fully
  unit-tested including a cycle guard and dangling-edge handling.
- Clicking a node opens a detail drawer showing every relationship it
  participates in (both directions), each with its own `EvidenceTag` —
  evidence is never hidden behind a hover tooltip.
- Nodes are colored/iconified by kind (`apps/web/src/architecture/kindMeta.ts`),
  consistent with the legend shown above the graph.

## GitHub integration

- **Connect a repository** (Settings, or `POST /api/repositories/github`
  `{owner, repo}`): fetches metadata, sparse-clones only the paths discovery
  reads, and runs static discovery against it.
- **Actions runs**: `POST /api/repositories/:repoId/github-runs/sync`
  backfills recent runs (idempotent by run id). For live updates, add a webhook
  on the repository: payload URL `https://<host>/api/webhooks/github`, content
  type `application/json`, secret = `AGENTIC_FLOWS_GITHUB_WEBHOOK_SECRET`,
  event **Workflow runs**.
- **Auth**: a GitHub App (installation tokens, cached until expiry) when
  `AGENTIC_FLOWS_GITHUB_APP_ID` + private key are set, otherwise a PAT,
  otherwise unauthenticated (public repos, low rate limit). The App needs
  read access to *Contents*, *Metadata*, and *Actions*.

## Runtime telemetry and correlation

GitHub Actions alone can't see inside an agent (model calls, tool calls,
sub-agents, file edits), so agents report it with
[`@brianbrady/glasshouse-telemetry-client`](packages/telemetry-client):

```ts
import {
  createTelemetryClient,
  githubActionsCorrelation,
} from '@brianbrady/glasshouse-telemetry-client';

const client = createTelemetryClient({ baseUrl: process.env.AGENTIC_FLOWS_URL!, apiToken: process.env.AGENTIC_FLOWS_INGEST_TOKEN });
await client.emit({
  id: crypto.randomUUID(),
  correlation: githubActionsCorrelation()!, // GITHUB_REPOSITORY + GITHUB_RUN_ID
  spanId: 'edit-1',
  parentSpanId: 'agent',
  timestamp: new Date().toISOString(),
  kind: 'file.modified',
  data: { path: 'src/auth.ts', additions: 3, deletions: 1, diff: '…' },
  evidence: { source: 'runtime', confidence: 'observed' },
});
```

The correlation engine (`apps/server/src/correlation.ts`) resolves each event
to a run — by internal `runId`, or by GitHub identity, creating a placeholder
run that the Actions sync/webhook later upgrades in place. It derives the
trace's span tree from `*.started`/`*.completed` pairs (order-independent),
and records changed files, tool calls, and model calls. Ingestion is atomic
per event and idempotent by event id, so batches can be retried safely. Use an
`ingest`-role token scoped to the repository. Events captured offline can be
written with `appendEventToFile` and forwarded later with
`agentic-flows ingest <file.ndjson>`.

## Changed files

Each run's **Changed files** tab (`/repos/:repoId/runs/:runId?tab=files`)
lists every changed file with its operation, line counts, evidence, and an
expandable diff. Files are grouped by how we know they changed, and the
sources are never merged:

| Group | Source |
| --- | --- |
| Changed during the run | Runtime telemetry `file.*` events |
| Changed in the run's commits | Git history of commits the run produced |
| Triggering commit | GitHub commits API for the commit the run executed against — context, not proof the run wrote them |

Files that were only read are listed separately. The run header shows the
total (`N files changed +A −D`), and the repository-wide **Files** page shows
cross-run hotspots.

## Development commands

```powershell
npm run typecheck   # tsc -b across all workspaces
npm run lint        # eslint .
npm test            # vitest: unit + integration (real temp SQLite databases)
npm run test:e2e    # Playwright against the packaged server (run `npm run build` first)
npm run db:check    # Postgres schema in sync + no migration drift
npm run build       # domain → parser → telemetry-client → web → server bundle (+ web UI)
```

CI (`.github/workflows/ci.yml`) runs all of the above, a real PostgreSQL
migration job, and a Docker Compose smoke test on every push and pull
request. Pushing a `vX.Y.Z` tag publishes the npm packages
(`.github/workflows/release.yml`, needs an `NPM_TOKEN` secret).

## License

MIT — see [LICENSE](LICENSE).
