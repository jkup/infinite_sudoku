# Repository guidance

## Work sequence

- Treat `ROADMAP.md` as the implementation plan. Complete tasks one at a time in
  dependency-safe order, add a dated `**Status:** Complete` line only after the
  acceptance criteria are verified, and make a focused commit for each task.
- `TODO.md` is an untracked, user-owned file. Do not edit, stage, commit, or
  delete it unless the user explicitly asks.
- Preserve unrelated worktree changes and avoid destructive Git operations.

## Verification

- Run `npm run check` before committing implementation changes. It verifies
  generated Cloudflare types, zero-warning lint, coverage thresholds, Workers/D1
  integration tests, all TypeScript projects, and the production build.
- Workers tests and Wrangler type generation may require permission to open a
  local loopback socket.
- `npm audit --audit-level=high` is the blocking dependency-security policy; see
  `docs/DEPENDENCY_SECURITY.md` for remediation and exception requirements.

## Cloudflare and D1

- `worker-configuration.d.ts` is generated. Never hand-edit it. After changing
  `wrangler.toml`, bindings, or environment-variable names, run
  `npm run types:cloudflare` and commit the exact generated output.
- `db/migrations/` is the only schema source of truth. Applied migrations are
  append-only: create the next numbered migration instead of editing an existing
  one. Follow `docs/D1_MIGRATIONS.md` for local verification, deployment, backup,
  and recovery.
- Keep secrets in Cloudflare secrets or ignored `.dev.vars` files. Never commit
  secret values or production database exports.
