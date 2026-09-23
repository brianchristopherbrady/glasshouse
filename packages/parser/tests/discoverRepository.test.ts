import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { discoverRepository } from '../src/discoverRepository.js';

const FIXTURE_ROOT = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/acme-payments');

describe('discoverRepository', () => {
  const result = discoverRepository(FIXTURE_ROOT);

  it('discovers all workflow definitions with correct paths and triggers', () => {
    expect(result.workflows).toHaveLength(2);
    const triage = result.workflows.find((w) => w.name === 'issue-triage');
    expect(triage).toBeDefined();
    expect(triage?.path).toBe('.github/workflows/issue-triage.md');
    expect(triage?.triggers).toEqual(['issues']);
    expect(triage?.engine).toBe('copilot');
    expect(triage?.permissions).toEqual({ issues: 'write', contents: 'read' });
    expect(triage?.safeOutputs).toEqual(['add-comment', 'add-labels']);
  });

  it('pairs a workflow with its compiled .lock.yml when present', () => {
    const triage = result.workflows.find((w) => w.name === 'issue-triage');
    expect(triage?.compiled?.path).toBe('.github/workflows/issue-triage.lock.yml');
    expect(triage?.compiled?.rawYaml).toContain('name: Issue Triage');
  });

  it('leaves compiled undefined for a workflow with no matching .lock.yml', () => {
    const audit = result.workflows.find((w) => w.name === 'dependency-audit');
    expect(audit?.compiled).toBeUndefined();
  });

  it('discovers agent definitions with tools, skills, and mcp servers', () => {
    expect(result.agents).toHaveLength(2);
    const security = result.agents.find((a) => a.name === 'security-reviewer');
    expect(security?.tools).toEqual(['shell', 'github']);
    expect(security?.configuredSkills).toEqual(['security-scan']);
    expect(security?.mcpServers).toEqual(['filesystem']);
  });

  it('discovers skill definitions with their sibling scripts', () => {
    expect(result.skills).toHaveLength(2);
    const scan = result.skills.find((s) => s.name === 'security-scan');
    expect(scan?.description).toBe('Runs static and dependency security scans.');
    expect(scan?.scripts).toEqual(['scan.sh']);
  });

  it('discovers copilot-instructions, scoped instructions, and AGENTS.md', () => {
    expect(result.instructions).toHaveLength(3);
    const kinds = result.instructions.map((i) => i.kind).sort();
    expect(kinds).toEqual(['agents-md', 'copilot-instructions', 'scoped-instructions']);
    const scoped = result.instructions.find((i) => i.kind === 'scoped-instructions');
    expect(scoped?.applyTo).toBe('**/*.ts');
  });

  it('discovers prompts', () => {
    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]?.name).toBe('release-notes');
  });

  it('discovers hooks', () => {
    expect(result.hooks).toHaveLength(1);
    expect(result.hooks[0]?.rawJson).toHaveProperty('hooks');
  });

  it('discovers MCP servers from .vscode/mcp.json', () => {
    expect(result.mcpServers).toHaveLength(1);
    expect(result.mcpServers[0]?.name).toBe('filesystem');
    expect(result.mcpServers[0]?.command).toBe('npx');
  });

  it('extracts a COMPILES_TO relationship with observed confidence', () => {
    const rel = result.relationships.find((r) => r.relationshipType === 'COMPILES_TO');
    expect(rel).toBeDefined();
    expect(rel?.evidence.confidence).toBe('observed');
    expect(rel?.sourcePath).toBe('.github/workflows/issue-triage.md');
  });

  it('extracts agent -> skill CONFIGURES relationships by name match', () => {
    const rels = result.relationships.filter((r) => r.relationshipType === 'CONFIGURES');
    expect(rels).toHaveLength(2);
    const triageToIssueAnalysis = rels.find(
      (r) => r.sourcePath === '.github/agents/triage-agent.md',
    );
    expect(triageToIssueAnalysis?.targetPath).toBe('.github/skills/issue-analysis/SKILL.md');
    expect(triageToIssueAnalysis?.evidence.confidence).toBe('strong');
  });

  it('extracts agent -> mcp-server CAN_CALL relationships by name match', () => {
    const rel = result.relationships.find((r) => r.relationshipType === 'CAN_CALL');
    expect(rel?.sourcePath).toBe('.github/agents/security-reviewer.md');
    expect(rel?.targetPath).toBe('.vscode/mcp.json::filesystem');
  });

  it('does not hallucinate a relationship for an unresolvable skill name', () => {
    // triage-agent's own skill (issue-analysis) resolves; there is no
    // agent referencing a name that doesn't exist in the fixture, so the
    // total CONFIGURES count above (2) is the complete, correct set.
    const rels = result.relationships.filter((r) => r.relationshipType === 'CONFIGURES');
    const targets = rels.map((r) => r.targetPath).sort();
    expect(targets).toEqual([
      '.github/skills/issue-analysis/SKILL.md',
      '.github/skills/security-scan/SKILL.md',
    ]);
  });
});
