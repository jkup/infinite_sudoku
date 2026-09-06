-- Cached public display name for leaderboards, refreshed from Clerk on each
-- counted completion. NULL until a player submits a result.
ALTER TABLE user_stats ADD COLUMN display_name TEXT;
