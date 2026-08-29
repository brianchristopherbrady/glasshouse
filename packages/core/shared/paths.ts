// Resolves two distinct roots the tool needs, which are only the same
// directory when running this repo's own dev server:
//
// - REPO_ROOT: the repo being OBSERVED (where .flowbook/, .github/, and
//   demo/ live for the session being watched). Defaults to the current
//   working directory (the common case: you run `flowbook start`
//   from inside the repo you want to watch), overridable with
//   FLOWBOOK_REPO_ROOT for a globally-installed CLI watching a project
//   elsewhere on disk.
// - PACKAGE_ROOT: this npm-workspaces monorepo's own root (where the
//   built dashboard lives, `<monorepo root>/dist/`, built by
//   `packages/ui`'s Vite config) -- used to serve it statically,
//   regardless of which repo is being observed.
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = process.env.FLOWBOOK_REPO_ROOT
  ? path.resolve(process.env.FLOWBOOK_REPO_ROOT)
  : process.cwd();

export function repoPath(...segments: string[]): string {
  return path.join(REPO_ROOT, ...segments);
}

// shared/paths.ts lives at packages/core/shared/ -- the monorepo root is
// two directories up.
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export function packagePath(...segments: string[]): string {
  return path.join(PACKAGE_ROOT, ...segments);
}
