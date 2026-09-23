import { readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expandFileGlob } from './glob.js';
import { parseFrontmatter } from './frontmatter.js';
import type { DiscoveredInstruction } from './types.js';

function toPosix(p: string): string {
  return p.split('\\').join('/');
}

/**
 * Discovers .github/copilot-instructions.md, .github/instructions/
 * *.instructions.md, and AGENTS.md.
 */
export function discoverInstructions(rootDir: string): DiscoveredInstruction[] {
  const results: DiscoveredInstruction[] = [];

  const copilotPath = join(rootDir, '.github/copilot-instructions.md');
  if (existsSync(copilotPath)) {
    results.push({
      path: '.github/copilot-instructions.md',
      kind: 'copilot-instructions',
      body: readFileSync(copilotPath, 'utf-8'),
    });
  }

  const agentsPath = join(rootDir, 'AGENTS.md');
  if (existsSync(agentsPath)) {
    results.push({
      path: 'AGENTS.md',
      kind: 'agents-md',
      body: readFileSync(agentsPath, 'utf-8'),
    });
  }

  for (const file of expandFileGlob(rootDir, '.github/instructions/*.instructions.md')) {
    const raw = readFileSync(file, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(raw);
    results.push({
      path: toPosix(relative(rootDir, file)),
      kind: 'scoped-instructions',
      applyTo: typeof frontmatter.applyTo === 'string' ? frontmatter.applyTo : undefined,
      body,
    });
  }

  return results;
}
