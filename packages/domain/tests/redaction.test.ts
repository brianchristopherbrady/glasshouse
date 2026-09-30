import { describe, expect, it } from 'vitest';
import { redactSecrets, redactSecretsDeep } from '../src/redaction.js';

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

describe('redactSecretsDeep', () => {
  it('redacts string leaves nested inside objects and arrays', () => {
    const input = {
      command: 'curl -H "Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz0123456789"',
      args: ['safe', 'api_key: "sk-abc123def456ghi789"'],
      nested: { untouched: 'fine', note: 'token: "sk-abc123def456ghi789xyz"' },
    };
    const result = redactSecretsDeep(input);
    expect(result.command).toContain('[REDACTED]');
    expect(result.args[0]).toBe('safe');
    expect(result.args[1]).toContain('[REDACTED]');
    expect(result.nested.untouched).toBe('fine');
    expect(result.nested.note).toContain('[REDACTED]');
  });

  it('passes through non-string primitives unchanged', () => {
    expect(redactSecretsDeep(42)).toBe(42);
    expect(redactSecretsDeep(null)).toBe(null);
    expect(redactSecretsDeep(true)).toBe(true);
  });
});
