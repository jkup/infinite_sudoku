# Daily puzzle rules

- Daily identity uses the `YYYY-MM-DD` UTC date stored on the canonical puzzle.
- There is one canonical puzzle per UTC date and mode. Classic and Killer may
  therefore each have a daily puzzle on the same date.
- A submitted daily result is accepted as daily only when its database ID,
  mode, and difficulty match a canonical `daily_puzzles` row.
- Each user can have one counted result per canonical puzzle. Retries and
  replays return success but do not change totals, streaks, or ranking rows.
- Completing both modes on one UTC date increases the streak only once.
- The first daily completion starts a streak of one. A completion for the UTC
  date immediately after `last_daily_date` increments it; a later date resets
  it to one. Replaying an earlier date never rewinds or changes a streak.
- Ordinary generated games contribute to aggregate games, hints, and score but
  never change daily streak fields.

The canonical puzzle date, rather than request arrival time or a player's local
timezone, controls streak behavior. This keeps a completion stable around local
midnight and delayed/offline submission.
