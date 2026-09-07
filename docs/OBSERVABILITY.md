# API observability runbook

Every `/api/*` response carries `X-Request-ID`. Pages middleware emits one JSON
completion record containing only `requestId`, endpoint path, status, duration,
and optional failure category. It never logs query strings, authorization
headers, tokens, request bodies, Clerk secrets, or user IDs. Endpoint failures
are categorized as `validation`, `authentication`, `database`, `upstream`, or
`unexpected`.

## What logs exist

Pages Functions logs are live-only. Cloudflare does not store them: you can
stream them while a problem is happening, but nothing can be searched after the
fact. There is no dashboard setting that changes this for Pages, and the Workers
`observability` config key does not apply (Pages build validation rejects it and
fails the deployment). Stream logs with:

```sh
npx wrangler pages deployment tail --project-name infinite-sudoku
```

or from **Workers & Pages → infinite-sudoku → Deployments → View details → Functions
logs** in the dashboard. Persisted, searchable logs would require moving the
app from Pages to a Worker with static assets; that is a deliberate future
project, not a configuration change.

## Metrics and alerts

Pages exposes request counts, error rates, and CPU time per deployment under
**Workers & Pages → infinite-sudoku → Metrics**. Review them weekly. Cloudflare
notifications can alert on Pages deployment failures; enable that so a broken
build is noticed the same day.

## Incident diagnosis

1. Ask the player for the reference shown beside “Stats not synced” and roughly
   when it happened. The reference is the `X-Request-ID` the middleware logged.
2. If the problem is ongoing, start `wrangler pages deployment tail` and ask the
   player to select **Retry stats sync**; the retried request logs a new record
   with endpoint, failure category, status, and duration. The queued request
   keeps its original completion ID, so server idempotency prevents double stats.
3. Use the failure category to choose the owner; do not request or record the
   player's token.
4. For `database` failures, inspect D1 health and migration state
   (`wrangler d1 migrations list DB --remote`). For `authentication` or
   `upstream` failures, inspect Clerk status and the `CLERK_SECRET` and
   `CLERK_PUBLIC` configuration.
5. Once recovered, the player can retry and the completion syncs normally.

Never solve log volume or gaps by adding payload or identity data to logs.
