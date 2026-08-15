#!/usr/bin/env tsx
// npm run validate:world — deterministic pass/fail check for world/*.json.
import { loadWorld } from "../shared/world-loader.js";
import { validateWorld } from "../shared/world-validator.js";

async function main() {
  const world = await loadWorld();
  const result = validateWorld(world);

  if (result.valid) {
    console.log("WORLD VALID");
    console.log(`Checked at ${result.checkedAt}. No violations found.`);
    process.exit(0);
  }

  console.error("WORLD INVALID\n");
  for (const issue of result.issues) {
    console.error(`[${issue.rule}] ${issue.subject}`);
    console.error(`  ${issue.message}\n`);
  }
  console.error(`${result.issues.length} violation(s) found.`);
  process.exit(1);
}

main().catch((err) => {
  console.error("validate:world crashed:", err);
  process.exit(1);
});
