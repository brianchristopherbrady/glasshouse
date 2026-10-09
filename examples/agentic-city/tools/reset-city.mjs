// Restores city/ to its committed state (Day 3 of the Founding) and forgets
// recorder session state. Recorded runs in Agentic Flows are kept.
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { STATE_DIR_NAME, WORKSPACE_ROOT } from './recorder-core.mjs';

const git = (...args) =>
  execFileSync('git', args, { cwd: WORKSPACE_ROOT, stdio: ['ignore', 'pipe', 'inherit'] })
    .toString()
    .trim();

// `git clean` below would delete an uncommitted city outright.
if (!git('ls-files', '--', 'city/charter.md')) {
  console.error('city/ is not committed to git yet, so there is nothing to reset it to.');
  process.exit(1);
}
git('checkout', '--', 'city');
git('clean', '-fdq', '--', 'city');
rmSync(join(WORKSPACE_ROOT, STATE_DIR_NAME, 'sessions'), { recursive: true, force: true });
console.log('Agentic City restored to its committed state.');
