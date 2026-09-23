import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { expandFileGlob } from './glob.js';
import { parseFrontmatter } from './frontmatter.js';
import type { DiscoveredSkill } from './types.js';

function toPosix(p: string): string {
  return p.split('\\').join('/');
}

const SKILL_ROOTS = ['.github/skills', '.agents/skills', '.claude/skills'];

/**
 * Discovers SKILL.md files under any of the three conventional skill
 * directories, plus sibling scripts/resources in the same skill folder.
 */
export function discoverSkills(rootDir: string): DiscoveredSkill[] {
  const skills: DiscoveredSkill[] = [];
  for (const root of SKILL_ROOTS) {
    const files = expandFileGlob(rootDir, `${root}/*/SKILL.md`);
    for (const file of files) {
      const raw = readFileSync(file, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(raw);
      const skillDir = dirname(file);
      const name =
        typeof frontmatter.name === 'string' ? frontmatter.name : relative(join(rootDir, root), skillDir).split(/[\\/]/)[0];
      const description =
        typeof frontmatter.description === 'string' ? frontmatter.description : undefined;

      const siblings = safeReadDir(skillDir).filter((f) => f !== 'SKILL.md');
      const scripts = siblings.filter((f) => /\.(sh|mjs|js|ts|py|ps1)$/.test(f));
      const resources = siblings.filter((f) => !scripts.includes(f));

      skills.push({
        path: toPosix(relative(rootDir, file)),
        name: name ?? 'unknown-skill',
        description,
        frontmatter,
        body,
        scripts: scripts.length > 0 ? scripts : undefined,
        resources: resources.length > 0 ? resources : undefined,
      });
    }
  }
  return skills;
}

function safeReadDir(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name);
  } catch {
    return [];
  }
}
