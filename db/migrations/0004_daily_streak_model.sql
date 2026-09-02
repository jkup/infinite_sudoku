ALTER TABLE user_stats ADD COLUMN last_daily_date TEXT;
ALTER TABLE game_results ADD COLUMN daily_puzzle_id INTEGER;

ALTER TABLE daily_puzzles RENAME TO daily_puzzles_legacy;
CREATE TABLE daily_puzzles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL CHECK (length(date) = 10),
    mode TEXT NOT NULL CHECK (mode IN ('classic', 'killer')),
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
    puzzle_data TEXT NOT NULL,
    cage_data TEXT,
    solution TEXT NOT NULL,
    par_time_ms INTEGER CHECK (par_time_ms IS NULL OR par_time_ms >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (date, mode)
);
INSERT INTO daily_puzzles
  (id, date, mode, difficulty, puzzle_data, cage_data, solution, par_time_ms, created_at)
SELECT id, date, mode, difficulty, puzzle_data, cage_data, solution, par_time_ms, created_at
FROM daily_puzzles_legacy;
DROP TABLE daily_puzzles_legacy;

DROP INDEX IF EXISTS idx_daily_puzzles_date;
CREATE INDEX idx_daily_puzzles_date_mode ON daily_puzzles(date, mode);
CREATE UNIQUE INDEX idx_game_results_user_daily_puzzle
ON game_results(clerk_user_id, daily_puzzle_id)
WHERE daily_puzzle_id IS NOT NULL;

DROP TRIGGER validate_game_results_insert;
DROP TRIGGER validate_game_results_update;
CREATE TRIGGER validate_game_results_insert
BEFORE INSERT ON game_results
WHEN NEW.mode NOT IN ('classic', 'killer')
  OR NEW.difficulty NOT IN ('easy', 'medium', 'hard', 'expert')
  OR NEW.solve_time_ms < 0 OR NEW.hints_used < 0 OR NEW.max_hint_depth < 0
  OR NEW.errors_made < 0 OR NEW.score < 0 OR NEW.is_daily NOT IN (0, 1)
  OR NEW.completion_id IS NULL
  OR (NEW.is_daily = 0 AND (NEW.daily_date IS NOT NULL OR NEW.daily_puzzle_id IS NOT NULL))
  OR (NEW.is_daily = 1 AND (NEW.daily_date IS NULL OR length(NEW.daily_date) <> 10 OR NEW.daily_puzzle_id IS NULL))
BEGIN SELECT RAISE(ABORT, 'invalid game result'); END;

CREATE TRIGGER validate_game_results_update
BEFORE UPDATE ON game_results
WHEN NEW.mode NOT IN ('classic', 'killer')
  OR NEW.difficulty NOT IN ('easy', 'medium', 'hard', 'expert')
  OR NEW.solve_time_ms < 0 OR NEW.hints_used < 0 OR NEW.max_hint_depth < 0
  OR NEW.errors_made < 0 OR NEW.score < 0 OR NEW.is_daily NOT IN (0, 1)
  OR NEW.completion_id IS NULL
  OR (NEW.is_daily = 0 AND (NEW.daily_date IS NOT NULL OR NEW.daily_puzzle_id IS NOT NULL))
  OR (NEW.is_daily = 1 AND (NEW.daily_date IS NULL OR length(NEW.daily_date) <> 10 OR NEW.daily_puzzle_id IS NULL))
BEGIN SELECT RAISE(ABORT, 'invalid game result'); END;
