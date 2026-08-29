// Real Blueprint + Workflow-function registry. A "workflow" in Flowbook is
// registered code (server/runner/workflows/*.ts), not something discovered
// by scanning arbitrary repo folders for prose -- Blueprint content here is
// exactly what the registered workflow declares about itself (its
// resources/relationships/scenarios), so the graph never shows anything
// the workflow's own code didn't state.
import type { Blueprint, Resource, Relationship, Scenario } from "../../shared/flowbook-types.js";
import type { WorkflowFn } from "./engine.js";

export interface RegisteredWorkflow {
  id: string;
  label: string;
  resources: Resource[];
  relationships: Relationship[];
  scenarios: Scenario[];
  run: WorkflowFn;
  /** Absolute path to the workflow's pristine fixture directory (its
   * "before" state) -- lets the server compute a real diff between the
   * original fixture and a run's post-execution artifact without needing
   * a second seeded copy per request. Optional only for test workflows
   * that never touch artifacts. */
  fixturesDir?: string;
}

const registry = new Map<string, RegisteredWorkflow>();

export function registerWorkflow(workflow: RegisteredWorkflow): void {
  registry.set(workflow.id, workflow);
}

export function getWorkflow(id: string): RegisteredWorkflow | undefined {
  return registry.get(id);
}

export function listWorkflows(): RegisteredWorkflow[] {
  return [...registry.values()];
}

export function getBlueprint(workflowId: string): Blueprint | undefined {
  const workflow = registry.get(workflowId);
  if (!workflow) return undefined;
  return { workflowId, resources: workflow.resources, relationships: workflow.relationships };
}

export function listScenarios(workflowId: string): Scenario[] {
  return registry.get(workflowId)?.scenarios ?? [];
}

/** Clears the registry -- test-only, so tests/runner.test.ts can register
 * a throwaway workflow without leaking state into other test files. */
export function resetRegistryForTests(): void {
  registry.clear();
}
