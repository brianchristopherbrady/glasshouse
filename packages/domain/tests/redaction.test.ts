import { describe, expect, it } from 'vitest';
import { redactSecrets } from '../src/redaction.js';

describe('redactSecrets', () => {
  it('redacts GitHub personal access tokens', () => {
    const input = 'saw this in a log: ghp_abcdefghijklmnopqrstuvwxyz0123456789 nearby';
    expect(redactSecrets(input)).toBe('saw this in a log: [REDACTED] nearby');
  });

  it('redacts Authorization Bearer headers', () => {
    const input = 'Authorization: Bearer sometoken.value-here';
    expect(redactSecrets(input)).toBe('[REDACTED]');
  });

  it('redacts generic api_key= assignments', () => {
    const input = 'api_key: "sk-abc123def456ghi789"';
    expect(redactSecrets(input)).toContain('[REDACTED]');
  });

  it('leaves ordinary text untouched', () => {
    const input = 'This is a normal log line with no secrets.';
    expect(redactSecrets(input)).toBe(input);
  });
});
