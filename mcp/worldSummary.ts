// Builds a compact, human-and-machine-readable summary of the current world
// state. Shared by the inspect_world tool and the world://summary resource
// so the two stay identical instead of drifting apart.
import type { WorldData } from "../shared/world-types.js";

export interface WorldSummary {
  relationships: { count: number; active: number; corrected: number; severed: number; unresolved: number };
  changes: { count: number; unauthorized: number };
  issues: { count: number; open: number; systemicCandidate: number; systemicConfirmed: number };
  structures: { count: number; ids: string[]; openProvenance: string[] };
  institutions: { count: number; ids: string[] };
}

export function summarizeWorld(world: WorldData): WorldSummary {
  return {
    relationships: {
      count: world.relationships.relationships.length,
      active: world.relationships.relationships.filter((r) => r.status === "active").length,
      corrected: world.relationships.relationships.filter((r) => r.status === "corrected").length,
      severed: world.relationships.relationships.filter((r) => r.status === "severed").length,
      unresolved: world.relationships.relationships.filter((r) => r.status === "unresolved").length,
    },
    changes: {
      count: world.changes.changes.length,
      unauthorized: world.changes.changes.filter((c) => !c.authorizationId).length,
    },
    issues: {
      count: world.issues.issues.length,
      open: world.issues.issues.filter((i) => i.status === "open").length,
      systemicCandidate: world.issues.issues.filter((i) => i.provenance === "systemic_candidate").length,
      systemicConfirmed: world.issues.issues.filter((i) => i.provenance === "systemic_confirmed").length,
    },
    structures: {
      count: world.structures.structures.length,
      ids: world.structures.structures.map((c) => c.id),
      openProvenance: world.structures.structures.filter((c) => c.provenanceStatus === "open").map((c) => c.id),
    },
    institutions: {
      count: world.institutions.institutions.length,
      ids: world.institutions.institutions.map((i) => i.id),
    },
  };
}
