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
