import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { expandFileGlob } from '../src/glob.js';

const FIXTURE_ROOT = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/acme-payments');

function toPosix(p: string): string {
  return p.split('\\').join('/');
}

describe('expandFileGlob', () => {
  it('matches a single-star pattern within one directory', () => {
    const files = expandFileGlob(FIXTURE_ROOT, '.github/workflows/*.md');
    const names = files.map((f) => toPosix(f).split('/').pop());
    expect(names.sort()).toEqual(['dependency-audit.md', 'issue-triage.md']);
  });

  it('matches a double-star pattern across nested directories', () => {
    const files = expandFileGlob(FIXTURE_ROOT, '.github/skills/**/SKILL.md');
    expect(files).toHaveLength(2);
  });

  it('returns an empty array for a pattern with no matches', () => {
    const files = expandFileGlob(FIXTURE_ROOT, '.github/does-not-exist/*.md');
    expect(files).toEqual([]);
  });

  it('never returns directories, only files', () => {
    const files = expandFileGlob(FIXTURE_ROOT, '.github/*');
    for (const f of files) {
      expect(toPosix(f)).not.toMatch(/\/(workflows|agents|skills|instructions|prompts|hooks)$/);
    }
  });
});
