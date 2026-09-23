import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../src/frontmatter.js';

describe('parseFrontmatter', () => {
  it('splits frontmatter and body', () => {
    const raw = '---\nname: triage-agent\n---\nBody text here.';
    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter.name).toBe('triage-agent');
    expect(body).toBe('Body text here.');
  });

  it('parses a flat list value', () => {
    const raw = '---\ntools:\n  - github\n  - search\n---\nBody.';
    const { frontmatter } = parseFrontmatter(raw);
    expect(frontmatter.tools).toEqual(['github', 'search']);
  });

  it('coerces booleans and numbers', () => {
    const raw = '---\nenabled: true\ncount: 3\n---\nBody.';
    const { frontmatter } = parseFrontmatter(raw);
    expect(frontmatter.enabled).toBe(true);
    expect(frontmatter.count).toBe(3);
  });

  it('returns the whole input as body when there is no frontmatter block', () => {
    const raw = 'Just plain content, no frontmatter.';
    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter).toEqual({});
    expect(body).toBe(raw);
  });
});
