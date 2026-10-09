type Op = { t: ' ' | '+' | '-'; l: string };

function splitLines(text: string): string[] {
  if (!text) return [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function diffOps(a: string[], b: string[]): Op[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const ops: Op[] = a.slice(0, start).map((l) => ({ t: ' ', l }));
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  if (midA.length * midB.length > 4_000_000) {
    // Too large for an LCS table: show it as a full replacement.
    ops.push(...midA.map((l): Op => ({ t: '-', l })), ...midB.map((l): Op => ({ t: '+', l })));
  } else {
    const cols = midB.length + 1;
    const table = new Uint32Array((midA.length + 1) * cols);
    for (let i = midA.length - 1; i >= 0; i--) {
      for (let j = midB.length - 1; j >= 0; j--) {
        table[i * cols + j] =
          midA[i] === midB[j]
            ? table[(i + 1) * cols + j + 1]! + 1
            : Math.max(table[(i + 1) * cols + j]!, table[i * cols + j + 1]!);
      }
    }
    let i = 0;
    let j = 0;
    while (i < midA.length && j < midB.length) {
      if (midA[i] === midB[j]) {
        ops.push({ t: ' ', l: midA[i++]! });
        j++;
      } else if (table[(i + 1) * cols + j]! >= table[i * cols + j + 1]!) {
        ops.push({ t: '-', l: midA[i++]! });
      } else {
        ops.push({ t: '+', l: midB[j++]! });
      }
    }
    while (i < midA.length) ops.push({ t: '-', l: midA[i++]! });
    while (j < midB.length) ops.push({ t: '+', l: midB[j++]! });
  }
  ops.push(...a.slice(endA).map((l): Op => ({ t: ' ', l })));
  return ops;
}

/** Unified-diff hunks (no file header) plus line counts; same format as recorded diffs. */
export function unifiedDiff(
  before: string,
  after: string,
  context = 3,
): { diff: string; additions: number; deletions: number } {
  const ops = diffOps(splitLines(before), splitLines(after));
  let oldNo = 1;
  let newNo = 1;
  const numbered = ops.map((op) => {
    const entry = { ...op, old: oldNo, new: newNo };
    if (op.t !== '+') oldNo++;
    if (op.t !== '-') newNo++;
    return entry;
  });
  const changes = numbered.flatMap((op, i) => (op.t === ' ' ? [] : [i]));
  if (changes.length === 0) return { diff: '', additions: 0, deletions: 0 };

  const ranges: Array<[number, number]> = [];
  let start = changes[0]! - context;
  let end = changes[0]! + context;
  for (const idx of changes.slice(1)) {
    if (idx - context <= end + 1) end = idx + context;
    else {
      ranges.push([start, end]);
      start = idx - context;
      end = idx + context;
    }
  }
  ranges.push([start, end]);

  const hunks = ranges.map(([s, e]) => {
    const slice = numbered.slice(Math.max(0, s), Math.min(numbered.length, e + 1));
    const oldLines = slice.filter((o) => o.t !== '+');
    const newLines = slice.filter((o) => o.t !== '-');
    const oldStart = oldLines.length ? oldLines[0]!.old : slice[0]!.old - 1;
    const newStart = newLines.length ? newLines[0]!.new : slice[0]!.new - 1;
    return [
      `@@ -${oldStart},${oldLines.length} +${newStart},${newLines.length} @@`,
      ...slice.map((o) => `${o.t}${o.l}`),
    ].join('\n');
  });
  return {
    diff: hunks.join('\n'),
    additions: ops.filter((o) => o.t === '+').length,
    deletions: ops.filter((o) => o.t === '-').length,
  };
}
