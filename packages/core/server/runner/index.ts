// Loads every registered workflow (side-effect imports call registerWorkflow)
// so server/index.ts only needs one import to make the whole runner ready.
import "./workflows/document-refactor/index.js";

export { executeRun, RunFailure, type RunContext, type WorkflowFn } from "./engine.js";
export { getBlueprint, getWorkflow, listScenarios, listWorkflows } from "./registry.js";
export { listRuns, readRun } from "./runStore.js";
export { subscribeToRuns, type RunUpdate } from "./runBus.js";
