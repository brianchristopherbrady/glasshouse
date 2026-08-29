// Root data directory for the real orchestrator's own persistence (Run
// records, per-run artifact sandboxes) -- see server/runner/runStore.ts
// and server/runner/artifacts.ts.
import { repoPath } from "./paths.js";

export const DEFAULT_STORE_DIR = repoPath(".flowbook");
