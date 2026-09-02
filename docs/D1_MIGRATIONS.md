# D1 migration runbook

The files in `db/migrations/` are the only schema source of truth. They are
ordered, append-only, and are applied by Wrangler in filename order. Tests load
the same directory through `readD1Migrations`.

## Create and verify a migration

Create the next numbered SQL file (for example, `0004_description.sql`) without
editing migrations that have already shipped. Then run:

```sh
npm run test:workers
WRANGLER_LOG_PATH=/tmp/infinite-sudoku-wrangler.log npx wrangler d1 migrations apply DB --local
```

The Workers suite starts with a blank disposable D1 database, applies every
migration, and exercises the resulting schema. Runtime request validation is
still required; database constraints are the final integrity boundary.

## Existing and production databases

Before the first migration-based deployment, inspect the remote migration list
and back up the database:

```sh
npx wrangler d1 migrations list DB --remote
npx wrangler d1 export DB --remote --output ./infinite-sudoku-backup.sql
npx wrangler d1 migrations apply DB --remote
```

Keep exports outside version control because they contain user identifiers and
game history. The initial migration uses idempotent table/index creation so a
database created from the former `db/schema.sql` can adopt the history. Before
applying, inspect `PRAGMA table_info(game_results)` remotely; if
`completion_id` or `stats_counted` already exists while migration `0002` is
pending, stop and reconcile the migration ledger instead of rerunning its
`ALTER TABLE` statements.

Use the same commands with the appropriate Wrangler environment for previews.
Never point local development at the remote database by default.

## Recovery

D1 migrations do not provide an automatic down-migration workflow. Do not edit
or delete an applied file. For a bad additive migration, ship a new forward-fix
migration. For destructive or data-transforming changes, take and verify an
export first; restore into a replacement database and switch the binding if a
forward fix cannot safely recover the data.
