// Real line-level diff between two text blobs, used for Flowbook's
// artifact-change UI ("+42 -17"). A compact LCS-based diff -- not a mock
// count, an actual longest-common-subsequence comparison of the two files'
// real lines, so the +/- numbers are genuinely derived from content.
export interface DiffResult {
  added: number;
  removed: number;
  /** Unified-diff-style lines: unchanged lines prefixed " ", added "+", removed "-". */
  hunks: string[];
}

function splitLines(text: string): string[] {
  if (text.length === 0) return [];
  return text.split(/\r?\n/);
}

/** Longest common subsequence table over two line arrays (classic DP), then
 * backtracked into a diff. O(n*m) -- fine for the small text artifacts a
 * demo workflow operates on; not intended for huge files. */
export function diffLines(oldText: string, newText: string): DiffResult {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const n = a.length;
  const m = b.length;

  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const hunks: string[] = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      hunks.push(` ${a[i]}`);
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      hunks.push(`-${a[i]}`);
      removed++;
      i++;
    } else {
      hunks.push(`+${b[j]}`);
      added++;
      j++;
    }
  }
  while (i < n) {
    hunks.push(`-${a[i]}`);
    removed++;
    i++;
  }
  while (j < m) {
    hunks.push(`+${b[j]}`);
    added++;
    j++;
  }

  return { added, removed, hunks };
}
