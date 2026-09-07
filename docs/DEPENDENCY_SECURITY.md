# Dependency security policy

CI runs `npm audit --audit-level=high` after a clean `npm ci`. High and critical
advisories fail the build; low and moderate findings remain visible for routine
maintenance but do not block unrelated changes.

When the audit fails:

1. Confirm the affected package and whether it is reachable in this application.
2. Prefer a compatible direct or transitive dependency update and run
   `npm run check` afterward.
3. Do not use `npm audit fix --force` without reviewing the proposed major-version
   changes and testing the affected behavior.
4. If no fix exists, document the advisory, exposure analysis, compensating
   controls, owner, and review date before adding any temporary exception.

Dependabot alerts should remain enabled in repository settings. A repository
ruleset on `main` requires a pull request with a passing `quality` job and
blocks force-pushes and deletions; keep it enforced.
