CREATE TRIGGER validate_game_results_insert
BEFORE INSERT ON game_results
WHEN NEW.mode NOT IN ('classic', 'killer')
  OR NEW.difficulty NOT IN ('easy', 'medium', 'hard', 'expert')
  OR NEW.solve_time_ms < 0
  OR NEW.hints_used < 0
  OR NEW.max_hint_depth < 0
  OR NEW.errors_made < 0
  OR NEW.score < 0
  OR NEW.is_daily NOT IN (0, 1)
  OR NEW.completion_id IS NULL
  OR (NEW.is_daily = 0 AND NEW.daily_date IS NOT NULL)
  OR (NEW.is_daily = 1 AND (NEW.daily_date IS NULL OR length(NEW.daily_date) <> 10))
BEGIN
  SELECT RAISE(ABORT, 'invalid game result');
END;

CREATE TRIGGER validate_game_results_update
BEFORE UPDATE ON game_results
WHEN NEW.mode NOT IN ('classic', 'killer')
  OR NEW.difficulty NOT IN ('easy', 'medium', 'hard', 'expert')
  OR NEW.solve_time_ms < 0
  OR NEW.hints_used < 0
  OR NEW.max_hint_depth < 0
  OR NEW.errors_made < 0
  OR NEW.score < 0
  OR NEW.is_daily NOT IN (0, 1)
  OR NEW.completion_id IS NULL
  OR (NEW.is_daily = 0 AND NEW.daily_date IS NOT NULL)
  OR (NEW.is_daily = 1 AND (NEW.daily_date IS NULL OR length(NEW.daily_date) <> 10))
BEGIN
  SELECT RAISE(ABORT, 'invalid game result');
END;

CREATE INDEX idx_game_results_daily_ranking
ON game_results(is_daily, daily_date, mode, score DESC, completed_at ASC);
