ALTER TABLE game_results ADD COLUMN completion_id TEXT;
ALTER TABLE game_results ADD COLUMN stats_counted INTEGER NOT NULL DEFAULT 1 CHECK (stats_counted IN (0, 1));

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_results_completion
ON game_results(clerk_user_id, completion_id);
