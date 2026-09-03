# PWA behavior and audit

## Product policy

- The service worker precaches the application shell and install icons so saved
  puzzles can reload without a network connection.
- Updates use `prompt` mode. A waiting worker never reloads an active puzzle;
  the player chooses **Update now** or **Later**, and the prompt confirms that
  local puzzle state is saved.
- Completions are written to the persistent completion queue before submission.
  The queue is retried when connectivity returns and after Clerk supplies an
  auth token. The original completion ID is reused for server idempotency.
- The app announces when offline support is ready and exposes pending/synced
  completion state in the completion dialog.

## Automated audit

`npm run test:pwa` verifies the built manifest fields, standalone scope, theme
colors, required 192/512/maskable and Apple icon dimensions, offline precache,
and service-worker cache headers. Store tests cover offline-save restoration,
corrupt-save recovery, queue persistence, retry visibility, and idempotent IDs.
It runs after the production build in `npm run check`.

## Manual supported-browser matrix

Run this before a production PWA release, using a clean profile and the built
preview (`npm run build && npm run preview`):

| Scenario | Chromium desktop/Android | Safari iOS |
| --- | --- | --- |
| First visit registers worker and offers install/Add to Home Screen | Required | Required |
| Repeat visit loads current assets without reinstall | Required | Required |
| Enter a digit, go offline, reload, and retain the puzzle | Required | Required |
| Deploy a changed build during a game; update waits for consent | Required | Required |
| Choose Later, finish play, then Update now | Required | Required |
| Remove/disable a stale worker, reload, and recover normally | Required | Required |
| Complete offline, reconnect/sign in, and observe one stats sync | Required | Required |
| Icon is legible in normal and maskable presentation | Required | Required |

For a stale-worker recovery test, use browser developer tools to unregister the
worker and clear Cache Storage without clearing Local Storage, then reload. A
fresh worker should install and the saved puzzle should remain. Record browser
versions and results in the release notes.

On 2026-09-03, the repository owner ran the localhost flow in a clean incognito
Chrome session and reported the install, offline reload, saved-puzzle recovery,
service-worker recovery, update-consent, and reconnect behavior working. Codex
then independently attached to that session, confirmed all 81 cells rendered,
and verified that reloading preserved the exact puzzle state without application
errors. The manifest and configured theme color were present, and the automated
artifact and lifecycle suites passed in the same build. Future release audits
should continue recording browser/device versions for the full Chromium and
Safari matrix above.
