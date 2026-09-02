# Infinite Sudoku Roadmap

This roadmap turns the September 2026 repository review into implementation-ready work. It is ordered by risk and dependency: secure the existing product first, build a reliable test and deployment foundation second, then improve accessibility and product value before expanding into social features.

## How to use this roadmap

- Work roughly in phase order. Tasks within a phase may be parallelized unless a dependency is called out.
- Keep changes small enough to review. Security fixes, test infrastructure, and product features should normally be separate pull requests.
- Before starting a task, inspect the referenced files and confirm that earlier roadmap work has not already changed the design.
- Every task must leave `npm run build` and `npm run lint` passing. Add or run relevant tests once the test scripts exist.
- Do not commit secrets, `.dev.vars`, generated `dist/` output, or production identifiers beyond the existing non-secret configuration.
- Update this file and `TODO.md` when work ships so the planning documents remain accurate.

## Definition of done for all changes

A task is complete when:

- Its acceptance criteria are met.
- User-visible behavior is tested at mobile and desktop widths when applicable.
- Keyboard-only behavior and light/dark/high-contrast themes are checked when UI is changed.
- New behavior has automated coverage at the appropriate layer.
- Error and loading states are deliberate rather than silent.
- Relevant documentation and configuration examples are updated.

---

## Phase 0 — Release blockers

### SEC-001: Replace fail-open Clerk authentication

**Priority:** P0
**Status:** Complete (2026-09-02)
**Why:** `functions/_middleware.ts` currently accepts the decoded `sub` claim when Clerk verification fails. A forged JWT could therefore impersonate another user.

**Scope**

- Replace the custom decode-and-remote-verify fallback with Clerk's supported server-side token verification approach for Cloudflare Workers/Pages.
- Verify the JWT signature and required claims, including expiration, not-before, issuer, and authorized-party/audience where applicable.
- Fail closed on network errors, malformed tokens, unknown signing keys, invalid claims, and verification failures.
- Return a consistent JSON `401` response without leaking token or provider details.
- Cache public keys only through a supported, bounded mechanism; never cache request-specific authentication state globally.
- Keep the authenticated user ID in typed request data for downstream handlers.

**Acceptance criteria**

- A valid Clerk session can access `/api/stats`.
- Missing, malformed, expired, not-yet-valid, incorrectly signed, and fabricated tokens all receive `401`.
- A Clerk outage or verification error never causes an unverified payload to be trusted.
- Authentication tests run in a Workers-compatible environment and include a forged-token regression case.
- No Clerk secret or bearer token is logged.

**Likely files:** `functions/_middleware.ts`, `package.json`, Worker test configuration, generated environment types.

**Verification:** Run unit/integration tests, `npm run lint`, `npm run build`, and a local Pages Functions request with both valid and invalid credentials.

### API-001: Validate game-result requests and compute authoritative scores

**Priority:** P0
**Depends on:** SEC-001
**Status:** Complete (2026-09-02)
**Why:** `/api/stats` trusts all client fields, including score, timing, difficulty, and error counts. This makes statistics and future leaderboards trivial to manipulate.

**Scope**

- Add strict runtime validation for the JSON request body.
- Allow only supported modes and difficulties; require finite, non-negative integer metrics with sensible upper bounds.
- Move the canonical score calculation to shared code usable by the backend, or reimplement it in a backend-owned module with parity tests.
- Ignore or reject client-supplied scores. Prefer accepting raw metrics and returning the server-computed score.
- Return `400` for malformed JSON or invalid fields and `415` for unsupported content types if that policy is adopted.
- Ensure unexpected errors produce a generic `500` response and structured server-side logging.

**Acceptance criteria**

- Negative, infinite, fractional, excessively large, missing, and unknown values are rejected.
- Arbitrary client score values cannot change the stored score.
- Frontend and backend scoring behavior is covered by shared fixtures.
- The frontend handles validation and server failures without claiming that the result was saved.

**Likely files:** `functions/api/stats.ts`, `src/lib/scoring.ts`, `src/lib/api.ts`, a new shared validation/scoring module, tests.

### API-002: Make completion submission idempotent and atomic

**Priority:** P0
**Depends on:** API-001
**Status:** Complete (2026-09-02)
**Why:** A client can submit the same completion repeatedly, and the stats upsert and result insert are separate writes that can partially succeed.

**Scope**

- Assign each playable puzzle/session a stable, non-secret completion ID.
- Add a unique constraint that prevents the same user/session completion being counted twice.
- Store the game result and aggregate-stat update in one D1 transaction/batch with clearly understood failure semantics.
- Treat retries as success while returning the originally stored result.
- Add a real migration rather than editing production schema assumptions in place.

**Acceptance criteria**

- Repeating the same POST does not increment totals twice.
- Concurrent duplicate requests produce one game-result row.
- A failed result insert cannot leave aggregate totals incremented.
- Existing user data remains compatible after migration.
- Tests cover normal, repeated, concurrent, and partial-failure scenarios.

**Likely files:** `db/`, `functions/api/stats.ts`, `src/lib/api.ts`, puzzle/session types, persistence code.

### GAME-001: Fix easy-hint completion behavior

**Priority:** P0
**Status:** Complete (2026-09-03)
**Why:** Revealing the final cell with a free easy hint can leave a solved puzzle in the `playing` state.

**Scope**

- Route hint reveals through the same domain transition used for normal placements/completion.
- After a hint reveal, update peer notes, conflicts, history, completion state, timer state, hint/error metrics, local persistence, and cloud submission consistently.
- Ensure the hint can be undone if that remains intended product behavior.
- Ensure top-level completion is submitted once and nested hint-puzzle completion is not submitted as a normal game.

**Acceptance criteria**

- A hint on the last empty cell completes the puzzle and stops the timer.
- A non-final hint maintains correct notes and history.
- Undo/redo around the hint is deterministic.
- Exactly one top-level completion is persisted/submitted.
- Automated store tests cover final-cell, non-final, and nested-hint cases.

**Likely files:** `src/store/hintStore.ts`, `src/store/gameStore.ts`, `src/lib/persistence.ts`, store tests.

### GAME-002: Make puzzle generation race-safe and cancellable

**Priority:** P0
**Status:** Complete (2026-09-03)
**Why:** Multiple requests share one Worker without request IDs. All listeners can resolve from the first response, and an older generation can overwrite a newer selection.

**Scope**

- Give every Worker request a unique ID and return that ID with success/error responses.
- Maintain a request-to-promise map or serialize jobs explicitly.
- Reject on Worker errors, malformed responses, termination, and a bounded timeout.
- Add a “latest game request wins” guard in the game store.
- Expose a generation/loading state and disable or safely supersede conflicting actions.
- Clean up listeners and pending promises on completion or cancellation.

**Acceptance criteria**

- Rapidly selecting multiple difficulties/modes always ends on the final selection.
- Concurrent generation promises receive their own results.
- Worker failure produces a recoverable error or intentional synchronous fallback rather than a permanently pending promise.
- No stale generation can reset the timer or board.
- Tests use a controllable fake Worker to cover out-of-order replies and errors.

**Likely files:** `src/engine/generateAsync.ts`, `src/engine/puzzleWorker.ts`, `src/store/gameStore.ts`, `src/App.tsx`, tests.

---

## Phase 1 — Engineering safety net

### TEST-001: Establish frontend and engine test infrastructure

**Priority:** P1
**Status:** Complete (2026-09-02)
**Why:** The repository currently has no automated tests despite substantial algorithmic and state-machine behavior.

**Scope**

- Add Vitest with a Node environment for pure engine code and jsdom only where browser APIs are required.
- Add React Testing Library for behavior-driven component tests.
- Add scripts such as `test`, `test:watch`, and `test:coverage`.
- Create reusable deterministic fixtures; where practical, inject or seed randomness rather than mocking `Math.random` globally.
- Set an initial coverage report without choosing a target that rewards superficial tests.

**Initial required suites**

- Solver techniques and unique-solution detection.
- Classic and mini generator invariants across representative seeds/difficulties.
- Killer cage coverage, connectivity, sums, and placement validation.
- Conflict detection for 9×9 and 6×6 grids.
- Scoring boundaries.
- Persistence serialization and legacy migration.
- Undo/redo, notes, completion, timer transitions, and hint-stack restoration.

**Acceptance criteria**

- `npm test` runs once and exits appropriately for CI.
- Tests are deterministic and do not rely on wall-clock sleeps.
- A failed engine invariant produces a useful reproduction seed/fixture.
- The most critical P0 regressions have explicit tests.

### TEST-002: Add Cloudflare Pages Functions integration tests

**Priority:** P1
**Depends on:** SEC-001, TEST-001
**Status:** Complete (2026-09-03)
**Scope**

- Use the current Cloudflare-supported Vitest runtime/plugin for Pages/Workers code.
- Exercise middleware and endpoints against a disposable D1 database/schema.
- Cover authentication, validation, authorization, idempotency, database failures, and response formats.
- Confirm the test configuration does not conceal missing production compatibility flags.

**Acceptance criteria**

- API tests execute in a Workers-compatible runtime rather than ordinary Node alone.
- Test setup applies migrations from the same source used in deployment.
- Auth and database tests run locally and in CI.

### QUAL-001: Make lint pass and strengthen static analysis

**Priority:** P1
**Status:** Complete (2026-09-03)
**Scope**

- Fix the conditional hook call in `src/components/board/Board.tsx`.
- Refactor synchronous effect state updates in `App.tsx`, `StatsPanel.tsx`, and `Onboarding.tsx` rather than suppressing rules indiscriminately.
- Fix the missing `onToggleHelp` dependency in `useKeyboard.ts`.
- Enable type-aware TypeScript ESLint rules where useful, including promise-handling checks.
- Add a single `check` script that runs type checking, linting, and tests.

**Acceptance criteria**

- `npm run lint` exits successfully with no warnings.
- Hook rules remain enabled.
- Floating promises are deliberately awaited, returned, voided, or sent to an appropriate background mechanism.
- `npm run check` provides the normal pre-commit/CI verification path.

**Likely files:** `eslint.config.js`, affected React files, `package.json`.

### QUAL-002: Type-check backend code with generated Cloudflare bindings

**Priority:** P1
**Status:** Complete (2026-09-03)
**Scope**

- Generate environment/runtime types from Wrangler configuration using the current supported workflow.
- Add a backend TypeScript configuration covering `functions/` and shared backend modules.
- Remove handwritten `Env` definitions where generated types can provide the source of truth.
- Make the standard build/check process type-check frontend, Web Worker, and Pages Functions code.

**Acceptance criteria**

- Removing or renaming the D1 binding causes a type/check failure.
- `functions/` is type-checked in CI.
- Generated files and regeneration instructions are clearly documented.

### CI-001: Add continuous-integration quality gates

**Priority:** P1
**Depends on:** TEST-001, QUAL-001, QUAL-002
**Status:** Complete (2026-09-03)
**Scope**

- Add a GitHub Actions workflow for a clean install, lint, frontend/backend type checking, tests, and production build.
- Cache dependencies using the lockfile-supported mechanism.
- Upload coverage or build diagnostics only when useful; do not upload secrets or `.dev.vars`.
- Add dependency/security scanning with a documented policy for actionable failures.

**Acceptance criteria**

- Pull requests cannot silently merge a failing build, lint violation, or test regression once branch protection is configured.
- CI uses `npm ci` and the committed lockfile.
- Workflow permissions are least-privilege.

---

## Phase 2 — Data and domain correctness

### DATA-001: Introduce ordered D1 migrations

**Priority:** P1
**Status:** Complete (2026-09-03)
**Scope**

- Convert the single schema file into an ordered, append-only migration history suitable for local, preview, and production databases.
- Document how to create, apply, verify, and roll back/forward-fix migrations.
- Add constraints for supported modes/difficulties, non-negative metrics, daily fields, and completion identity where D1 supports them cleanly.
- Add indexes based on actual endpoint query patterns.

**Acceptance criteria**

- A blank database can be created entirely from migrations.
- Existing production data has a documented upgrade path.
- Local and CI databases use the same migrations.
- Schema constraints complement, rather than replace, runtime validation.

### DATA-002: Correct the daily-puzzle and streak model

**Priority:** P1
**Depends on:** API-001, API-002, DATA-001
**Why:** Every completed game currently advances a field named `current_daily_streak`, while result submissions cannot identify a daily puzzle.

**Scope**

- Define daily participation semantics: canonical timezone/date, one canonical puzzle per date/mode, replay policy, and streak rules.
- Only verified daily completions should affect daily streaks.
- Store daily identity with results and enforce one ranked result per user/puzzle according to the replay policy.
- Avoid using mutable `updated_at` as evidence of the last daily completion.
- Make date logic explicit and test boundary cases around midnight and missed days.

**Acceptance criteria**

- Ordinary games never alter a daily streak.
- Multiple plays on one day do not inflate the streak.
- Consecutive, repeated, and missed-day cases behave according to documented rules.
- Tests freeze time and cover timezone/date boundaries.

### GAME-003: Centralize game-session transitions and timer ownership

**Priority:** P1
**Why:** Timer creation and state restoration are duplicated across `gameStore` and `hintStore`, and the two stores reach into one another directly.

**Scope**

- Define explicit transitions for generating, playing, paused, completed, failed, and nested-hint states.
- Give one module sole ownership of timer start/stop/resume behavior.
- Represent elapsed time using timestamps plus accumulated duration so background throttling does not introduce one-second drift.
- Consolidate completion handling, persistence, metrics, and cloud submission behind one idempotent transition.
- Reduce direct cross-store `getState`/`setState` mutation or merge tightly coupled state if that is simpler.

**Acceptance criteria**

- At most one timer is active per game session.
- Manual pause never auto-resumes after a visibility change.
- Completed games and failed/generating states have no running interval.
- Nested hint entry/exit restores the parent time exactly as specified.
- Transition tests do not depend on React rendering.

### GAME-004: Enforce complete puzzle invariants

**Priority:** P1
**Scope**

- Make completion verify the stored solution or prove all applicable constraints, including killer cages.
- Ensure generated puzzle metadata always matches the actual puzzle returned.
- If generation falls back to a different difficulty, surface the actual difficulty to state/UI instead of retaining the requested label.
- Validate loaded local saves before allowing them to affect scores or cloud stats.
- Decide how corrupted/legacy saves are discarded or migrated and communicate recovery to the user.

**Acceptance criteria**

- An invalid full grid cannot complete or submit.
- Killer cage constraints are part of validation.
- Requested and actual difficulty cannot silently disagree.
- Malformed local state fails safely without crashing or producing a ranked result.

### GAME-005: Make persistence versioned and complete

**Priority:** P2
**Depends on:** GAME-003
**Scope**

- Add an explicit saved-state schema version and migration functions.
- Persist all intended session fields, including hint-stack behavior, metrics, and generation/session identity where appropriate.
- Validate parsed data structurally before constructing Sets or indexing arrays.
- Define whether active hint puzzles survive reload; implement that policy consistently.
- Surface an unobtrusive recovery message when a corrupt save is discarded.

**Acceptance criteria**

- Current and supported legacy saves round-trip through tests.
- Unsupported/corrupt saves are handled safely.
- Reload cannot reset hint/error counts or create duplicate cloud submissions.

---

## Phase 3 — Deployment and operations

### OPS-001: Document the complete development and deployment workflow

**Priority:** P1
**Scope**

- Replace the template README with project-specific documentation.
- Document prerequisites, install, frontend-only development, full Pages development, tests, lint/build, D1 migrations, Clerk setup, PWA testing, and production deployment.
- List required variables/bindings by name and purpose without including values.
- Document the Cloudflare Pages build command, output directory, Functions routing, preview behavior, custom domain, and rollback procedure.
- Explain the high-level architecture and data flow.

**Acceptance criteria**

- A new contributor can run the frontend and full local stack from the README.
- A maintainer can reproduce a deployment without relying on undocumented dashboard knowledge.
- Secret handling and environment separation are explicit.

**Likely files:** `README.md`, `.dev.vars.example`, deployment/config docs.

### OPS-002: Modernize and validate Cloudflare configuration

**Priority:** P1
**Scope**

- Review and update `compatibility_date` using current Cloudflare guidance and tests.
- Move to the currently preferred Wrangler configuration format if it improves schema validation and generated types.
- Add explicit observability settings with appropriate sampling for expected traffic.
- Document and configure the desired Pages fail-open/fail-closed policy; authentication-sensitive API behavior should fail closed.
- Add separate preview/production database and environment bindings where appropriate.
- Confirm whether `nodejs_compat` is required by the chosen auth implementation and compatibility date.

**Acceptance criteria**

- Local, preview, and production bindings are deliberate and documented.
- Logs and traces are available without exposing user tokens or sensitive payloads.
- Compatibility changes pass API and UI regression tests.

**Likely files:** `wrangler.toml` or replacement config, generated types, README.

### OPS-003: Add security and caching headers

**Priority:** P1
**Scope**

- Add a Content Security Policy compatible with Clerk, Vite output, the service worker, and required assets.
- Add `Referrer-Policy`, `X-Content-Type-Options`, clickjacking protection via CSP, and an appropriate `Permissions-Policy`.
- Define caching separately for fingerprinted assets, HTML, manifest, and service worker files.
- Confirm API responses are not cached publicly and include suitable anti-sniffing/security headers.
- Roll out CSP in report-only mode first if necessary.

**Acceptance criteria**

- Authentication, PWA installation, service-worker updates, and gameplay work with the final CSP.
- HTML and service worker update promptly; hashed assets receive long immutable caching.
- API and user-specific responses cannot be served from a shared cache.
- An automated or documented header check exists.

**Likely files:** `public/_headers`, middleware response helpers, deployment documentation.

### OPS-004: Add structured error handling and observability

**Priority:** P1
**Scope**

- Add structured logs for endpoint, status, duration, failure category, and request/correlation ID.
- Redact authorization headers, JWTs, Clerk secrets, and unnecessary personal identifiers.
- Distinguish validation, authentication, database, upstream, and unexpected failures.
- Define basic operational alerts or dashboard checks for elevated API errors and failed submissions.
- Give the client a retryable completion queue or clear “stats not synced” state rather than relying only on console output.

**Acceptance criteria**

- A failed save can be diagnosed by correlation ID without sensitive data.
- Users can tell whether a completion synced and can safely retry.
- Retries are compatible with API idempotency.

### OPS-005: Audit PWA update and offline behavior

**Priority:** P2
**Scope**

- Test first install, repeat visit, offline gameplay, update discovery, and recovery from a bad/stale service worker.
- Decide whether `autoUpdate` may replace the app during an active puzzle; add an update prompt if player state could be disrupted.
- Ensure API failures while offline do not lose eligible completion data.
- Verify install icons, maskable safe area, manifest fields, and theme colors across platforms.

**Acceptance criteria**

- A player can reload and continue an offline puzzle.
- App updates do not silently destroy active progress.
- Queued completion sync is idempotent and visible to the user.
- PWA audits pass the supported browser targets.

---

## Phase 4 — Accessibility and UI resilience

### A11Y-001: Implement a fully keyboard-operable Sudoku grid

**Priority:** P1
**Why:** Cells currently use pointer-driven `div` elements, and no cell is tabbable before selection.

**Scope**

- Implement the ARIA grid pattern with a predictable entry point and roving tab index.
- Support Tab into/out of the board, arrow navigation, Home/End or documented equivalents, digit entry, notes, erase, and selection without a pointer.
- Keep DOM focus synchronized with game selection without stealing focus from dialogs or controls.
- Announce value, given/editable state, row/column, conflicts, notes, and killer cage clues in a concise form.
- Test with at least one major screen reader/browser combination in addition to automated checks.

**Acceptance criteria**

- A keyboard-only player can start and finish a puzzle.
- The board always has one logical tab stop while active.
- Focus remains visible in every theme.
- Component tests cover grid entry and arrow navigation.

**Likely files:** `src/components/board/Board.tsx`, `Cell.tsx`, `src/hooks/useKeyboard.ts`, CSS, tests.

### A11Y-002: Make dialogs and menus accessible

**Priority:** P1
**Scope**

- Create or adopt shared dialog behavior with initial focus, focus trap, Escape close where allowed, labelled title/description, and focus restoration.
- Apply it to onboarding, confirmation, completion, pause, shortcuts, tutorials, and hint help.
- Add `aria-expanded`, `aria-controls`, and appropriate popup/menu semantics to gear and mode controls.
- Support Escape and keyboard selection in dropdowns without conflicting with game shortcuts.
- Prevent background content from being interactive while modal dialogs are open.

**Acceptance criteria**

- Focus never escapes an open modal.
- Closing restores focus to the trigger when it still exists.
- Menus and dialogs are usable with keyboard and screen reader.
- Game shortcuts do not fire while a dialog/menu requires the key event.

### A11Y-003: Support reduced motion and non-color status cues

**Priority:** P2
**Scope**

- Respect `prefers-reduced-motion` for board slides, hint pulses, transitions, and confetti.
- Ensure conflicts, selected input mode, completed digits, and tutorial targets are not communicated by color alone.
- Verify text and UI-component contrast across all themes.
- Ensure high-contrast mode also has strong focus indicators.

**Acceptance criteria**

- Reduced-motion users receive no large or celebratory movement while retaining understandable state changes.
- Automated contrast checks pass where they are reliable, with manual checks documented for board states.
- All important states have a textual, structural, icon, or pattern-based cue.

### UI-001: Add resilient generation, error, and empty states

**Priority:** P1
**Depends on:** GAME-002
**Scope**

- Show a branded loading/skeleton state during initial and subsequent generation.
- Disable actions whose outcome would be ambiguous while generating, or define safe superseding behavior.
- Show recoverable errors with retry and a safe fallback path.
- Avoid a blank screen when the initial puzzle is unavailable.
- Preserve the previous playable board until the replacement is ready when that produces a better experience.

**Acceptance criteria**

- Slow, failed, and retried generation are understandable on mobile and desktop.
- Error recovery does not create multiple timers or stale puzzle state.
- Status changes are announced to assistive technology.

### UI-002: Improve narrow-screen control ergonomics

**Priority:** P2
**Scope**

- Audit the board and both five-control rows at common narrow widths and with larger text settings.
- Maintain adequate touch targets without forcing horizontal overflow.
- Consider icon-plus-label or adaptive grouping only where meaning remains obvious.
- Keep essential play controls visible without excessive vertical scrolling.

**Acceptance criteria**

- No horizontal overflow at the supported minimum width.
- Interactive targets meet the chosen accessibility size standard.
- 200% text zoom remains usable.
- Labels remain understandable without relying on hover tooltips.

---

## Phase 5 — Close the core product loop

### PRODUCT-001: Build a meaningful completion summary

**Priority:** P1
**Depends on:** API-001, API-002, GAME-003
**Why:** Scoring exists but is not shown, so the player receives little payoff from the stats system.

**Scope**

- Show solve time, server-authoritative score, difficulty, mode, errors, hints, and sync status.
- Offer clear next actions: same settings, change difficulty/mode, daily puzzle when available, and close/review board.
- Explain score deductions compactly without overwhelming casual players.
- Handle unsigned and offline players gracefully.

**Acceptance criteria**

- The summary reflects the stored result and does not invent a score before server validation for ranked play.
- New-game actions cannot accidentally double-submit the completed game.
- Summary layout works at narrow widths and with keyboard/screen readers.

### PRODUCT-002: Reconcile onboarding and in-product copy with actual behavior

**Priority:** P2
**Scope**

- Correct the hint explanation so easy/free hints and nested behavior are accurate.
- Clarify the difference between corner notes, center notes, and auto-note.
- Explain killer mode rules, including whether repeated digits are allowed in cages.
- Review “Beginner” versus “Easy” terminology for consistency.
- Keep onboarding brief; move detail into contextual help/tutorials.

**Acceptance criteria**

- No documented behavior contradicts the implementation.
- Terminology is consistent across onboarding, controls, tutorials, and completion screens.
- Copy is understandable without prior knowledge of advanced Sudoku notation.

### PRODUCT-003: Deliver one complete daily-puzzle vertical slice

**Priority:** P2
**Depends on:** DATA-002, PRODUCT-001
**Scope**

- Implement deterministic or pre-generated canonical daily puzzle publication.
- Add a clear daily entry point, loading/error/already-completed states, and completion result.
- Define offline behavior and prevent clients from substituting arbitrary puzzle identities.
- Track daily participation and streaks according to the documented data model.
- Add operational handling for a missing or invalid daily puzzle.

**Acceptance criteria**

- All players receive the same intended puzzle for a given date/mode.
- A daily completion is verifiable, idempotent, and distinct from ordinary play.
- Daily streaks update exactly once according to policy.
- Generation/publication failure has an operator-visible alert and user-safe fallback.

### PRODUCT-004: Add a privacy-preserving daily leaderboard

**Priority:** P2
**Depends on:** PRODUCT-003, SEC-001, API-001, API-002
**Scope**

- Rank only server-validated daily results.
- Define tie-breaking, replay/best-attempt policy, pagination, and abuse controls.
- Replace raw Clerk user IDs with explicit public display names or anonymized player identities.
- Let users opt out of public ranking without losing private stats.
- Avoid exposing email addresses, internal IDs, or other account metadata.

**Acceptance criteria**

- Forged scores and ordinary-game results cannot enter the daily leaderboard.
- No raw Clerk IDs are returned by the public response.
- Ranking and tie rules have deterministic tests.
- Empty, loading, error, signed-out, and opted-out states are designed.

### PRODUCT-005: Add daily history/streak visualization

**Priority:** P3
**Depends on:** DATA-002, PRODUCT-003
**Scope**

- Add an accessible compact calendar/history view showing played, completed, missed, and current-day states.
- Make timezone semantics understandable.
- Avoid manipulative streak-loss messaging.
- Ensure the longest/current streak values reconcile with the underlying history.

**Acceptance criteria**

- Calendar and aggregate streak values derive from the same source of truth.
- State is not communicated by color alone.
- Screen-reader users receive an equivalent chronological summary.

### PRODUCT-006: Add shareable daily results

**Priority:** P3
**Depends on:** PRODUCT-003
**Scope**

- Generate concise text and/or an image that does not reveal the puzzle solution.
- Include date, mode, difficulty, time/score policy, and a canonical link.
- Use the Web Share API where available with clipboard/download fallbacks.
- Add privacy controls for display name and performance details.

**Acceptance criteria**

- Shared content cannot spoil answers or leak account identifiers.
- Sharing works on supported mobile browsers and has a desktop fallback.
- Output is deterministic enough for snapshot tests.

---

## Phase 6 — Maintainability and performance

### ARCH-001: Decompose `App.tsx` by feature responsibility

**Priority:** P2
**Scope**

- Extract routing/auth shell, game header, overlays, completion flow, tutorial integration, and settings/stats menu into focused modules.
- Keep domain decisions in stores/services rather than moving them into new presentational components.
- Avoid premature generic abstractions; extract only stable behavior with clear ownership.
- Preserve existing routes and UI behavior with tests.

**Acceptance criteria**

- `GameScreen` primarily composes features and does not manage unrelated timer/domain transitions.
- Components have focused props and tests where behavior is non-trivial.
- No circular imports are introduced.

### ARCH-002: Consolidate duplicated domain utilities

**Priority:** P2
**Scope**

- Centralize deep cloning/serialization of grids and history.
- Centralize timer/session lifecycle behavior as part of GAME-003.
- Define shared helpers for API JSON responses, validation errors, and structured logs.
- Remove unused or duplicate mode/difficulty picker components after confirming usage.

**Acceptance criteria**

- There is one authoritative implementation for each invariant-heavy operation.
- Utility extraction improves testability and does not obscure simple component code.

### PERF-001: Profile loading and gameplay before optimizing

**Priority:** P3
**Scope**

- Record mobile/desktop Core Web Vitals and bundle composition on a production-like build.
- Measure initial puzzle-generation time by device class and difficulty.
- Profile board rerenders during entry, auto-note, conflict highlighting, and hint animations.
- Lazy-load Clerk/account UI and tutorial content if measurements justify it.
- Confirm the service worker does not mask cold-load behavior during audits.

**Acceptance criteria**

- Baseline measurements and target budgets are documented.
- Any optimization is tied to a measured bottleneck and includes before/after evidence.
- Gameplay remains responsive during expensive generation and note operations.

---

## Phase 7 — Documentation and roadmap hygiene

### DOCS-001: Reconcile planning documents with shipped functionality

**Priority:** P1
**Scope**

- Update `TODO.md` to remove or rewrite items that are already partially implemented, especially scoring.
- Link large work items to this roadmap or the issue tracker instead of maintaining contradictory lists.
- Mark roadmap tasks complete only when their acceptance criteria have been verified.
- Add a lightweight release checklist covering migrations, compatibility date changes, PWA behavior, security checks, and rollback readiness.

**Acceptance criteria**

- README, TODO, roadmap, and actual product behavior agree.
- Every future-facing feature has a single canonical tracking location.
- Completed work records the relevant pull request or commit where practical.

### DOCS-002: Document product rules and metrics

**Priority:** P2
**Scope**

- Write concise specifications for difficulty classification, scoring, hints, killer cages, daily puzzles, streaks, and leaderboard ranking.
- Define success metrics for the core loop before adding social breadth—for example puzzle completion, return rate, hint engagement, and generation failure rate.
- Document privacy expectations and data-retention policy for game results.
- Keep product analytics optional and privacy-conscious if introduced.

**Acceptance criteria**

- Product rules are precise enough to derive tests from them.
- UI copy, API behavior, and stored data agree with the specifications.
- New feature proposals state which user or reliability metric they are expected to improve.

---

## Deferred until the foundation is healthy

These ideas may be valuable, but they should not take precedence over the phases above:

- Friends and social comparisons.
- Achievements and badges.
- Puzzle replay.
- Thermo, Arrow, Sandwich, and additional variants.
- Multiplayer race mode.
- Custom puzzle import.
- Cell color-highlighting palettes.

Before promoting one of these, write a small product brief covering the target player, expected value, interaction design, abuse/privacy implications, data model, and success measure.

## Suggested first five pull requests

1. **Fail-closed Clerk authentication with regression tests** (`SEC-001`).
2. **Test foundation plus current lint fixes** (`TEST-001`, `QUAL-001`).
3. **Authoritative, validated, idempotent result submission** (`API-001`, `API-002`).
4. **Race-safe puzzle generation and loading/error UI** (`GAME-002`, `UI-001`).
5. **Unified completion transition fixing hint/timer behavior** (`GAME-001`, first portion of `GAME-003`).
