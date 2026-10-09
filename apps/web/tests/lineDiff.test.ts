import { describe, expect, it } from 'vitest';
import { unifiedDiff } from '../src/compare/lineDiff.js';

describe('unifiedDiff', () => {
  it('returns nothing for identical text', () => {
    expect(unifiedDiff('a\nb\n', 'a\r\nb\r\n')).toEqual({ diff: '', additions: 0, deletions: 0 });
  });

  it('produces one hunk with context for a modified line', () => {
    const result = unifiedDiff('a\nb\nc\nd\ne\nf\ng\nh\n', 'a\nb\nc\nd\nE\nf\ng\nh\n');
    expect(result).toMatchObject({ additions: 1, deletions: 1 });
    expect(result.diff.split('\n')).toEqual([
      '@@ -2,7 +2,7 @@',
      ' b',
      ' c',
      ' d',
      '-e',
      '+E',
      ' f',
      ' g',
      ' h',
    ]);
  });

  it('splits distant changes into separate hunks', () => {
    const before = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');
    const after = before.replace('line 2', 'LINE 2').replace('line 19', 'LINE 19');
    const hunks = unifiedDiff(before, after).diff.split('\n').filter((l) => l.startsWith('@@'));
    expect(hunks).toEqual(['@@ -1,5 +1,5 @@', '@@ -16,5 +16,5 @@']);
  });

  it('diffs a created file against nothing', () => {
    expect(unifiedDiff('', 'one\ntwo\n')).toEqual({
      diff: '@@ -0,0 +1,2 @@\n+one\n+two',
      additions: 2,
      deletions: 0,
    });
  });
});
