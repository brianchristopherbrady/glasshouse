# Agentic City

A tiny, text-only city that exists entirely as Markdown files, run by a council of Copilot agents. It is the local demo workspace for **Glasshouse**: every prompt you run here shows up in Glasshouse as a run, with the agents and handoffs involved and each file change as a diff.

## The council

| Agent | Role | Owns | Skills |
|-------|------|------|--------|
| `mayor` | Decides, then delegates to the other offices as subagents | `city/council-minutes.md` | — |
| `city-planner` | Designs districts and landmarks | `city/districts/*.md`, `city/map.md` | `zoning-code`, `ascii-cartography` |
| `building-inspector` | Inspects against the charter and zoning code | `city/permits.md`, inspection notes | `zoning-code` |
| `treasurer` | Prices and pays for projects | `city/ledger.md` | `civic-budget` |
| `town-crier` | Reports the news | `city/gazette.md` | `gazette-style` |

Prompts (slash commands): `/found-district`, `/build-landmark`, `/city-crisis` (all run in the Mayor), and `/morning-gazette` (Town Crier). The Mayor's **Have the Town Crier announce it** handoff button switches the chat to the Town Crier, and Glasshouse records that switch as a handoff too.

## Run the demo

1. From the repository root, start Glasshouse with this workspace registered:

   ```bash
   npm run demo
   ```

   This serves the web UI on <http://localhost:5410> and the API on `127.0.0.1:4410` (loopback only, no auth). Pick **Agentic City (local)** in the repository dropdown.

2. In VS Code, use either window. The agents, prompts, skills, and instructions work in both, and record to the same Glasshouse workspace:

   - **The repository root** (the window you develop Glasshouse in). The root `.github/` holds a generated copy of this folder's customizations, with paths rewritten to `examples/agentic-city/...`.
   - **This folder on its own** (`code examples/agentic-city`). Use this for a clean demo with nothing else in the chat context.

   Trust the workspace when asked. Agent hooks only run in trusted workspaces.

3. In Copilot Chat, use the **Local** agent harness, pick the **mayor** agent, and run, for example:

   ```text
   /found-district Noodle Heights, built on a retired noodle factory
   ```

4. Watch **Runs** in Glasshouse. The run appears as soon as the Mayor starts and updates live: **Trace** (agents, subagents, tool calls, skills), **Agents** (handoffs with briefs and reports), and **Changed files** (every edit as a diff, labelled with the agent that made it).

   The city has no GitHub Agentic Workflows; its prompt files play that role. **Flows** lists each prompt file with its run count, and a session whose first message is a slash command (`/found-district ...`) is linked to that prompt file. Free-form chats are recorded as runs too, just without a prompt link.

5. Tune the council and compare. On a run's page, **Save run** with a label (e.g. `baseline: mayor v1`). Edit an agent, skill, or prompt in this folder, run the same prompt again, then open **Compare** (or tick two runs on **Runs**). Glasshouse snapshots the agent, skill, prompt, and instruction files when each session starts, so the comparison shows exactly what you changed in the setup next to how the results differed: agents and handoffs, skills loaded, and every changed file's diff side by side. **Files** shows every recorded change to one file across all runs.

No Copilot handy? `npm run city:replay` (from the repository root) plays a scripted `/found-district` session through the same recorder. It makes real edits to the city, but no model is involved, and the run's engine says so.

Reset the city to its last committed state with `npm run city:reset`. Recorded runs stay in Glasshouse.

### Editing the agents

This folder's `.github/` and `AGENTS.md` are the source of truth. After changing them, run `npm run city:sync` from the repository root to regenerate the root copy (`AGENTS.md` becomes `.github/instructions/agentic-city.instructions.md`, scoped to this folder so it stays out of unrelated chats). A test fails if the copy is out of date. Don't edit the root copies directly.

## How recording works

Each agent's frontmatter declares agent-scoped hooks (`UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `SubagentStart`, `SubagentStop`, `Stop`) that run `node tools/city-recorder.mjs --agent <name>`. Only chats with a city agent are recorded. The recorder (`tools/recorder-core.mjs`):

- turns one chat session into one run, each prompt into an agent span, delegated subagents into nested agent spans, and tool calls into tool spans;
- records a handoff when the Mayor delegates to a subagent, when the subagent reports back, and when the chat switches agents (a handoff button);
- records a skill as loaded when an agent reads its `SKILL.md`;
- snapshots the workspace and, after every tool call, emits each changed file with a unified diff, attributed to the agent that made the call;
- sends events to Glasshouse and queues them in `.city-recorder/outbox.ndjson` if the server is down, delivering them with the next hook. It registers this workspace with the server on first contact if needed.

Hooks always answer `{}` and exit 0, so recording never blocks or changes what an agent does. Problems are logged to `.city-recorder/recorder.log`. Point the recorder at a different server with `GLASSHOUSE_URL` (and `GLASSHOUSE_API_TOKEN` if auth is on), or with `.city-recorder/config.json`, which `npm run demo` writes.

If no run appears, check that the workspace is trusted, that `chat.useHooks` is enabled, that the Local harness is selected (agent-scoped hooks are Local-only), and the **GitHub Copilot Chat Hooks** output channel for errors.
