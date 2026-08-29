import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { discoverWorkspaceGraph } from "../shared/workspace-graph.js";

async function writePackageJson(dir: string, content: unknown): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify(content, null, 2), "utf-8");
}

describe("discoverWorkspaceGraph", () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await mkdtemp(path.join(os.tmpdir(), "flowbook-ws-test-"));
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  it("falls back to folder-heuristic for a repo with no workspaces field and no config", async () => {
    await writePackageJson(repoRoot, { name: "root", version: "1.0.0" });
    await mkdir(path.join(repoRoot, "src"));
    await mkdir(path.join(repoRoot, "docs"));
    const graph = await discoverWorkspaceGraph(repoRoot);
    expect(graph.source).toBe("folder-heuristic");
    expect(graph.members.map((m) => m.id).sort()).toEqual(["docs", "src"]);
    expect(graph.edges).toEqual([]);
  });

  it("discovers packages matching a glob pattern and their real dependency edges", async () => {
    await writePackageJson(repoRoot, { name: "root", workspaces: ["packages/*"] });
    await writePackageJson(path.join(repoRoot, "packages", "web-components"), {
      name: "@acme/web-components",
      version: "1.0.0",
    });
    await writePackageJson(path.join(repoRoot, "packages", "react-wrapper"), {
      name: "@acme/react-wrapper",
      version: "1.0.0",
      dependencies: { "@acme/web-components": "^1.0.0", react: "^18.0.0" },
    });

    const graph = await discoverWorkspaceGraph(repoRoot);
    expect(graph.source).toBe("package-manager");
    expect(graph.members.map((m) => m.id).sort()).toEqual(["@acme/react-wrapper", "@acme/web-components"]);

    const wrapper = graph.members.find((m) => m.id === "@acme/react-wrapper")!;
    expect(wrapper.dependsOn).toEqual(["@acme/web-components"]);
    expect(wrapper.kind).toBe("package");
    expect(graph.edges).toEqual([{ from: "@acme/react-wrapper", to: "@acme/web-components" }]);
  });

  it("does not list an external (non-workspace) dependency as an edge", async () => {
    await writePackageJson(repoRoot, { name: "root", workspaces: ["packages/*"] });
    await writePackageJson(path.join(repoRoot, "packages", "only-pkg"), {
      name: "@acme/only-pkg",
      dependencies: { react: "^18.0.0" },
    });

    const graph = await discoverWorkspaceGraph(repoRoot);
    expect(graph.members[0]!.dependsOn).toEqual([]);
    expect(graph.edges).toEqual([]);
  });

  it("expands a ** glob across nested directories", async () => {
    await writePackageJson(repoRoot, { name: "root", workspaces: ["libs/**"] });
    await writePackageJson(path.join(repoRoot, "libs", "design-a", "web-components"), {
      name: "@acme/design-a-wc",
    });
    await writePackageJson(path.join(repoRoot, "libs", "design-a", "angular"), {
      name: "@acme/design-a-ng",
      dependencies: { "@acme/design-a-wc": "^1.0.0" },
    });

    const graph = await discoverWorkspaceGraph(repoRoot);
    expect(graph.members.map((m) => m.id).sort()).toEqual(["@acme/design-a-ng", "@acme/design-a-wc"]);
    expect(graph.edges).toEqual([{ from: "@acme/design-a-ng", to: "@acme/design-a-wc" }]);
  });

  it("reads workspace globs from pnpm-workspace.yaml when package.json has none", async () => {
    await writePackageJson(repoRoot, { name: "root" });
    await writeFile(
      path.join(repoRoot, "pnpm-workspace.yaml"),
      'packages:\n  - "packages/*"\n',
      "utf-8",
    );
    await writePackageJson(path.join(repoRoot, "packages", "solo"), { name: "@acme/solo" });

    const graph = await discoverWorkspaceGraph(repoRoot);
    expect(graph.source).toBe("package-manager");
    expect(graph.members.map((m) => m.id)).toEqual(["@acme/solo"]);
  });

  it("prefers an explicit flowbook.members.json over package-manager workspaces", async () => {
    await writePackageJson(repoRoot, { name: "root", workspaces: ["packages/*"] });
    await writePackageJson(path.join(repoRoot, "packages", "solo"), { name: "@acme/solo" });
    await writeFile(
      path.join(repoRoot, "flowbook.members.json"),
      JSON.stringify({
        members: [
          { id: "part-1", label: "Part One", path: "manuscript/part-1", kind: "part", dependsOn: [] },
          { id: "chapter-1", label: "Chapter 1", path: "manuscript/part-1/chapter-1.md", kind: "chapter", parentId: "part-1", dependsOn: [] },
        ],
      }),
      "utf-8",
    );

    const graph = await discoverWorkspaceGraph(repoRoot);
    expect(graph.source).toBe("config");
    expect(graph.members.map((m) => m.id).sort()).toEqual(["chapter-1", "part-1"]);
    const chapter = graph.members.find((m) => m.id === "chapter-1")!;
    expect(chapter.parentId).toBe("part-1");
    expect(chapter.source).toBe("config");
  });

  it("computes edges from a config's own declared dependsOn", async () => {
    await writeFile(
      path.join(repoRoot, "flowbook.members.json"),
      JSON.stringify({
        members: [
          { id: "a", label: "A", path: "a", kind: "custom", dependsOn: ["b"] },
          { id: "b", label: "B", path: "b", kind: "custom", dependsOn: [] },
        ],
      }),
      "utf-8",
    );
    const graph = await discoverWorkspaceGraph(repoRoot);
    expect(graph.edges).toEqual([{ from: "a", to: "b" }]);
  });
});
