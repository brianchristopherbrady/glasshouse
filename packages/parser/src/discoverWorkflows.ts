import { readFileSync, existsSync } from 'node:fs';
import { relative, basename } from 'node:path';
import { expandFileGlob } from './glob.js';
import { parseFrontmatter } from './frontmatter.js';
import type { DiscoveredWorkflow } from './types.js';

function toPosix(p: string): string {
  return p.split('\\').join('/');
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return [value];
  return [];
}

function asStringRecord(value: unknown): Record<string, string> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, String(v)]));
  }
  return undefined;
}

/** Discovers `.github/workflows/*.md` GitHub Agentic Workflow definitions. */
export function discoverWorkflows(rootDir: string): DiscoveredWorkflow[] {
  const files = expandFileGlob(rootDir, '.github/workflows/*.md');
  return files.map((file) => {
    const raw = readFileSync(file, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(raw);
    const relPath = toPosix(relative(rootDir, file));
    const name = basename(file, '.md');

    const triggers = deriveTriggers(frontmatter);
    const engine = typeof frontmatter.engine === 'string' ? frontmatter.engine : undefined;
    const permissions = asStringRecord(frontmatter.permissions);
    const safeOutputs = frontmatter['safe-outputs']
      ? asStringArray(frontmatter['safe-outputs'])
      : frontmatter.safeOutputs
        ? asStringArray(frontmatter.safeOutputs)
        : undefined;

    const lockPath = file.replace(/\.md$/, '.lock.yml');
    const compiled = existsSync(lockPath)
      ? { path: toPosix(relative(rootDir, lockPath)), rawYaml: readFileSync(lockPath, 'utf-8') }
      : undefined;

    return {
      path: relPath,
      name,
      frontmatter,
      body,
      triggers,
      engine,
      permissions,
      safeOutputs,
      compiled,
    };
  });
}

/**
 * Derives a flat trigger list from frontmatter's `on:` field, which may be
 * a bare string, a list of strings, or a map of event -> config/subtypes.
 */
function deriveTriggers(frontmatter: Record<string, unknown>): string[] {
  const on = frontmatter.on;
  if (typeof on === 'string') return [on];
  if (Array.isArray(on)) return on.map(String);
  if (on && typeof on === 'object') return Object.keys(on);
  return [];
}
