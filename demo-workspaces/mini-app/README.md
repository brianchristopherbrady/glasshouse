# mini-app (demo)

A plain single-package app, no `workspaces` field -- gives Agentic
Flowbook's Workspace Map a real `source: "folder-heuristic"` graph
(one member per top-level folder: `api`, `ui`, `workers`).

`api`/`ui`/`workers` share the same widget concept (`{id, name, status}`,
active -> archived) implemented in the sibling `mini-monorepo`/`mini-book`
demo repos -- see `demo-workspaces/README.md`. `workers` has a real
dependency on `api` not detectable by folder-heuristic discovery alone.
