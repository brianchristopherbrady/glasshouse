import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { expandFileGlob } from "../shared/glob.js";

async function touch(repoRoot: string, relativePath: string): Promise<void> {
  const full = path.join(repoRoot, relativePath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, "", "utf-8");
}

describe("expandFileGlob", () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await mkdtemp(path.join(os.tmpdir(), "flowbook-glob-test-"));
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  it("matches a literal single-directory pattern", async () => {
    await touch(repoRoot, "workflows/a.workflow.ts");
    await touch(repoRoot, "workflows/b.workflow.ts");
    const matches = await expandFileGlob(repoRoot, "workflows/*.workflow.ts");
    expect(matches.sort()).toEqual(["workflows/a.workflow.ts", "workflows/b.workflow.ts"]);
  });

  it("does not match files in a nested directory for a single-star pattern", async () => {
    await touch(repoRoot, "workflows/a.workflow.ts");
    await touch(repoRoot, "workflows/nested/b.workflow.ts");
    const matches = await expandFileGlob(repoRoot, "workflows/*.workflow.ts");
    expect(matches).toEqual(["workflows/a.workflow.ts"]);
  });

  it("matches files at any depth for a double-star pattern", async () => {
    await touch(repoRoot, "src/workflows/a.workflow.ts");
    await touch(repoRoot, "src/workflows/nested/deep/b.workflow.ts");
    const matches = await expandFileGlob(repoRoot, "src/**/*.workflow.ts");
    expect(matches.sort()).toEqual(["src/workflows/a.workflow.ts", "src/workflows/nested/deep/b.workflow.ts"]);
  });

  it("returns an empty array for a pattern that matches nothing", async () => {
    await touch(repoRoot, "workflows/a.ts");
    const matches = await expandFileGlob(repoRoot, "workflows/*.workflow.ts");
    expect(matches).toEqual([]);
  });

  it("never descends into node_modules", async () => {
    await touch(repoRoot, "node_modules/some-pkg/x.workflow.ts");
    await touch(repoRoot, "workflows/a.workflow.ts");
    const matches = await expandFileGlob(repoRoot, "**/*.workflow.ts");
    expect(matches).toEqual(["workflows/a.workflow.ts"]);
  });

  it("deduplicates a file matched by overlapping ** expansions", async () => {
    await touch(repoRoot, "a.workflow.ts");
    const matches = await expandFileGlob(repoRoot, "**/*.workflow.ts");
    expect(matches).toEqual(["a.workflow.ts"]);
  });
});
