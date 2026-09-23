import { readFileSync } from 'node:fs';
import { relative, basename } from 'node:path';
import { expandFileGlob } from './glob.js';
import { parseFrontmatter } from './frontmatter.js';
import type { DiscoveredPrompt } from './types.js';

function toPosix(p: string): string {
  return p.split('\\').join('/');
}

/** Discovers `.github/prompts/*.prompt.md`. */
export function discoverPrompts(rootDir: string): DiscoveredPrompt[] {
  const files = expandFileGlob(rootDir, '.github/prompts/*.prompt.md');
  return files.map((file) => {
    const raw = readFileSync(file, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(raw);
    return {
      path: toPosix(relative(rootDir, file)),
      name: basename(file, '.prompt.md'),
      frontmatter,
      body,
    };
  });
}
