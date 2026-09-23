import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git']);

/**
 * Hand-rolled file glob matcher (no dependency). Supports `*` (any chars
 * within one path segment) and `**` (zero or more path segments). Returns
 * absolute file paths, sorted. Directories are never returned, only files.
 */
export function expandFileGlob(rootDir: string, pattern: string): string[] {
  const segments = pattern.split('/');
  const results: string[] = [];
  walk(rootDir, segments, 0, results);
  return results.sort();
}

function walk(currentDir: string, segments: string[], segIndex: number, results: string[]): void {
  if (segIndex >= segments.length) return;
  const segment = segments[segIndex];
  const isLast = segIndex === segments.length - 1;

  let entries;
  try {
    entries = readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  if (segment === '**') {
    // "**" matches zero segments (try the rest of the pattern here too)...
    walk(currentDir, segments, segIndex + 1, results);
    // ...or one-or-more directories deep, staying on "**" at each level.
    for (const entry of entries) {
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
        walk(join(currentDir, entry.name), segments, segIndex, results);
      }
    }
    return;
  }

  const regex = segmentToRegex(segment ?? '');
  for (const entry of entries) {
    if (!regex.test(entry.name)) continue;
    const full = join(currentDir, entry.name);
    if (isLast) {
      if (entry.isFile()) results.push(full);
    } else if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
      walk(full, segments, segIndex + 1, results);
    }
  }
}

function segmentToRegex(segment: string): RegExp {
  const escaped = segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}
