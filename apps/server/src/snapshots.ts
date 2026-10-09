import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { discoverRepository, type DiscoveredRepository } from '@brianbrady/glasshouse-parser';
import type { PrismaClient } from '@prisma/client';
import { syncDiscovered } from './sync.js';

function fileName(path: string): string {
  return path.split('/').pop() ?? path;
}

function definitionFiles(d: DiscoveredRepository) {
  return [
    ...d.workflows.map((w) => ({ kind: 'workflow', path: w.path, name: w.name })),
    ...d.agents.map((a) => ({ kind: 'agent', path: a.path, name: a.name })),
    ...d.skills.map((s) => ({ kind: 'skill', path: s.path, name: s.name })),
    ...d.prompts.map((p) => ({ kind: 'prompt', path: p.path, name: p.name })),
    ...d.instructions.map((i) => ({ kind: 'instruction', path: i.path, name: fileName(i.path) })),
    ...d.hooks.map((h) => ({ kind: 'hook', path: h.path, name: fileName(h.path) })),
  ];
}

/**
 * Records the definition files (agents, skills, prompts, instructions, hooks,
 * workflows) a run in a local workspace started with, so runs made before and
 * after editing an agent can be compared. Also refreshes the repository's
 * discovered definitions. Only the first call per run has any effect.
 */
export async function captureRunDefinitions(
  prisma: PrismaClient,
  runId: string,
): Promise<number | null> {
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { repository: true },
  });
  if (!run || run.definitionsCapturedAt || run.repository.provider !== 'local') return null;

  const dir = run.repository.providerRepoId;
  if (!existsSync(dir)) throw new Error(`local workspace ${dir} no longer exists`);
  const discovered = discoverRepository(dir);
  await syncDiscovered(prisma, run.repositoryId, discovered);
  const files = definitionFiles(discovered).map((f) => {
    const content = readFileSync(join(dir, f.path), 'utf8').replace(/\r\n/g, '\n');
    return { ...f, content, sha256: createHash('sha256').update(content).digest('hex') };
  });

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.workflowRun.updateMany({
      where: { id: runId, definitionsCapturedAt: null },
      data: { definitionsCapturedAt: new Date() },
    });
    if (claimed.count === 0) return null;
    for (const f of files) {
      await tx.definitionBlob.upsert({
        where: { sha256: f.sha256 },
        create: { sha256: f.sha256, content: f.content },
        update: {},
      });
      await tx.runDefinition.create({
        data: { runId, kind: f.kind, path: f.path, name: f.name, sha256: f.sha256 },
      });
    }
    return files.length;
  });
}
