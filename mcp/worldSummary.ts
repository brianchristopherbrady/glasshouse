// Builds a compact, human-and-machine-readable summary of the current world
// state. Shared by the inspect_world tool and the world://summary resource
// so the two stay identical instead of drifting apart.
import type { WorldData } from "../shared/world-types.js";

export interface WorldSummary {
  relationships: { count: number; active: number; corrected: number; severed: number; unresolved: number };
  corrections: { count: number; unauthorized: number };
  anomalies: { count: number; open: number; systemicCandidate: number; systemicConfirmed: number };
  characters: { count: number; ids: string[]; openProvenance: string[] };
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
    corrections: {
      count: world.corrections.corrections.length,
      unauthorized: world.corrections.corrections.filter((c) => !c.authorizationId).length,
    },
    anomalies: {
      count: world.anomalies.anomalies.length,
      open: world.anomalies.anomalies.filter((a) => a.status === "open").length,
      systemicCandidate: world.anomalies.anomalies.filter((a) => a.provenance === "systemic_candidate").length,
      systemicConfirmed: world.anomalies.anomalies.filter((a) => a.provenance === "systemic_confirmed").length,
    },
    characters: {
      count: world.characters.characters.length,
      ids: world.characters.characters.map((c) => c.id),
      openProvenance: world.characters.characters.filter((c) => c.provenanceStatus === "open").map((c) => c.id),
    },
    institutions: {
      count: world.institutions.institutions.length,
      ids: world.institutions.institutions.map((i) => i.id),
    },
  };
}
