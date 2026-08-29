# mini-monorepo (demo)

Two-package npm workspaces monorepo, purely to give Flowbook's
Workspace Map a real `source: "package-manager"` graph to discover:
`@mini/app` depends on `@mini/core`.

`@mini/core`'s widget concept (`{id, name, status}`, active -> archived)
is shared with the sibling `mini-app`/`mini-book` demo repos -- see
`demo-workspaces/README.md`.

Also has a real `planner` -> `implementer` -> `reviewer` agent chain
(`.github/agents/*.agent.md`, real VS Code `handoffs:` frontmatter) for
testing agent-handoff telemetry -- see
`.github/skills/demo-smoke-test`'s "Testing agent handoffs" section.
