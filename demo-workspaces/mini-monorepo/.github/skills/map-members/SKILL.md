---
name: map-members
description: Authors and revises a repo's flowbook.members.json -- the explicit, real member map the Workspace Map reads when a repo isn't a plain package-manager monorepo, or when its package/folder structure alone doesn't represent the repo's real hierarchy (a book's parts and chapters, a component with meaningfully-named sub-components, etc.). Use whenever the Cartographer decides the repo's structure needs an explicit map, or whenever real repo structure changes.
---

# Map Members

This Skill writes `flowbook.members.json` at the repo root -- the one
data source `shared/workspace-graph.ts` treats as ground truth (`source:
"config"`), overriding the mechanical package-manager/folder-heuristic
readouts. It exists because not every repo is a monorepo, and not every
repo's meaningful structure is expressible as "a folder full of packages":
a book is organized into parts and chapters, a single-package app may have
meaningful internal folders, and a component package may have real
sub-components worth showing individually in the Workspace Map.

## The schema

```jsonc
{
  "members": [
    {
      "id": "unique-stable-id",       // required -- how other members reference this one
      "label": "Human-readable name", // required -- shown in the map
      "path": "relative/path",        // required -- a directory OR a single file
      "kind": "package",              // required -- free text; see below
      "parentId": "other-member-id",  // optional -- real declared hierarchy
      "description": "...",           // optional
      "dependsOn": ["other-id"]       // optional -- real dependency/requirement edges
    }
  ]
}
```

- `kind` is free text. Common values (`package`, `folder`, `file`, `module`,
  `part`, `chapter`, `custom`) exist as a naming convention, not a fixed
  enum -- use whatever word actually describes this repo's members (e.g.
  `service`, `route`, `doc-section`).
- `path` may be a directory (most members) or a single file. A book chapter
  that's one Markdown file, or a component that's one `.tsx` file, should
  point directly at that file -- the Workspace Map's session-activity
  matching (`shared/workspace-activity.ts`) handles both correctly.
- `parentId` is what creates real hierarchy in the map: a member with
  children renders those children as connected child nodes. Omit it for
  top-level members. Only set it when the containment is real and durable,
  not a guess about how things "probably" relate.
- `dependsOn` is for real requirement/dependency relationships you can
  actually verify (e.g. by reading imports, or because you know the
  domain) -- not a guess. An empty array is an honest default, not
  something to fill in speculatively.

## Worked example 1: monorepo with a meaningful sub-component

A component package (`package-manager`-discovered) has one named
sub-component worth showing individually, because sessions frequently
touch it in isolation:

```jsonc
{
  "members": [
    { "id": "@acme/design-a-wc", "label": "@acme/design-a-wc", "path": "packages/design-a-web-components", "kind": "package", "dependsOn": [] },
    { "id": "button-component", "label": "Button", "path": "packages/design-a-web-components/src/button.ts", "kind": "module", "parentId": "@acme/design-a-wc", "dependsOn": [] },
    { "id": "@acme/design-a-react", "label": "@acme/design-a-react", "path": "packages/design-a-react", "kind": "package", "dependsOn": ["@acme/design-a-wc"] }
  ]
}
```

Note: once you write an explicit config, it's now the *complete* source of
truth (`source: "config"` replaces package-manager discovery entirely for
this repo) -- you're responsible for keeping every real package listed, not
just the one you wanted to add detail to. Re-run `discover_workspaces`
before writing the config to get the current mechanical package list as
your starting point, then add the hierarchy/detail on top.

## Worked example 2: a book manuscript (no code, no packages)

```jsonc
{
  "members": [
    { "id": "part-1", "label": "Part One: Departure", "path": "manuscript/part-1", "kind": "part", "dependsOn": [] },
    { "id": "ch-1", "label": "Chapter 1", "path": "manuscript/part-1/chapter-1.md", "kind": "chapter", "parentId": "part-1", "dependsOn": [] },
    { "id": "ch-2", "label": "Chapter 2", "path": "manuscript/part-1/chapter-2.md", "kind": "chapter", "parentId": "part-1", "dependsOn": [] },
    { "id": "ch-3", "label": "Chapter 3", "path": "manuscript/part-1/chapter-3.md", "kind": "chapter", "parentId": "part-1", "dependsOn": [] },
    { "id": "part-2", "label": "Part Two: Return", "path": "manuscript/part-2", "kind": "part", "dependsOn": [] },
    { "id": "ch-4", "label": "Chapter 4", "path": "manuscript/part-2/chapter-4.md", "kind": "chapter", "parentId": "part-2", "dependsOn": [] }
  ]
}
```

This gives the Workspace Map a real two-level hierarchy (Part -> Chapter)
even though there is no code, no package.json, and no workspaces config at
all -- exactly the case `folder-heuristic` alone can't represent well
(a flat list of `manuscript`, with no idea that `part-1`/`part-2` matter
more than their chapter files individually).

## Worked example 3: a plain (non-monorepo) app with meaningful folders

```jsonc
{
  "members": [
    { "id": "api", "label": "API", "path": "src/api", "kind": "folder", "dependsOn": [] },
    { "id": "ui", "label": "UI", "path": "src/ui", "kind": "folder", "dependsOn": ["api"] },
    { "id": "workers", "label": "Background Workers", "path": "src/workers", "kind": "folder", "dependsOn": ["api"] }
  ]
}
```

A single `package.json`, no `workspaces` field -- but the repo has a real
internal structure worth showing as more than one undifferentiated blob.
This is a case where `folder-heuristic` might already produce something
reasonable (one member per top-level `src` subfolder, if that's the layout),
but writing it explicitly lets you add real `dependsOn` edges the
heuristic can't infer.

## How to verify before writing

1. Call `discover_workspaces` first, always -- know what the mechanical
   reading currently produces before deciding what's missing or wrong.
2. Read enough of the actual repo (folder listings, a README, representative
   files) to be confident the hierarchy/dependencies you're about to declare
   are real, not assumed from naming conventions.
3. Write `flowbook.members.json` at the repo root.
4. Call `discover_workspaces` again to confirm the config is being read
   (`source: "config"`) and parses as expected.

## What this Skill does not do

- It does not invent members that don't correspond to real repo content.
- It does not add `dependsOn`/`parentId` edges you haven't verified --
  an honest flat list beats a confident-looking but wrong hierarchy.
- It does not touch the mechanical discovery code itself
  (`shared/workspace-graph.ts`) -- that stays generic and repo-agnostic.
