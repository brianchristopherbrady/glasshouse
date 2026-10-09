// Mirrors this workspace's agents, skills, prompts, and instructions into the
// repository root's .github/, so the city's agents also work when the whole
// repository is open in VS Code (it only loads customizations from the folder
// you open). Paths are rewritten to be relative to the repository root.
//
//   npm run city:sync           regenerate the mirror
//   npm run city:sync -- --check  fail if the mirror is out of date
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WORKSPACE_ROOT } from './recorder-core.mjs';

export const REPO_ROOT = resolve(WORKSPACE_ROOT, '..', '..');
const PREFIX = 'examples/agentic-city';
const KINDS = ['agents', 'skills', 'prompts', 'instructions'];
const MARKER = `Generated from ${PREFIX}`;

const toPosix = (p) => p.split(sep).join('/');
const read = (file) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

/** `city/x` and `tools/x` are workspace-relative; make them repository-relative. */
export function rewritePaths(text) {
  return text.replace(/(?<![\w./-])(city|tools)\//g, `${PREFIX}/$1/`);
}

function withMarker(text, source) {
  const marker = `<!-- ${MARKER}/${source} by \`npm run city:sync\`. Edit that file, not this copy. -->`;
  const frontmatter = /^---\n[\s\S]*?\n---\n/.exec(text);
  return frontmatter
    ? `${frontmatter[0]}\n${marker}\n${text.slice(frontmatter[0].length)}`
    : `${marker}\n\n${text}`;
}

/** Repository-relative path -> content of every mirrored file. */
export function renderMirror() {
  const files = new Map();
  for (const kind of KINDS) {
    const sourceDir = join(WORKSPACE_ROOT, '.github', kind);
    for (const file of walk(sourceDir)) {
      const rel = toPosix(relative(sourceDir, file));
      files.set(
        `.github/${kind}/${rel}`,
        withMarker(rewritePaths(read(file)), `.github/${kind}/${rel}`),
      );
    }
  }
  // AGENTS.md is always-on inside the city; at the root it must not leak into
  // every chat about the app, so it becomes an instruction scoped to the city.
  files.set(
    '.github/instructions/agentic-city.instructions.md',
    withMarker(
      [
        '---',
        `applyTo: '${PREFIX}/**'`,
        `description: Standing orders for the Agentic City demo agents. Applies only to files in ${PREFIX}.`,
        '---',
        '',
        rewritePaths(read(join(WORKSPACE_ROOT, 'AGENTS.md'))),
      ].join('\n'),
      'AGENTS.md',
    ),
  );
  return files;
}

/** Root files this script owns (they carry the marker), even if now stale. */
function existingMirrorFiles() {
  return KINDS.flatMap((kind) => walk(join(REPO_ROOT, '.github', kind)))
    .filter((file) => read(file).includes(MARKER))
    .map((file) => toPosix(relative(REPO_ROOT, file)));
}

/** Human-readable differences between the mirror on disk and the sources. */
export function checkMirror() {
  const wanted = renderMirror();
  const problems = [];
  for (const [path, content] of wanted) {
    const file = join(REPO_ROOT, path);
    if (!existsSync(file)) problems.push(`missing: ${path}`);
    else if (read(file) !== content) problems.push(`out of date: ${path}`);
  }
  for (const path of existingMirrorFiles()) {
    if (!wanted.has(path)) problems.push(`stale (source was removed): ${path}`);
  }
  return problems;
}

export function syncMirror() {
  const wanted = renderMirror();
  for (const path of existingMirrorFiles()) {
    if (!wanted.has(path)) rmSync(join(REPO_ROOT, path));
  }
  for (const [path, content] of wanted) {
    const file = join(REPO_ROOT, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return [...wanted.keys()];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv.includes('--check')) {
    const problems = checkMirror();
    if (problems.length > 0) {
      console.error(`The root .github mirror of ${PREFIX} is out of date:`);
      for (const problem of problems) console.error(`  ${problem}`);
      console.error('Run `npm run city:sync` and commit the result.');
      process.exit(1);
    }
    console.log('Root .github mirror of Agentic City is up to date.');
  } else {
    const written = syncMirror();
    console.log(`Mirrored ${written.length} Agentic City customization files into .github/.`);
  }
}
