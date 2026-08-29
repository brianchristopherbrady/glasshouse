// Tests server/runner/discovery.ts's real mechanics: config -> glob ->
// dynamic import -> per-file error isolation. Uses real temp .mjs files
// (not .ts) since a dynamically `import()`ed absolute path goes through
// Node's actual ESM loader at runtime, not vitest's own TS transform
// pipeline -- a .ts file here would only work by accident under ts-node/tsx
// and wouldn't prove the real discovery path works for a plain repo.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { discoverWorkflows } from "../server/runner/discovery.js";

declare global {
  // eslint-disable-next-line no-var
  var __flowbookDiscoveryTestMarker: string[] | undefined;
}

async function writeConfig(repoRoot: string, workflows: string[]): Promise<void> {
  await writeFile(
    path.join(repoRoot, "flowbook.config.mjs"),
    `export default { workflows: ${JSON.stringify(workflows)} };\n`,
    "utf-8",
  );
}

describe("discoverWorkflows", () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await mkdtemp(path.join(os.tmpdir(), "flowbook-discovery-test-"));
    globalThis.__flowbookDiscoveryTestMarker = [];
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
    delete globalThis.__flowbookDiscoveryTestMarker;
  });

  it("returns empty results when there is no flowbook.config.*", async () => {
    const result = await discoverWorkflows(repoRoot);
    expect(result).toEqual({ loaded: [], failed: [] });
  });

  it("imports every real file matched by a configured glob, for its side effect", async () => {
    await writeConfig(repoRoot, ["workflows/*.workflow.mjs"]);
    await mkdir(path.join(repoRoot, "workflows"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "workflows", "a.workflow.mjs"),
      `globalThis.__flowbookDiscoveryTestMarker.push("a");\n`,
      "utf-8",
    );
    await writeFile(
      path.join(repoRoot, "workflows", "b.workflow.mjs"),
      `globalThis.__flowbookDiscoveryTestMarker.push("b");\n`,
      "utf-8",
    );

    const result = await discoverWorkflows(repoRoot);
    expect(result.failed).toEqual([]);
    expect(result.loaded).toHaveLength(2);
    expect(globalThis.__flowbookDiscoveryTestMarker!.sort()).toEqual(["a", "b"]);
  });

  it("isolates a module that throws on import instead of failing the whole discovery pass", async () => {
    await writeConfig(repoRoot, ["workflows/*.workflow.mjs"]);
    await mkdir(path.join(repoRoot, "workflows"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "workflows", "good.workflow.mjs"),
      `globalThis.__flowbookDiscoveryTestMarker.push("good");\n`,
      "utf-8",
    );
    await writeFile(
      path.join(repoRoot, "workflows", "bad.workflow.mjs"),
      `throw new Error("deliberately broken workflow module");\n`,
      "utf-8",
    );

    const result = await discoverWorkflows(repoRoot);
    expect(globalThis.__flowbookDiscoveryTestMarker).toEqual(["good"]);
    expect(result.loaded).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]!.error).toMatch(/deliberately broken workflow module/);
    expect(result.failed[0]!.file).toMatch(/bad\.workflow\.mjs$/);
  });

  it("never matches files inside node_modules even with a broad ** pattern", async () => {
    await writeConfig(repoRoot, ["**/*.workflow.mjs"]);
    await mkdir(path.join(repoRoot, "node_modules", "some-pkg"), { recursive: true });
    await writeFile(path.join(repoRoot, "node_modules", "some-pkg", "x.workflow.mjs"), `throw new Error("should not run");\n`, "utf-8");
    await mkdir(path.join(repoRoot, "workflows"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "workflows", "real.workflow.mjs"),
      `globalThis.__flowbookDiscoveryTestMarker.push("real");\n`,
      "utf-8",
    );

    const result = await discoverWorkflows(repoRoot);
    expect(result.failed).toEqual([]);
    expect(globalThis.__flowbookDiscoveryTestMarker).toEqual(["real"]);
  });
});
