#!/usr/bin/env node
// Snapshots the live demo API into static JSON files consumed by the
// GitHub Pages build (apps/web/public/demo-data/). GitHub Pages can only
// serve static files, so this replaces the Fastify + Prisma backend for
// the hosted demo only; local development still uses the real API.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API_BASE = process.env.EXPORT_API_BASE ?? 'http://localhost:4000';
const OUT_DIR = path.resolve(import.meta.dirname, '../apps/web/public/demo-data');

async function getJson(apiPath) {
  const res = await fetch(`${API_BASE}${apiPath}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${apiPath} -> ${res.status} ${res.statusText}`);
  return res.json();
}

async function writeJson(relPath, data) {
  const filePath = path.join(OUT_DIR, relPath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('wrote', path.relative(OUT_DIR, filePath));
}

async function main() {
  const repositories = await getJson('/api/repositories');
  await writeJson('repositories.json', repositories);

  for (const repo of repositories) {
    const repoId = repo.id;
    await writeJson(`repositories/${repoId}.json`, repo);

    const [overview, workflows, agents, skills, files, relationships, architecture, runs] =
      await Promise.all([
        getJson(`/api/repositories/${repoId}/overview`),
        getJson(`/api/repositories/${repoId}/workflows`),
        getJson(`/api/repositories/${repoId}/agents`),
        getJson(`/api/repositories/${repoId}/skills`),
        getJson(`/api/repositories/${repoId}/files`),
        getJson(`/api/repositories/${repoId}/relationships`),
        getJson(`/api/repositories/${repoId}/architecture`),
        getJson(`/api/repositories/${repoId}/runs`),
      ]);

    await writeJson(`repositories/${repoId}/overview.json`, overview);
    await writeJson(`repositories/${repoId}/workflows.json`, workflows);
    await writeJson(`repositories/${repoId}/agents.json`, agents);
    await writeJson(`repositories/${repoId}/skills.json`, skills);
    await writeJson(`repositories/${repoId}/files.json`, files);
    await writeJson(`repositories/${repoId}/relationships.json`, relationships);
    await writeJson(`repositories/${repoId}/architecture.json`, architecture);
    await writeJson(`repositories/${repoId}/runs.json`, runs);

    for (const run of runs) {
      const runId = run.id;
      const [
        runDetail,
        trace,
        events,
        runFiles,
        runAgents,
        runSkills,
        tools,
        logs,
        github,
        metrics,
        drift,
      ] = await Promise.all([
        getJson(`/api/runs/${runId}`),
        getJson(`/api/runs/${runId}/trace`),
        getJson(`/api/runs/${runId}/events`),
        getJson(`/api/runs/${runId}/files`),
        getJson(`/api/runs/${runId}/agents`),
        getJson(`/api/runs/${runId}/skills`),
        getJson(`/api/runs/${runId}/tools`),
        getJson(`/api/runs/${runId}/logs`),
        getJson(`/api/runs/${runId}/github`),
        getJson(`/api/runs/${runId}/metrics`),
        getJson(`/api/runs/${runId}/drift`),
      ]);

      await writeJson(`runs/${runId}.json`, runDetail);
      await writeJson(`runs/${runId}/trace.json`, trace);
      await writeJson(`runs/${runId}/events.json`, events);
      await writeJson(`runs/${runId}/files.json`, runFiles);
      await writeJson(`runs/${runId}/agents.json`, runAgents);
      await writeJson(`runs/${runId}/skills.json`, runSkills);
      await writeJson(`runs/${runId}/tools.json`, tools);
      await writeJson(`runs/${runId}/logs.json`, logs);
      await writeJson(`runs/${runId}/github.json`, github);
      await writeJson(`runs/${runId}/metrics.json`, metrics);
      await writeJson(`runs/${runId}/drift.json`, drift);
    }
  }

  console.log(`\nExported static demo data for ${repositories.length} repositories to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
