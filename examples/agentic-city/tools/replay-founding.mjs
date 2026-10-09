// Plays a scripted "/found-district" session through the real recorder: the
// same hook payloads VS Code sends, and real edits to the city files, but no
// model. Useful for demoing Agentic Flows without a live Copilot session.
//
//   node tools/replay-founding.mjs        (or `npm run city:replay` from the repo root)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, runHook, WORKSPACE_ROOT } from './recorder-core.mjs';

const root = WORKSPACE_ROOT;
const sessionId = `replay-${Date.now()}`;
const ENGINE = 'scripted replay (no model)';

const PROJECTS = [
  {
    name: 'Noodle Heights',
    code: 'NH',
    vibe: 'built on a retired noodle factory',
    zoning: 'industrial-ish',
    population: '612 humans, 3 retired noodle-pulling machines on generous pensions',
    description:
      'The streets still smell faintly of broth. Steam vents hum lullabies at night, and every staircase is exactly one noodle wide (a generous noodle).',
    landmarks: [
      ['The Grand Colander', 5, 'A civic dome full of holes: legally a roof, emotionally a sieve.'],
      [
        'The Slurping Steps',
        1,
        "The district's required place to sit down, warmed by the old boiler room.",
      ],
    ],
    verdict: 'APPROVED WITH CONDITIONS',
    inspection:
      'Grand Colander sits exactly at the industrial-ish limit of 5 floors. Condition: the broth smell must stay pleasant (zone special rule).',
    headline: 'NOODLE HEIGHTS RISES FROM THE BROTH',
    goose: 'Loitering by the Slurping Steps, hoping for spillage.',
  },
  {
    name: 'Lower Fogbottom',
    code: 'LF',
    vibe: 'permanently a little foggy',
    zoning: 'residential',
    population: '845 humans, an unknown number of polite ghosts',
    description:
      'The fog rolls in every morning and forgets to leave. Neighbours recognise each other by voice, and the lamp posts wear tiny scarves.',
    landmarks: [
      ['The Mist Library', 3, 'Books are lent by whisper and returned by echo.'],
      ['The Bench That Remembers You', 1, 'The required place to sit down. It says hello by name.'],
    ],
    verdict: 'APPROVED',
    inspection: 'All seven checklist items pass. Visibility poor, paperwork excellent.',
    headline: 'LOWER FOGBOTTOM APPEARS, PROBABLY',
    goose: 'Lost in the fog for twenty minutes; found the bakery anyway.',
  },
  {
    name: 'Pigeon Exchange',
    code: 'PX',
    vibe: 'a bustling breadcrumb market run by pigeons',
    zoning: 'market',
    population: '230 humans, 4,000 pigeons with trading licences',
    description:
      'Crumbs change hands at dizzying speed. The opening bell is a single, dignified coo, and the closing bell is chaos.',
    landmarks: [
      ['The Breadcrumb Bourse', 4, 'Where crumb futures are traded and mostly eaten.'],
      [
        'The Perch of Fair Trade',
        1,
        'The required place to sit down, for humans and pigeons alike.',
      ],
    ],
    verdict: 'APPROVED WITH CONDITIONS',
    inspection:
      'Market rule: one stall must sell exactly one thing. It currently sells bread and more bread. Condition: pick one.',
    headline: 'PIGEON EXCHANGE OPENS; CRUMB PRICES SOAR',
    goose: 'Deeply unimpressed by the pigeons. Has filed a complaint.',
  },
];

const cityPath = (rel) => join(root, 'city', rel);
const read = (rel) => readFileSync(cityPath(rel), 'utf8');
const write = (rel, text) => writeFileSync(cityPath(rel), text);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const kebab = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const money = (n) => `₫${n.toLocaleString('en-US')}`;

function pickProject() {
  const fresh = PROJECTS.find((p) => !existsSync(cityPath(`districts/${kebab(p.name)}.md`)));
  if (fresh) return fresh;
  const n = Math.floor(Math.random() * 90) + 10;
  const base = PROJECTS[n % PROJECTS.length];
  return {
    ...base,
    name: `${base.name} ${n}`,
    code: `${base.code[0]}${n % 10}`,
    headline: `${base.headline} (AGAIN)`,
  };
}

// ------------------------------------------------------------ city edits

function nextDay() {
  const days = [...read('council-minutes.md').matchAll(/## Day (\d+) of the Founding/g)].map(
    (m) => +m[1],
  );
  return Math.max(0, ...days) + 1;
}

/** Picks two empty squares next to an existing district and claims them on the map. */
function claimSquares(code, name) {
  const lines = read('map.md').split('\n');
  const header = lines.find((l) => /^\s+A\s+B/.test(l)) ?? '     A    B    C    D    E';
  const letters = header.trim().split(/\s+/);
  const rows = lines
    .map((line, index) => ({ line, index, m: /^(\d+)\s+(\S{4}(?: \S{4})*)\s*$/.exec(line) }))
    .filter((r) => r.m)
    .map((r) => ({ index: r.index, row: r.m[1], cells: r.m[2].split(' ') }));
  const at = (r, c) => rows[r]?.cells[c];
  const isDistrict = (cell) => /^\[[A-Z0-9]{2}\]$/.test(cell ?? '');
  const squares = [];
  outer: for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].cells.length; c++) {
      if (at(r, c) !== '....') continue;
      const touches = [at(r - 1, c), at(r + 1, c), at(r, c - 1), at(r, c + 1)].some(isDistrict);
      if (!touches) continue;
      squares.push([r, c]);
      if (at(r, c + 1) === '....') squares.push([r, c + 1]);
      else if (at(r + 1, c) === '....') squares.push([r + 1, c]);
      break outer;
    }
  }
  if (squares.length === 0)
    throw new Error('No empty land left next to a district. Run `npm run city:reset`.');
  for (const [r, c] of squares) rows[r].cells[c] = `[${code}]`;
  for (const r of rows) lines[r.index] = `${r.row.padEnd(5)}${r.cells.join(' ')}`;
  const names = squares.map(([r, c]) => `${letters[c]}${rows[r].row}`).join(', ');
  write('map.md', `${lines.join('\n').trimEnd()}\n| ${code} | ${name} | ${names} |\n`);
  return names;
}

function districtFile(p, day, squares) {
  return [
    `# ${p.name}`,
    '',
    `- **Code:** ${p.code}`,
    `- **Squares:** ${squares}`,
    `- **Zoning:** ${p.zoning}`,
    `- **Founded:** Day ${day} of the Founding`,
    `- **Population:** ${p.population}`,
    '',
    '## Vibe',
    '',
    p.description,
    '',
    '## Landmarks',
    '',
    ...p.landmarks.map(
      ([name, floors, text]) =>
        `- **${name}** — ${floors} ${floors === 1 ? 'floor' : 'floors'}. ${text}`,
    ),
    '',
    '## Inspection notes',
    '',
  ].join('\n');
}

function appendToLastMinutes(bullet) {
  const text = read('council-minutes.md').trimEnd();
  const at = text.lastIndexOf('\n— the Mayor');
  write('council-minutes.md', `${text.slice(0, at).trimEnd()}\n${bullet}\n${text.slice(at)}\n`);
}

// ------------------------------------------------------------ hook calls

let toolSeq = 0;
let delivered = 0;
let queued = 0;

async function hook(event, agent, extra = {}) {
  const payload = {
    hook_event_name: event,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    cwd: root,
    ...extra,
  };
  const { delivery } = await runHook(JSON.stringify(payload), { agent, event }, { engine: ENGINE });
  delivered += delivery?.delivered ?? 0;
  queued = delivery?.queued ?? queued;
}

async function tool(agent, toolName, input, action) {
  const id = `replay-${sessionId}-${++toolSeq}`;
  await hook('PreToolUse', agent, { tool_name: toolName, tool_input: input, tool_use_id: id });
  await pause(200 + Math.random() * 350);
  const response = action();
  await hook('PostToolUse', agent, {
    tool_name: toolName,
    tool_input: input,
    tool_use_id: id,
    tool_response: response,
  });
  await pause(120);
}

const readFile = (agent, rel) =>
  tool(
    agent,
    'read_file',
    { filePath: join(root, rel), startLine: 1, endLine: 400 },
    () => `Read ${rel}.`,
  );

const editFile = (agent, rel, mutate) =>
  tool(agent, 'replace_string_in_file', { filePath: cityPath(rel) }, () => {
    mutate();
    return `Edited city/${rel}.`;
  });

async function subagent(parent, agent, brief, work) {
  const id = `replay-${sessionId}-${++toolSeq}`;
  const agentId = `${agent}-${toolSeq}`;
  const input = { agentName: agent, description: brief, prompt: brief };
  await hook('PreToolUse', parent, {
    tool_name: 'runSubagent',
    tool_input: input,
    tool_use_id: id,
  });
  await hook('SubagentStart', parent, { agent_id: agentId, agent_type: agent });
  await pause(300);
  const report = await work();
  await hook('SubagentStop', agent, {
    agent_id: agentId,
    agent_type: agent,
    last_assistant_message: report,
    stop_hook_active: false,
  });
  await hook('PostToolUse', parent, {
    tool_name: 'runSubagent',
    tool_input: input,
    tool_use_id: id,
    tool_response: report,
  });
  await pause(250);
}

// ----------------------------------------------------------------- script

async function main() {
  const p = pickProject();
  const day = nextDay();
  const file = `districts/${kebab(p.name)}.md`;
  const cost = 1000 + 250 * p.landmarks.length;
  console.log(`Replaying /found-district ${p.name} (Day ${day})…`);

  await hook('UserPromptSubmit', 'mayor', { prompt: `/found-district ${p.name}, ${p.vibe}` });
  await readFile('mayor', 'city/charter.md');
  await readFile('mayor', 'city/council-minutes.md');
  await editFile('mayor', 'council-minutes.md', () => {
    const text = read('council-minutes.md').trimEnd();
    write(
      'council-minutes.md',
      `${text}\n\n## Day ${day} of the Founding\n\n- The council founds **${p.name}**, ${p.vibe}, by popular demand and mild curiosity.\n\n— the Mayor\n`,
    );
  });

  let squares = '';
  await subagent(
    'mayor',
    'city-planner',
    `Design ${p.name} (${p.vibe}) for Day ${day} and put it on the map.`,
    async () => {
      await readFile('city-planner', '.github/skills/zoning-code/SKILL.md');
      await readFile('city-planner', '.github/skills/ascii-cartography/SKILL.md');
      await readFile('city-planner', 'city/map.md');
      await editFile('city-planner', 'map.md', () => {
        squares = claimSquares(p.code, p.name);
      });
      await tool('city-planner', 'create_file', { filePath: cityPath(file) }, () => {
        write(file, districtFile(p, day, squares));
        return `Created city/${file}.`;
      });
      return `Designed ${p.name} on ${squares} (zone ${p.zoning}) with ${p.landmarks.map(([n, f]) => `${n} (${f} fl.)`).join(' and ')}.`;
    },
  );

  const permits = read('permits.md');
  const permit = `P-${String(Math.max(0, ...[...permits.matchAll(/P-(\d+)/g)].map((m) => +m[1])) + 1).padStart(3, '0')}`;
  await subagent(
    'mayor',
    'building-inspector',
    `Inspect ${p.name} (city/${file}) against the zoning code. Day ${day}.`,
    async () => {
      await readFile('building-inspector', '.github/skills/zoning-code/SKILL.md');
      await readFile('building-inspector', `city/${file}`);
      await readFile('building-inspector', 'city/map.md');
      await editFile('building-inspector', 'permits.md', () => {
        write(
          'permits.md',
          `${read('permits.md').trimEnd()}\n| ${permit} | ${day} | ${p.name} | ${p.verdict} | ${p.inspection} |\n`,
        );
      });
      await editFile('building-inspector', file, () => {
        write(
          file,
          `${read(file).trimEnd()}\n\n- Day ${day}: ${p.verdict}. ${p.inspection} — the Building Inspector\n`,
        );
      });
      return `${permit}: ${p.verdict}. ${p.inspection}`;
    },
  );

  let balance = 0;
  await subagent(
    'mayor',
    'treasurer',
    `Pay for ${p.name}: district + ${p.landmarks.length} landmarks, permit ${permit} ${p.verdict}.`,
    async () => {
      await readFile('treasurer', '.github/skills/civic-budget/SKILL.md');
      await readFile('treasurer', 'city/ledger.md');
      await editFile('treasurer', 'ledger.md', () => {
        const rows = read('ledger.md')
          .split('\n')
          .filter((l) => /^\|\s*\d+\s*\|/.test(l));
        let previous = Number(rows.at(-1).split('|')[4].replace(/[^\d]/g, ''));
        const added = [];
        if (previous < cost) {
          // The treasury may never go below ₫0 (Charter Article II.4).
          previous += 5000;
          added.push(
            `| ${day} | Tourist tax (a coach party, extremely lost) | +${money(5000)} | ${money(previous)} | the Treasurer |`,
          );
        }
        balance = previous - cost;
        const entry = `${p.name} (district + ${p.landmarks.length} landmarks)`;
        added.push(`| ${day} | ${entry} | −${money(cost)} | ${money(balance)} | the Treasurer |`);
        write('ledger.md', `${read('ledger.md').trimEnd()}\n${added.join('\n')}\n`);
      });
      return `Recorded −${money(cost)} for ${p.name}. New balance ${money(balance)}.`;
    },
  );

  await editFile('mayor', 'council-minutes.md', () =>
    appendToLastMinutes(`- Outcome: ${p.verdict} (${permit}), cost ${money(cost)}.`),
  );
  await hook('Stop', 'mayor', { stop_hook_active: false });
  await pause(800);

  // The "Have the Town Crier announce it" handoff button.
  await hook('UserPromptSubmit', 'town-crier', {
    prompt:
      'Publish a new edition of the Gazette about what the council just decided. Use the newest entries in city/council-minutes.md, city/permits.md and city/ledger.md as your only sources.',
  });
  await readFile('town-crier', '.github/skills/gazette-style/SKILL.md');
  await readFile('town-crier', 'city/council-minutes.md');
  await readFile('town-crier', 'city/gazette.md');
  await editFile('town-crier', 'gazette.md', () => {
    const text = read('gazette.md');
    const edition = Math.max(0, ...[...text.matchAll(/## Edition (\d+)/g)].map((m) => +m[1])) + 1;
    const story = [
      `## Edition ${edition} — Day ${day} of the Founding`,
      '',
      `### ${p.headline}`,
      '',
      `The council founded ${p.name} today, ${p.vibe}. The Building Inspector issued permit ${permit} (${p.verdict}), and the Treasurer paid ${money(cost)}, leaving ${money(balance)} in the treasury.`,
      '',
      `> **Goose Watch:** ${p.goose}`,
      '',
    ].join('\n');
    const at = text.indexOf('\n## Edition');
    write(
      'gazette.md',
      at === -1
        ? `${text.trimEnd()}\n\n${story}`
        : `${text.slice(0, at + 1)}${story}\n${text.slice(at + 1)}`,
    );
  });
  await hook('Stop', 'town-crier', { stop_hook_active: false });

  const { serverUrl } = loadConfig(root);
  console.log(
    `Done: ${p.name} founded on Day ${day}. ${delivered} event(s) delivered to ${serverUrl}.`,
  );
  if (queued > 0) {
    console.log(
      `${queued} event(s) are queued because the server was unreachable; they are sent with the next recorded hook.`,
    );
  }
}

await main();
