-- Users are managed by Clerk; we store Clerk user IDs as references
CREATE TABLE IF NOT EXISTS user_stats (
    clerk_user_id TEXT PRIMARY KEY,
    total_games_completed INTEGER DEFAULT 0,
    total_hints_used INTEGER DEFAULT 0,
    current_daily_streak INTEGER DEFAULT 0,
    longest_daily_streak INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clerk_user_id TEXT NOT NULL,
    mode TEXT NOT NULL,            -- 'classic' | 'killer'
    difficulty TEXT NOT NULL,      -- 'easy' | 'medium' | 'hard' | 'expert'
    solve_time_ms INTEGER NOT NULL,
    hints_used INTEGER DEFAULT 0,
    max_hint_depth INTEGER DEFAULT 0,
    errors_made INTEGER DEFAULT 0,
    score INTEGER NOT NULL,
    is_daily INTEGER DEFAULT 0,   -- 1 if this was the daily puzzle
    daily_date TEXT,              -- date string for daily puzzles
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clerk_user_id) REFERENCES user_stats(clerk_user_id)
);

CREATE TABLE IF NOT EXISTS daily_puzzles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,     -- 'YYYY-MM-DD'
    mode TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    puzzle_data TEXT NOT NULL,     -- JSON: initial grid state
    cage_data TEXT,               -- JSON: killer cages (null for classic)
    solution TEXT NOT NULL,        -- JSON: solved grid
    par_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_results_user ON game_results(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_game_results_daily ON game_results(is_daily, daily_date);
CREATE INDEX IF NOT EXISTS idx_daily_puzzles_date ON daily_puzzles(date);
