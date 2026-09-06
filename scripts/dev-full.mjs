#!/usr/bin/env node
/**
 * Full-stack local development with HMR.
 *
 * Vite is the front door (open its URL). It proxies `/api/*` to a
 * `wrangler pages dev` process that runs the `functions/` routes with
 * `.dev.vars` and local D1. Wrangler serves `public/` as its static directory
 * only because it needs one; nothing else is requested from it.
 *
 * Wrangler 4 rejects the old `wrangler pages dev -- vite` proxy-command form
 * when `pages_build_output_dir` is configured, and with `--proxy` it prefers
 * the built `dist/` over Vite for HTML, so the proxy runs in this direction.
 *
 *   VITE_PORT=5173 PAGES_PORT=8788 npm run dev:full
 */
import { spawn } from 'node:child_process';

const vitePort = process.env.VITE_PORT ?? '5173';
const pagesPort = process.env.PAGES_PORT ?? '8788';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const env = { ...process.env, PAGES_PORT: pagesPort };

const children = [
  ['wrangler', ['--no-install', 'wrangler', 'pages', 'dev', 'public', '--port', pagesPort]],
  ['vite', ['--no-install', 'vite', '--port', vitePort, '--strictPort']],
].map(([name, args]) => {
  const child = spawn(npx, args, { stdio: 'inherit', env });
  child.on('exit', (code, signal) => stop(name, code ?? (signal ? 1 : 0)));
  return child;
});

let stopping = false;
function stop(reason, code) {
  if (stopping) return;
  stopping = true;
  if (typeof reason === 'string') console.log(`\n${reason} exited; shutting down.`);
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 200).unref();
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(signal, 0));
console.log(`Open http://localhost:${vitePort} (Vite + HMR); /api proxies to wrangler on :${pagesPort}`);
