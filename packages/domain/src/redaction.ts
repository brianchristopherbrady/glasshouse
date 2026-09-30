/**
 * Patterns for redacting secrets from logs, tool arguments, and results
 * before they are stored or displayed. Never display raw tokens/keys.
 */
const REDACTION_PATTERNS: RegExp[] = [
  /gh[pousr]_[A-Za-z0-9]{20,}/g, // GitHub tokens (ghp_, gho_, ghu_, ghs_, ghr_)
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /sk-[A-Za-z0-9]{20,}/g, // OpenAI-style secret keys
  /Bearer\s+[A-Za-z0-9._-]+/gi, // Authorization headers
  /Authorization:\s*\S+/gi,
  /(api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^\s"']{6,}/gi,
];

const REDACTED = '[REDACTED]';

export function redactSecrets(input: string): string {
  let output = input;
  for (const pattern of REDACTION_PATTERNS) {
    output = output.replace(pattern, REDACTED);
  }
  return output;
}

/**
 * Recursively applies redactSecrets to every string leaf in an arbitrary
 * JSON-shaped value (span attributes, event data, etc.) — the same
 * patterns apply regardless of which field or nesting depth a secret
 * happens to land in.
 */
export function redactSecretsDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return redactSecrets(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactSecretsDeep(v)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = redactSecretsDeep(val);
    }
    return result as T;
  }
  return value;
}
