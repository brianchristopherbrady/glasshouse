import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { loadFlowbookConfig, defineFlowbook, FlowbookConfigSchema } from "../shared/flowbook-config.js";

describe("defineFlowbook", () => {
  it("returns its input unchanged (identity helper)", () => {
    const config = { workflows: ["src/workflows/**/*.workflow.ts"] };
    expect(defineFlowbook(config)).toBe(config);
  });
});

describe("FlowbookConfigSchema", () => {
  it("defaults workflows to an empty array when omitted", () => {
    expect(FlowbookConfigSchema.parse({})).toEqual({ workflows: [] });
  });
});

describe("loadFlowbookConfig", () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await mkdtemp(path.join(os.tmpdir(), "flowbook-config-test-"));
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  it("returns null when no config file exists", async () => {
    expect(await loadFlowbookConfig(repoRoot)).toBeNull();
  });

  it("loads and validates a real flowbook.config.mjs default export", async () => {
    await writeFile(
      path.join(repoRoot, "flowbook.config.mjs"),
      `export default { workflows: ["src/workflows/**/*.workflow.ts"] };\n`,
      "utf-8",
    );
    const config = await loadFlowbookConfig(repoRoot);
    expect(config).toEqual({ workflows: ["src/workflows/**/*.workflow.ts"] });
  });

  it("throws a descriptive error when the default export does not match the schema", async () => {
    await writeFile(path.join(repoRoot, "flowbook.config.mjs"), `export default { workflows: "not-an-array" };\n`, "utf-8");
    await expect(loadFlowbookConfig(repoRoot)).rejects.toThrow(/flowbook.config.mjs/);
  });
});
