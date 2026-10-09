// Records Agentic City sessions into a running Glasshouse server, for the
// static GitHub Pages demo. Scripted replays run in a scratch copy of the city
// (the real one is never touched), and the Mayor's instructions change between
// runs so Compare has a real setup change to show.
//
//   GLASSHOUSE_URL=http://localhost:4000 node scripts/seed-demo-city.mjs
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const SERVER = (process.env.GLASSHOUSE_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const TOKEN = process.env.GLASSHOUSE_API_TOKEN;
const SOURCE = resolve(import.meta.dirname, '../examples/agentic-city');

const MAYOR_RULE_ANCHOR = '- The charter wins every argument, including arguments with you.';
const MAYOR_RULE_V2 =
  '- Brief the Treasurer with the exact number of landmarks, so no cost is ever guessed.';

async function api(method, path, body) {
  const res = await fetch(`${SERVER}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const scratch = mkdtempSync(join(tmpdir(), 'glasshouse-demo-'));
  // The folder name becomes the repository name: local/agentic-city.
  const city = join(scratch, 'agentic-city');
  try {
    cpSync(SOURCE, city, {
      recursive: true,
      filter: (src) => basename(src) !== '.city-recorder',
    });
    const { repository } = await api('POST', '/api/repositories/local', { path: city });

    const replay = async (label) => {
      const before = await api('GET', `/api/repositories/${repository.id}/runs`);
      execFileSync(process.execPath, [join(city, 'tools', 'replay-founding.mjs')], {
        env: { ...process.env, GLASSHOUSE_URL: SERVER },
        stdio: 'inherit',
      });
      const after = await api('GET', `/api/repositories/${repository.id}/runs`);
      const run = after.find((r) => !before.some((b) => b.id === r.id));
      if (!run) throw new Error('the replay did not record a run; is the server reachable?');
      if (label) await api('PUT', `/api/runs/${run.id}/saved`, { label });
      return run;
    };

    await replay('Baseline: mayor v1');

    const mayorPath = join(city, '.github', 'agents', 'mayor.agent.md');
    const mayor = readFileSync(mayorPath, 'utf8');
    if (!mayor.includes(MAYOR_RULE_ANCHOR)) {
      throw new Error(`mayor.agent.md no longer contains: ${MAYOR_RULE_ANCHOR}`);
    }
    writeFileSync(
      mayorPath,
      mayor.replace(MAYOR_RULE_ANCHOR, `${MAYOR_RULE_ANCHOR}\n${MAYOR_RULE_V2}`),
    );
    await replay('Mayor v2: exact landmark briefs');
    await replay();

    const runs = await api('GET', `/api/repositories/${repository.id}/runs`);
    console.log(`Recorded ${runs.length} Agentic City runs into ${SERVER}.`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
