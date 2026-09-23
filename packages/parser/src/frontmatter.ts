/**
 * Minimal YAML-frontmatter splitter for `---\n...\n---\nbody` files.
 * Deliberately does not pull in a full YAML parser dependency yet — only
 * supports `key: value` scalars, `key:\n  - item` lists, and one or more
 * levels of `key:\n  nested: value` maps via indentation, which covers
 * workflow/agent/skill frontmatter in practice. Values are left as
 * strings/arrays/nested records; callers coerce further as needed.
 */
export interface ParsedFrontmatter {
  frontmatter: Record<string, unknown>;
  body: string;
}

export function parseFrontmatter(raw: string): ParsedFrontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    return { frontmatter: {}, body: raw };
  }
  const [, yamlBlock, body] = match;
  const lines = (yamlBlock ?? '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const { value } = parseBlock(lines, 0, 0);
  return { frontmatter: (value as Record<string, unknown>) ?? {}, body: body ?? '' };
}

interface BlockResult {
  value: unknown;
  nextIndex: number;
}

/** Parses a run of lines at exactly `indent` into a map or a list. */
function parseBlock(lines: string[], startIndex: number, indent: number): BlockResult {
  if (startIndex >= lines.length) return { value: {}, nextIndex: startIndex };
  const firstLine = lines[startIndex] ?? '';
  const isList = /^\s*-\s/.test(firstLine.slice(indent)) && indentOf(firstLine) === indent;

  if (isList) {
    const list: unknown[] = [];
    let i = startIndex;
    const contentIndent = indent + 2; // width of "- "
    while (i < lines.length) {
      const line = lines[i] ?? '';
      if (indentOf(line) !== indent) break;
      const itemMatch = /^\s*-\s?(.*)$/.exec(line.slice(indent));
      if (!itemMatch) break;
      const rest = itemMatch[1] ?? '';

      if (rest === '') {
        // "- " with nested content on following more-indented lines.
        const nested = parseBlock(lines, i + 1, contentIndent);
        list.push(nested.value);
        i = nested.nextIndex;
        continue;
      }

      const inlineKvMatch = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(rest);
      if (inlineKvMatch) {
        // "- key: value" starts an inline map; splice that first key/value
        // back onto a synthetic line so the map parser handles it (plus
        // any further-indented sibling keys) uniformly.
        const syntheticLines = [
          `${' '.repeat(contentIndent)}${rest}`,
          ...lines.slice(i + 1),
        ];
        const nested = parseBlock(syntheticLines, 0, contentIndent);
        list.push(nested.value);
        i += nested.nextIndex;
        continue;
      }

      list.push(coerceScalar(stripQuotes(rest)));
      i += 1;
    }
    return { value: list, nextIndex: i };
  }

  const map: Record<string, unknown> = {};
  let i = startIndex;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    const lineIndent = indentOf(line);
    if (lineIndent !== indent) break;
    const kvMatch = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.slice(indent));
    if (!kvMatch) {
      i += 1;
      continue;
    }
    const [, key, rawValue] = kvMatch;
    if (!key) {
      i += 1;
      continue;
    }
    if (rawValue === undefined || rawValue === '') {
      const nextLine = lines[i + 1];
      const nextIndent = nextLine ? indentOf(nextLine) : -1;
      if (nextIndent > indent) {
        const nested = parseBlock(lines, i + 1, nextIndent);
        map[key] = nested.value;
        i = nested.nextIndex;
        continue;
      }
      map[key] = undefined;
      i += 1;
      continue;
    }
    map[key] = coerceScalar(stripQuotes(rawValue));
    i += 1;
  }
  return { value: map, nextIndex: i };
}

function indentOf(line: string): number {
  const match = /^(\s*)/.exec(line);
  return match?.[1]?.length ?? 0;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function coerceScalar(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}
