import { readFileSync } from 'node:fs';
import { relative, basename } from 'node:path';
import { expandFileGlob } from './glob.js';
import { parseFrontmatter } from './frontmatter.js';
import type { DiscoveredAgent } from './types.js';

function toPosix(p: string): string {
  return p.split('\\').join('/');
}

function asStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return [value];
  return undefined;
}

/** Discovers `.github/agents/*.md` custom agent definitions. */
export function discoverAgents(rootDir: string): DiscoveredAgent[] {
  const files = expandFileGlob(rootDir, '.github/agents/*.md');
  return files.map((file) => {
    const raw = readFileSync(file, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(raw);
    const name =
      typeof frontmatter.name === 'string' ? frontmatter.name : basename(file, '.md');

    return {
      path: toPosix(relative(rootDir, file)),
      name,
      frontmatter,
      body,
      tools: asStringArray(frontmatter.tools),
      mcpServers: asStringArray(frontmatter.mcpServers ?? frontmatter['mcp-servers']),
      configuredSkills: asStringArray(frontmatter.skills),
    };
  });
}
