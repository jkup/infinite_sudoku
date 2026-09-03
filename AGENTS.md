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
  `wrangler.jsonc`, bindings, or environment-variable names, run
  `npm run types:cloudflare` and commit the exact generated output.
- `db/migrations/` is the only schema source of truth. Applied migrations are
  append-only: create the next numbered migration instead of editing an existing
  one. Follow `docs/D1_MIGRATIONS.md` for local verification, deployment, backup,
  and recovery.
- Keep secrets in Cloudflare secrets or ignored `.dev.vars` files. Never commit
  secret values or production database exports.

## Current session handoff

- Twenty of the 31 roadmap tasks are complete. The next task is `A11Y-001`:
  implement a fully keyboard-operable Sudoku grid. No implementation changes for
  this task have been made yet.
- At the start of the next session, the user intends to say “try the incognito
  test!” Use the browser-control skill to connect specifically to Chrome and
  inspect the already-open incognito tab at `http://localhost:4173`.
- The ChatGPT browser extension is installed and allowed in incognito. Its side
  panel does not need to be prompted; Codex should control the page directly.
- The previous connection attempt failed before browser discovery with
  `Browser use requires a trusted Node REPL browser service`. The user is
  restarting Codex to provision that service. If it still fails, follow the
  browser skill's Chrome/bootstrap troubleshooting instructions before asking
  the user to change more settings.
- The intended browser check is the outstanding hands-on verification after
  `OPS-005`, followed by implementation of `A11Y-001` in the roadmap order.
