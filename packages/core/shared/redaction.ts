// Secret redaction + payload truncation, applied before anything is persisted
// or sent over SSE. Errs on the side of redacting too much rather than too
// little — see charter.md "TRACE SECURITY".
const SENSITIVE_KEY_PATTERN =
  /(api[-_]?key|token|secret|password|passwd|authorization|auth|cookie|bearer|private[-_]?key|access[-_]?key|client[-_]?secret)/i;

const SECRET_VALUE_PATTERNS: RegExp[] = [
  /bearer\s+[a-z0-9._-]+/gi,
  /sk-[a-zA-Z0-9]{16,}/g, // generic "sk-..." style API key
  /ghp_[a-zA-Z0-9]{20,}/g, // GitHub personal access token
  /gh[oprsu]_[a-zA-Z0-9]{20,}/g, // other GitHub token prefixes
  /AKIA[0-9A-Z]{16}/g, // AWS access key id
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export const REDACTED = "[REDACTED]";
export const TRUNCATED_SUFFIX = "…[payload truncated]";
export const MAX_STRING_LENGTH = 4000;

function redactString(value: string): string {
  let result = value;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    result = result.replace(pattern, REDACTED);
  }
  if (result.length > MAX_STRING_LENGTH) {
    result = result.slice(0, MAX_STRING_LENGTH) + TRUNCATED_SUFFIX;
  }
  return result;
}

/** Recursively redacts a value. `keyHint` is the object key this value was found under, if any. */
export function redact(value: unknown, keyHint?: string): unknown {
  if (typeof value === "string") {
    if (keyHint && SENSITIVE_KEY_PATTERN.test(keyHint)) {
      return REDACTED;
    }
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = redact(nested, key);
    }
    return result;
  }
  return value;
}

/** Redacts the mutable, potentially-sensitive parts of an event (metadata/raw). */
export function redactEventPayload<T extends { metadata?: Record<string, unknown>; raw?: unknown }>(
  event: T,
): T {
  return {
    ...event,
    ...(event.metadata !== undefined && { metadata: redact(event.metadata) as Record<string, unknown> }),
    ...(event.raw !== undefined && { raw: redact(event.raw) }),
  };
}
