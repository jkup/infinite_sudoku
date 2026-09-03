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

The full command runs Vite behind `wrangler pages dev`, loads `.dev.vars`, serves
the `functions/` routes, and connects `DB` to local D1 storage. See
[docs/D1_MIGRATIONS.md](docs/D1_MIGRATIONS.md) for the append-only migration,
backup, verification, and recovery procedure.

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
year as immutable. The CSP permits the Clerk frontend, bot-protection frames,
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
- D1 binding: `DB`
- Build/runtime variable: `CLERK_PUBLIC`
- Runtime secrets: `CLERK_SECRET` and optionally `CLERK_AUTHORIZED_PARTIES`

Before the first deployment, create D1, update its ID in `wrangler.toml`, and
configure the Pages binding. Before each production deployment:

```sh
npm ci
npm run check
npm audit --audit-level=high
npx wrangler d1 migrations list DB --remote
npx wrangler d1 export DB --remote --output ./infinite-sudoku-backup.sql
npx wrangler d1 migrations apply DB --remote
```

Push the verified commit to `main`; Cloudflare builds production automatically.
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
date and flag. Persisted invocation logs are sampled at 100% for the app's
expected low traffic and traces at 10%. Query strings are redacted. Application
logging must never include authorization headers, Clerk tokens, request bodies,
or D1 row contents.

Authentication-sensitive `/api/*` routes fail closed in `functions/_middleware.ts`:
missing configuration, invalid tokens, and Clerk verification errors all return
401 without invoking an API handler. Non-API asset requests remain available if
authentication is unavailable. Tests enforce this boundary.

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
