// Shared per-ResourceKind icon/color -- single source so BlueprintGraph and
// Explorer never drift into inconsistent glyphs for the same kind.
import type { Resource } from "../../../core/shared/flowbook-types.js";

export const KIND_META: Record<Resource["kind"], { icon: string; color: string }> = {
  workflow: { icon: "▣", color: "var(--text)" },
  agent: { icon: "◉", color: "var(--blue)" },
  prompt: { icon: "▤", color: "var(--orange)" },
  instruction: { icon: "▥", color: "var(--orange)" },
  skill: { icon: "◇", color: "var(--green)" },
  tool: { icon: "▲", color: "var(--orange)" },
  artifact: { icon: "▧", color: "var(--text-secondary)" },
  evaluation: { icon: "✓", color: "var(--teal)" },
  humanGate: { icon: "◈", color: "var(--purple)" },
};

/** Display order for grouped kind sections in the Explorer -- roughly
 * "containers first, leaves last" per plan.md's Explorer example ordering. */
export const KIND_ORDER: Resource["kind"][] = [
  "workflow",
  "agent",
  "prompt",
  "instruction",
  "skill",
  "tool",
  "artifact",
  "evaluation",
  "humanGate",
];

export const KIND_PLURAL: Record<Resource["kind"], string> = {
  workflow: "Workflows",
  agent: "Agents",
  prompt: "Prompts",
  instruction: "Instructions",
  skill: "Skills",
  tool: "Tools",
  artifact: "Artifacts",
  evaluation: "Evaluations",
  humanGate: "Human Gates",
};
