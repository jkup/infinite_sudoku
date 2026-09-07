# Infinite Sudoku

Infinite Sudoku is a React/TypeScript puzzle app with classic and killer modes,
nested hint puzzles, tutorials, offline/PWA support, optional Clerk sign-in, and
Cloudflare-backed statistics and leaderboards.

## Architecture

- `src/` is the Vite/React client. Zustand stores own application state and
  `src/engine/` contains puzzle generation and validation.
- Puzzle generation runs in `src/engine/puzzleWorker.ts` when Web Workers are
  available. Versioned game saves stay in browser `localStorage`.
- `functions/` contains Cloudflare Pages Functions. File-based routes expose
  `/api/*`, while `_middleware.ts` verifies Clerk sessions.
- Cloudflare D1 stores results, daily puzzles, and aggregate user statistics.
  `db/migrations/` is the only schema source of truth.
- Vite Plugin PWA generates the service worker and manifest at build time.

The app remains playable without Clerk. Authentication and cloud statistics are
disabled in that mode; local games and saves continue to work.

## Prerequisites and installation

- Node.js 22, 23, or 24 (see `package.json`)
- npm
- A Cloudflare account for full-stack development or deployment
- A Clerk application for authentication and cloud statistics

```sh
npm ci
cp .dev.vars.example .dev.vars
```

Never commit `.dev.vars`, Clerk secret keys, API tokens, or database exports.

## Configuration

Replace the placeholders in `.dev.vars` for local Pages development:

| Name | Location | Purpose |
| --- | --- | --- |
| `CLERK_PUBLIC` | Build and Pages runtime | Clerk publishable key; safe for the browser |
| `CLERK_SECRET` | Pages runtime secret | Verifies session tokens; never expose or commit |
| `CLERK_AUTHORIZED_PARTIES` | Pages runtime, optional | Comma-separated origins allowed to present tokens |
| `VITE_CLERK_PUBLISHABLE_KEY` | Vite-only development, optional | Alternative key for `npm run dev` |
| `DB` | Wrangler/Pages binding | D1 database used by Pages Functions |

`wrangler.jsonc` is the schema-validated Pages configuration source of truth. It
binds production to `infinite-sudoku-db` and the named `preview` environment to
`infinite-sudoku-preview`, both as `DB`. Configure Clerk separately per
environment and use test Clerk keys for previews.

After changing bindings or variable names, run `npm run types:cloudflare` and
commit the generated `worker-configuration.d.ts`; never edit it by hand.

## Development

For frontend-only development with hot module replacement:

```sh
npm run dev
```

Cloud API calls require the full Pages runtime:

```sh
npx wrangler d1 migrations apply DB --local
npm run dev:full
```

The full command starts Vite with HMR at http://localhost:5173 and a
`wrangler pages dev` process on port 8788 that runs the `functions/` routes,
loads `.dev.vars`, and connects `DB` to local D1 storage. Vite proxies `/api`
to it, so open the Vite URL. Override ports with `VITE_PORT` and `PAGES_PORT`;
Ctrl-C stops both processes. See
[docs/D1_MIGRATIONS.md](docs/D1_MIGRATIONS.md) for the append-only migration,
backup, verification, and recovery procedure.

## Daily puzzles

One canonical puzzle per mode exists for each UTC date; difficulty follows a
weekday rotation. Hard and expert generation takes seconds to tens of seconds,
so puzzles are generated ahead of time rather than on request. The script reads
which rows already exist, generates only the missing ones with the shared
engine, and inserts them idempotently:

```sh
npm run daily:generate -- --local              # top up the next 7 days in local D1
npm run daily:generate -- --days 14            # remote D1 via your Wrangler login
npm run daily:generate -- --from 2026-12-24 --days 3 --dry-run   # print SQL only
```

In production the `Daily puzzles` GitHub Actions workflow runs the same script
every night at 01:17 UTC (and on demand via "Run workflow") to keep the next 7
days present. It needs two repository secrets:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | The account that owns the D1 database |
| `CLOUDFLARE_API_TOKEN` | An API token with the **Account › D1 › Edit** permission and nothing else |

Seed the first week yourself before enabling the workflow, or run the workflow
manually once the secrets exist. If no puzzle exists for the current UTC date
the app tells the player the daily isn't ready yet and offers a retry.

`GET /api/daily?mode=classic|killer[&date=YYYY-MM-DD]` serves a puzzle and is
the only public API route. See [docs/DAILY_RULES.md](docs/DAILY_RULES.md) for
the identity, streak, and rotation rules.

## Accessibility

The board supports keyboard navigation and entry. Dialogs contain focus and
restore it on close; settings popups support Tab and Escape. Reduced-motion
preferences disable decorative movement. Shapes and text supplement status
colors, and all four theme palettes have automated contrast checks. See
[accessibility behavior and verification](docs/ACCESSIBILITY.md) for controls,
screen-reader verification, and the overlay regression checklist.

## Quality checks

```sh
npm run test:watch       # frontend/engine tests while developing
npm run test:unit        # frontend/engine tests once
npm run test:workers     # Pages Functions with isolated migrated D1
npm run test:coverage    # coverage and configured thresholds
npm run lint
npm run typecheck
npm run build
npm run check            # required pre-commit gate
npm audit --audit-level=high
```

`npm run check` verifies generated types, zero-warning lint, coverage, Workers/D1
integration tests, every TypeScript project, and the production build. See
[docs/DEPENDENCY_SECURITY.md](docs/DEPENDENCY_SECURITY.md) for security policy.

## PWA testing

Service workers are generated only for production builds:

```sh
npm run build
npm run preview
```

In a private profile, load the preview, confirm the manifest and service worker
in developer tools, install the app, then test a reload with the network disabled.
Clear site data between cache-strategy tests.

Production response policy is declared in `public/_headers`: HTML, the manifest,
and service-worker files revalidate; fingerprinted `/assets/*` files cache for a
year as immutable. The CSP must list the Clerk Frontend API host encoded in the
committed publishable key (`clerk.infinitesudoku.com` for production; a test
in `tests/csp-headers.test.ts` enforces this), the Cloudflare Web Analytics
beacon that the zone injects automatically, and permits bot-protection frames,
first-party workers, and inline styles required by Clerk, while denying framing
and unused browser capabilities. Pages Functions add `private, no-store` and
security headers directly because `_headers` rules apply only to static assets.

After deployment, spot-check both response paths (replace the hostname):

```sh
curl -I https://infinitesudoku.com/
curl -I https://infinitesudoku.com/assets/<fingerprinted-file>.js
curl -i https://infinitesudoku.com/api/stats
```

## Cloudflare Pages deployment

The intended production setup is a Git-integrated Pages project:

- Root directory: repository root
- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`
- Functions: repository-root `functions/` (detected automatically)
- D1 binding: `DB`, declared in `wrangler.jsonc`
- `CLERK_PUBLIC`: committed in `wrangler.jsonc` under `vars` (top level and
  `env.preview`). The Functions runtime reads it from there and the Vite build
  reads the same file, so the bundle and the API always use one Clerk instance.
  It is a publishable key, public by design.
- Runtime secrets, set once per environment and never committed:

  ```sh
  npx wrangler pages secret put CLERK_SECRET --project-name infinite-sudoku
  npx wrangler pages secret put CLERK_SECRET --project-name infinite-sudoku --env preview
  ```

  `CLERK_AUTHORIZED_PARTIES` is optional and set the same way.

`wrangler.jsonc` is the source of truth for Pages variables and bindings: on
deploy, anything not declared in it is removed from the project. Do not add
plain variables in the dashboard; add them to the file. Secrets stay in the
dashboard because the file must never contain them.

Before the first deployment, create D1, update its ID in `wrangler.jsonc`, and
configure the Pages binding. Before each production deployment:

```sh
npm ci
npm run check
npm audit --audit-level=high
npx wrangler d1 migrations list DB --remote
npx wrangler d1 export DB --remote --output ./infinite-sudoku-backup.sql
npx wrangler d1 migrations apply DB --remote
```

`main` is protected by a ruleset: changes land only through a pull request whose
`quality` CI job passed, and force-pushes and deletions are blocked. Push a
branch, open a PR, and enable auto-merge (`gh pr merge --auto --squash`) so it
lands as soon as CI is green; Cloudflare then builds production automatically.
Pull requests get preview URLs when preview deployments are enabled. Verify
sign-in, an authenticated API request, game completion, and PWA loading on the
preview before merging. Include trusted preview/custom origins in that
environment's `CLERK_AUTHORIZED_PARTIES`.

For an intentional manual upload instead of Git integration:

```sh
npm run build
npx wrangler pages deploy dist --project-name infinite-sudoku
```

Add `--branch <branch-name>` for a preview and select the configured preview
environment where the deployment workflow supports named environments.

### Runtime policy and logs

`nodejs_compat` is enabled because Clerk's backend SDK uses Node-compatible
runtime APIs; the Workers integration suite exercises that exact compatibility
date and flag. Pages does not support the Workers `observability` config key
(its build validation rejects the whole file if present); use the dashboard's
real-time logs or `npx wrangler pages deployment tail --project-name
infinite-sudoku` to watch Functions output. Application logging must never
include authorization headers, Clerk tokens, request bodies, or D1 row contents.

Authentication-sensitive `/api/*` routes fail closed in `functions/_middleware.ts`:
missing configuration, invalid tokens, and Clerk verification errors all return
401 without invoking an API handler. Non-API asset requests remain available if
authentication is unavailable. Tests enforce this boundary.

See [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md) for what logs exist (live-only
on Pages), correlation-ID diagnosis, redaction rules, and metrics to review.

## Custom domain and rollback

Attach the production hostname under the Pages project's **Custom domains**
settings and ensure Clerk allows that origin. Cloudflare manages DNS and TLS once
the domain is active.

To roll back code, open **Workers & Pages → Infinite Sudoku → Deployments**,
choose a previous successful production deployment, and select **Rollback**.
Preview deployments cannot be rollback targets. A Pages rollback does not roll
back D1: migrations are forward-only, so restore the pre-deploy export or ship a
corrective migration using `docs/D1_MIGRATIONS.md`. Repeat smoke tests afterward.

## Project workflow

`ROADMAP.md` is the implementation plan. Complete one task at a time, verify its
acceptance criteria with `npm run check`, update its status, and make a focused
commit. Repository-specific agent guidance is in `AGENTS.md`.
