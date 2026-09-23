import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { expandFileGlob } from './glob.js';
import type { DiscoveredHook } from './types.js';

function toPosix(p: string): string {
  return p.split('\\').join('/');
}

/**
 * Discovers `.github/hooks/*.json`. A malformed hook file is skipped
 * rather than thrown — one broken hook must never abort discovery of
 * everything else in the repository.
 */
export function discoverHooks(rootDir: string): DiscoveredHook[] {
  const files = expandFileGlob(rootDir, '.github/hooks/*.json');
  const results: DiscoveredHook[] = [];
  for (const file of files) {
    try {
      const rawJson = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>;
      results.push({ path: toPosix(relative(rootDir, file)), rawJson });
    } catch {
      continue;
    }
  }
  return results;
}
