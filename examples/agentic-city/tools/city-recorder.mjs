// Hook entry point for Agentic City's agents (see the `hooks:` block in each
// .github/agents/*.agent.md). Reads the hook payload from stdin, records it,
// and always answers `{}` with exit code 0: recording must never block or
// alter what an agent does.
import { parseArgs, runHook } from './recorder-core.mjs';

const args = parseArgs(process.argv.slice(2));
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', async () => {
  await runHook(input, args);
  process.stdout.write('{}');
});
