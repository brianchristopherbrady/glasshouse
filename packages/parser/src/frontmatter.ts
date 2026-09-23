/**
 * Minimal YAML-frontmatter splitter for `---\n...\n---\nbody` files.
 * Deliberately does not pull in a full YAML parser dependency yet — only
 * supports flat `key: value` and `key:\n  - item` list pairs, which is
 * sufficient for workflow/agent/skill frontmatter in practice. Values are
 * left as strings/string-arrays; callers coerce further as needed.
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
  return { frontmatter: parseFlatYaml(yamlBlock ?? ''), body: body ?? '' };
}

function parseFlatYaml(block: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = block.split(/\r?\n/);
  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  const flushList = () => {
    if (currentKey && currentList) {
      result[currentKey] = currentList;
    }
    currentKey = null;
    currentList = null;
  };

  for (const line of lines) {
    const listItemMatch = /^\s*-\s+(.*)$/.exec(line);
    if (listItemMatch && currentKey) {
      currentList = currentList ?? [];
      currentList.push(stripQuotes(listItemMatch[1] ?? ''));
      continue;
    }
    flushList();
    const kvMatch = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kvMatch) continue;
    const [, key, rawValue] = kvMatch;
    if (!key) continue;
    if (rawValue === undefined || rawValue === '') {
      currentKey = key;
      continue;
    }
    result[key] = coerceScalar(stripQuotes(rawValue));
  }
  flushList();
  return result;
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
