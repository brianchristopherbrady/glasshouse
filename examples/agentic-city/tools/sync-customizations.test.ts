import { describe, expect, it } from 'vitest';
import { checkMirror, renderMirror, rewritePaths } from './sync-customizations.mjs';

describe('root .github mirror of Agentic City', () => {
  it('rewrites workspace paths to repository paths', () => {
    expect(rewritePaths('read `city/charter.md`; run node tools/city-recorder.mjs')).toBe(
      'read `examples/agentic-city/city/charter.md`; run node examples/agentic-city/tools/city-recorder.mjs',
    );
    expect(rewritePaths("applyTo: 'city/**'")).toBe("applyTo: 'examples/agentic-city/city/**'");
    expect(rewritePaths('examples/agentic-city/city/x.md and a-city/x')).toBe(
      'examples/agentic-city/city/x.md and a-city/x',
    );
  });

  it('mirrors every agent, skill, prompt, and instruction, and AGENTS.md as a scoped instruction', () => {
    const paths = [...renderMirror().keys()];
    expect(paths.filter((p) => p.startsWith('.github/agents/'))).toHaveLength(5);
    expect(paths.filter((p) => p.endsWith('/SKILL.md'))).toHaveLength(4);
    expect(paths.filter((p) => p.startsWith('.github/prompts/'))).toHaveLength(4);
    expect(paths).toContain('.github/instructions/agentic-city.instructions.md');
  });

  it('is up to date on disk (run `npm run city:sync` after editing the city)', () => {
    expect(checkMirror()).toEqual([]);
  });
});
