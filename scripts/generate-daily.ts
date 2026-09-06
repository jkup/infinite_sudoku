/**
 * Top up the canonical daily puzzles in D1.
 *
 *   npm run daily:generate -- [--days 7] [--from YYYY-MM-DD] [--local] [--env preview] [--dry-run]
 *
 * Reads which (date, mode) rows already exist for the window, generates the
 * missing ones with the shared engine, and inserts them idempotently through
 * `wrangler d1 execute`. Remote runs need Wrangler credentials: a logged-in
 * session locally, or CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in CI.
 * `--dry-run` prints the SQL instead of executing it.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { generatePuzzle } from '../src/engine/generator';
import { addDays, utcDateString } from '../src/lib/daily';
import { dailyInsertSql, existingDailiesSql, missingDailies, parseD1Rows, planDailies } from './daily/plan';

const { values } = parseArgs({
  options: {
    days: { type: 'string', default: '7' },
    from: { type: 'string', default: utcDateString() },
    local: { type: 'boolean', default: false },
    env: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

const days = Number(values.days);
const from = values.from;
const target = values.local ? '--local' : '--remote';
const envArgs = values.env ? ['--env', values.env] : [];

function wrangler(args: string[]): string {
  return execFileSync('npx', ['--no-install', 'wrangler', 'd1', 'execute', 'DB', target, ...envArgs, ...args], {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
}

const plan = planDailies(from, days);
const to = addDays(from, days - 1);
console.log(`Checking daily puzzles from ${from} to ${to} (${target.slice(2)})…`);

const existing = parseD1Rows<{ date: string; mode: string }>(wrangler(['--json', '--command', existingDailiesSql(from, to)]));
const missing = missingDailies(plan, existing);
if (missing.length === 0) {
  console.log(`All ${plan.length} daily puzzles already exist. Nothing to do.`);
  process.exit(0);
}

console.log(`Generating ${missing.length} missing puzzle(s)…`);
const statements: string[] = [];
for (const entry of missing) {
  const startedAt = Date.now();
  const puzzle = generatePuzzle(entry.difficulty, entry.mode);
  statements.push(dailyInsertSql(entry, puzzle));
  console.log(`  ${entry.date} ${entry.mode.padEnd(7)} ${entry.difficulty.padEnd(6)} ${Date.now() - startedAt} ms`);
}
const sql = `${statements.join('\n\n')}\n`;

if (values['dry-run']) {
  process.stdout.write(sql);
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), 'infinite-sudoku-daily-'));
try {
  const file = join(dir, 'daily-puzzles.sql');
  writeFileSync(file, sql);
  wrangler(['--yes', '--file', file]);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`Inserted ${missing.length} daily puzzle(s).`);
