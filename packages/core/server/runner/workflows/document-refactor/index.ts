// A real, executable Flowbook workflow: "Document Refactor". Not a mock --
// the Builder agent genuinely edits a real Markdown file on disk, a real
// evaluation genuinely greps it for a required section, and (for the
// "missingAccessibilitySection" failure-injection scenario) a real repair
// loop genuinely re-edits the file before the Auditor agent is handed off
// to. Every Span this produces reflects something that actually happened
// in this process, matching the honesty rule the rest of Flowbook already
// follows for observed FlowbookEvents.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { diffLines } from "../../../../shared/text-diff.js";
import { extractTemplateVariables, renderTemplate } from "../../../../shared/prompt-template.js";
import { readArtifact, seedArtifacts, writeArtifact } from "../../artifacts.js";
import { registerWorkflow } from "../../registry.js";
import type { RunContext } from "../../engine.js";

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const DOC_PATH = "button.md";
const REQUIRED_SECTION = "## Accessibility";

const IMPLEMENTATION_PROMPT_TEMPLATE =
  "Refactor {{document}} to satisfy the following request:\n{{request}}\n\nPreserve every existing section; only add what the request requires.";
const BUILDER_INSTRUCTIONS_TEMPLATE =
  "You are the Builder agent. You modify real repository documents to satisfy a request, then hand off to the Auditor agent once your own accessibility check passes.";

function buildRefactoredDoc(original: string, includeAccessibility: boolean): string {
  const withAria = original.replace(
    "- `onClick` (function)",
    "- `onClick` (function)\n- `ariaLabel` (string, optional)",
  );
  if (!includeAccessibility) return withAria;
  return `${withAria}\n${REQUIRED_SECTION}\n\nSet \`ariaLabel\` when \`label\` alone would not describe the button's action to a screen reader.\n`;
}

async function runBuilder(ctx: RunContext, artifactRoot: string, includeAccessibility: boolean): Promise<string> {
  return ctx.span(
    "agent",
    "Builder Agent",
    async () => {
      // Real prompt rendering -- the Resolved view is genuinely what the
      // "model" (here, the deterministic buildRefactoredDoc logic standing
      // in for one) received, built from the real request input, not a
      // paraphrase.
      const requestText = typeof ctx.input.request === "string" ? ctx.input.request : "(no request provided)";
      await ctx.span(
        "prompt",
        "implementation prompt resolved",
        (span) => {
          const resolved = renderTemplate(IMPLEMENTATION_PROMPT_TEMPLATE, { document: DOC_PATH, request: requestText });
          span.setOutput({ template: IMPLEMENTATION_PROMPT_TEMPLATE, resolved });
        },
        { resourceId: "implementation-prompt", input: { document: DOC_PATH, request: requestText } },
      );

      const before = await readArtifact(artifactRoot, DOC_PATH);
      const after = await ctx.span(
        "skill",
        "modify-document",
        async (span) => {
          const updated = buildRefactoredDoc(before, includeAccessibility);
          await writeArtifact(artifactRoot, DOC_PATH, updated);
          const diff = diffLines(before, updated);
          span.setOutput({ added: diff.added, removed: diff.removed });
          return updated;
        },
        { resourceId: "modify-document", input: { document: DOC_PATH } },
      );
      return after;
    },
    { resourceId: "builder" },
  );
}

async function runAccessibilityCheck(ctx: RunContext, artifactRoot: string): Promise<boolean> {
  return ctx.span(
    "evaluation",
    "Accessibility check",
    async (span) => {
      const content = await readArtifact(artifactRoot, DOC_PATH);
      const passed = content.includes(REQUIRED_SECTION);
      span.setOutput({ passed, requiredSection: REQUIRED_SECTION });
      if (!passed) throw new Error(`Missing required section: ${REQUIRED_SECTION}`);
      return passed;
    },
    { resourceId: "accessibility-audit" },
  );
}

async function runAuditor(ctx: RunContext, artifactRoot: string): Promise<void> {
  await ctx.span(
    "handoff",
    "Builder → Auditor",
    async (span) => {
      span.setOutput({ contextTransferred: ["document", "accessibilityCheckResult"] });
    },
    { resourceId: "builder" },
  );
  await ctx.span(
    "agent",
    "Auditor Agent",
    async (span) => {
      const content = await readArtifact(artifactRoot, DOC_PATH);
      span.setOutput({ reviewed: DOC_PATH, length: content.length });
    },
    { resourceId: "auditor" },
  );
}

registerWorkflow({
  id: "document-refactor",
  label: "Document Refactor",
  fixturesDir: FIXTURES_DIR,
  resources: [
    { kind: "workflow", id: "document-refactor", label: "Document Refactor", agents: ["builder", "auditor"] },
    {
      kind: "agent",
      id: "builder",
      label: "Builder Agent",
      description: "Implements the requested documentation change.",
      prompt: "implementation-prompt",
      instructions: "builder-instructions",
      skills: ["modify-document"],
      tools: [],
      handoffs: ["auditor"],
    },
    {
      kind: "prompt",
      id: "implementation-prompt",
      label: "implementation",
      description: "Rendered once per Builder attempt against the real request input.",
      version: 1,
      template: IMPLEMENTATION_PROMPT_TEMPLATE,
      variables: extractTemplateVariables(IMPLEMENTATION_PROMPT_TEMPLATE),
    },
    {
      kind: "instruction",
      id: "builder-instructions",
      label: "builder",
      description: "Static system-level instructions for the Builder agent.",
      version: 1,
      template: BUILDER_INSTRUCTIONS_TEMPLATE,
    },
    {
      kind: "agent",
      id: "auditor",
      label: "Auditor Agent",
      description: "Reviews the change the Builder made.",
      skills: [],
      tools: [],
      handoffs: [],
    },
    { kind: "skill", id: "modify-document", label: "modify-document", inputs: ["document"], outputs: ["documentRevision"], version: 1 },
    { kind: "artifact", id: "button.md", label: "button.md", path: DOC_PATH },
    { kind: "evaluation", id: "accessibility-audit", label: "Accessibility audit" },
  ],
  relationships: [
    { from: "document-refactor", to: "builder", type: "invokes" },
    { from: "builder", to: "implementation-prompt", type: "references" },
    { from: "builder", to: "builder-instructions", type: "references" },
    { from: "builder", to: "modify-document", type: "uses" },
    { from: "modify-document", to: "button.md", type: "modifies" },
    { from: "builder", to: "accessibility-audit", type: "validates" },
    { from: "builder", to: "auditor", type: "handsOff" },
    { from: "auditor", to: "button.md", type: "reads" },
  ],
  scenarios: [
    {
      id: "happy-path",
      workflowId: "document-refactor",
      label: "Happy Path",
      description: "Builder writes the accessibility section correctly on the first try.",
      input: { request: "Add an ariaLabel prop and document its accessibility guidance." },
    },
    {
      id: "missing-accessibility-section",
      workflowId: "document-refactor",
      label: "Missing Documentation",
      description: "Builder's first attempt omits the accessibility section; the check fails, Builder revises, then it passes.",
      input: { request: "Add an ariaLabel prop." },
      failureInjection: "missingAccessibilitySection",
    },
  ],
  async run(ctx: RunContext) {
    const artifactRoot = await seedArtifacts(ctx.runId, FIXTURES_DIR, ctx.storeDir);
    const injectFailureOnce = ctx.scenario?.failureInjection === "missingAccessibilitySection";

    await runBuilder(ctx, artifactRoot, !injectFailureOnce);

    let passed = false;
    try {
      passed = await runAccessibilityCheck(ctx, artifactRoot);
    } catch {
      passed = false;
    }

    if (!passed) {
      // Real repair loop: Builder revises the actual file, not a retried
      // no-op, then the check genuinely runs again.
      await runBuilder(ctx, artifactRoot, true);
      await runAccessibilityCheck(ctx, artifactRoot);
    }

    await runAuditor(ctx, artifactRoot);
  },
});
