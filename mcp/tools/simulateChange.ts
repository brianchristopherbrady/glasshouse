// simulate_change (optional, per charter.md) — dry-run a shallow patch to one
// domain of the world data and report whether it WOULD validate, without
// writing anything to disk. Useful for "what if" questions during planning.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadWorld } from "../../shared/world-loader.js";
import { validateWorld } from "../../shared/world-validator.js";
import {
  RelationshipsFileSchema,
  CorrectionsFileSchema,
  AnomaliesFileSchema,
  CharactersFileSchema,
  InstitutionsFileSchema,
} from "../../shared/world-types.js";
import type { WorldData } from "../../shared/world-types.js";
import { withToolTelemetry, type ToolResult } from "../telemetry.js";

const DOMAINS = ["relationships", "corrections", "anomalies", "characters", "institutions"] as const;
type Domain = (typeof DOMAINS)[number];

const DOMAIN_SCHEMAS: Record<Domain, { safeParse: (v: unknown) => { success: boolean; data?: unknown; error?: { issues: unknown[] } } }> = {
  relationships: RelationshipsFileSchema,
  corrections: CorrectionsFileSchema,
  anomalies: AnomaliesFileSchema,
  characters: CharactersFileSchema,
  institutions: InstitutionsFileSchema,
};

const InputShape = {
  domain: z.enum(DOMAINS),
  patch: z.record(z.string(), z.unknown()),
  sessionId: z.string().optional(),
};

export function registerSimulateChange(server: McpServer): void {
  server.registerTool(
    "simulate_change",
    {
      title: "Simulate Change",
      description:
        "Dry-run a shallow patch merged into one domain of the world (relationships, corrections, anomalies, characters, or institutions) and report whether the resulting world would pass validation. Never writes to disk.",
      inputSchema: InputShape,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    withToolTelemetry(
      "simulate_change",
      async (args: { domain: Domain; patch: Record<string, unknown>; sessionId?: string }) => {
        const world = await loadWorld();
        const merged = { ...(world[args.domain] as Record<string, unknown>), ...args.patch };
        const parsed = DOMAIN_SCHEMAS[args.domain].safeParse(merged);

        if (!parsed.success) {
          const payload = { domain: args.domain, schemaValid: false, schemaIssues: parsed.error?.issues ?? [] };
          const failResult: ToolResult = {
            content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
            isError: true,
          };
          return {
            ok: false,
            summary: `patch for ${args.domain} fails schema validation`,
            result: failResult,
          };
        }

        const hypotheticalWorld: WorldData = { ...world, [args.domain]: parsed.data } as WorldData;
        const result = validateWorld(hypotheticalWorld);
        const payload = { domain: args.domain, note: "hypothetical only — nothing was written to disk", ...result };
        const okResult: ToolResult = { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };

        return {
          ok: result.valid,
          summary: result.valid
            ? `patch to ${args.domain} would validate`
            : `patch to ${args.domain} would produce ${result.issues.length} issue(s)`,
          result: okResult,
        };
      },
    ),
  );
}
