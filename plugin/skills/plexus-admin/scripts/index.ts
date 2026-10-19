import { run } from './cli.ts';
import { createInterface } from 'node:readline/promises';
const args = process.argv.slice(2);
if (!args.includes('--help') && !args.includes('skill') && !process.env.PLEXUS_URL && !args.includes('--url')) {
  process.stderr.write('Set PLEXUS_URL or --url explicitly. No implicit target.\n');
  process.exit(2);
}
process.exitCode = await run(args, process.env, {
 fetch: (input, init) => fetch(input, {...init, redirect: 'error', signal: AbortSignal.timeout(30000)}),
 stdin: async () => { let text = ''; for await (const chunk of process.stdin) text += chunk; return text; },
 stdout: text => process.stdout.write(text), stderr: text => process.stderr.write(text),
 isTTY: Boolean(process.stdout.isTTY),
 confirm: async message => {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({input:process.stdin, output:process.stderr});
  try { return ['y','yes'].includes((await rl.question(`${message} [y/N] `)).trim().toLowerCase()); }
  finally { rl.close(); }
 }
});
