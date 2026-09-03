# API observability runbook

Every `/api/*` response carries `X-Request-ID`. Pages middleware emits one JSON
completion record containing only `requestId`, endpoint path, status, duration,
and optional failure category. It never logs query strings, authorization
headers, tokens, request bodies, Clerk secrets, or user IDs. Endpoint failures
are categorized as `validation`, `authentication`, `database`, `upstream`, or
`unexpected`.

## Dashboard checks and alerts

In **Workers & Pages → infinite-sudoku → Observability**, save views for:

- status `>= 500`, grouped by endpoint and failure category, over 5 and 30 minutes;
- `/api/stats` POST failures, especially `database` failures;
- authentication/upstream failures, which may indicate Clerk configuration or
  availability problems;
- p95 duration by endpoint and trace samples for slow requests.

For expected low traffic, page an operator when either condition persists for
five minutes: five or more server errors, or a server-error ratio above 5% with
at least 20 requests. Warn (without paging) on ten authentication/upstream
failures in five minutes. Review the dashboard weekly even if no alert fires.

## Incident diagnosis

1. Ask the player for the reference shown beside “Stats not synced.”
2. Search persisted logs for that exact request ID.
3. Use endpoint, failure category, status, and duration to choose the owner; do
   not request or record their token.
4. For database failures, inspect D1 health and migration state. For upstream
   failures, inspect Clerk status and environment configuration.
5. After recovery, the player can select **Retry stats sync**. The queued request
   keeps its original completion ID, so server idempotency prevents double stats.

Logs are sampled at 100% and traces at 10% in `wrangler.jsonc`. Revisit sampling
when traffic or retention cost grows; never solve volume by adding payload or
identity data to logs.
