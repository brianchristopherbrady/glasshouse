// find_dependencies — given an entity id, reports where it exists and every
// other place in the world data that references it. A real cross-reference
// scan over the loaded, Zod-validated world data (no LLM guessing).
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadWorld } from "../../shared/world-loader.js";
import type { WorldData } from "../../shared/world-types.js";
import { withToolTelemetry, type ToolResult } from "../telemetry.js";

const InputShape = { entityId: z.string(), sessionId: z.string().optional() };

interface Reference {
  file: string;
  entityId: string;
  field: string;
}

function findExistsAs(world: WorldData, id: string): string[] {
  const kinds: string[] = [];
  if (world.structures.structures.some((c) => c.id === id)) kinds.push("structure");
  if (world.institutions.institutions.some((i) => i.id === id)) kinds.push("institution");
  if (world.relationships.relationships.some((r) => r.id === id)) kinds.push("relationship");
  if (world.changes.changes.some((c) => c.id === id)) kinds.push("change");
  if (world.issues.issues.some((i) => i.id === id)) kinds.push("issue");
  return kinds;
}

function findReferencedBy(world: WorldData, id: string): Reference[] {
  const refs: Reference[] = [];
  const push = (file: string, entityId: string, field: string, value: string | null | undefined) => {
    if (value === id) refs.push({ file, entityId, field });
  };

  for (const r of world.relationships.relationships) {
    push("relationships.json", r.id, "subject", r.subject);
    push("relationships.json", r.id, "object", r.object);
    if (r.dependentRelationships.includes(id)) refs.push({ file: "relationships.json", entityId: r.id, field: "dependentRelationships" });
    if (r.displacedConsequences.includes(id)) refs.push({ file: "relationships.json", entityId: r.id, field: "displacedConsequences" });
  }
  for (const c of world.changes.changes) {
    push("changes.json", c.id, "targetRelationshipId", c.targetRelationshipId);
    push("changes.json", c.id, "authorizationId", c.authorizationId);
    for (const entry of c.reconciliation) {
      if (entry.relationshipId === id) refs.push({ file: "changes.json", entityId: c.id, field: "reconciliation" });
    }
  }
  for (const i of world.issues.issues) {
    push("issues.json", i.id, "affects", i.affects);
    push("issues.json", i.id, "sourceRelationshipId", i.sourceRelationshipId);
  }
  for (const structure of world.structures.structures) {
    push("structures.json", structure.id, "identityAnchorRelationshipId", structure.identityAnchorRelationshipId);
  }
  for (const institution of world.institutions.institutions) {
    if (institution.authorizations.includes(id)) {
      refs.push({ file: "institutions.json", entityId: institution.id, field: "authorizations" });
    }
  }

  return refs;
}

export function registerFindDependencies(server: McpServer): void {
  server.registerTool(
    "find_dependencies",
    {
      title: "Find Dependencies",
      description:
        "Given an entity id (structure, institution, relationship, change, or issue), report what kind(s) of entity it exists as and every field elsewhere in the world data that references it.",
      inputSchema: InputShape,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    withToolTelemetry("find_dependencies", async (args: { entityId: string; sessionId?: string }) => {
      const world = await loadWorld();
      const existsAs = findExistsAs(world, args.entityId);
      const referencedBy = findReferencedBy(world, args.entityId);
      const payload = { entityId: args.entityId, existsAs, referencedBy };
      const result: ToolResult = { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
      return {
        ok: true,
        summary: `${args.entityId}: exists as [${existsAs.join(", ") || "unknown"}], ${referencedBy.length} reference(s)`,
        result,
      };
    }),
  );
}
