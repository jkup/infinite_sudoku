# Infinite Sudoku - Project Plan

## 1. Vision

A best-in-class Sudoku web app supporting **Normal** and **Killer** modes with a unique **recursive hint system**: requesting a hint on any cell launches a new puzzle one difficulty level easier. Solve that puzzle to earn your hint — and if you need a hint there, it nests again, all the way down to the easiest difficulty. Puzzles within puzzles.

Free forever. Built for speed, beauty, and the joy of solving.

---

## 2. Core Feature Set

### 2.1 Game Modes

| Mode | Description |
|------|-------------|
| **Classic Sudoku** | Standard 9x9 grid, digits 1-9, standard row/column/box constraints |
| **Killer Sudoku** | Cages with sum constraints overlaid on standard Sudoku rules (no repeated digits in a cage) |

Each mode is available at five difficulty levels:

1. **Beginner** — solvable with naked singles only
2. **Easy** — naked singles + hidden singles
3. **Medium** — adds pointing pairs, box/line reduction
4. **Hard** — adds naked/hidden pairs/triples, X-wing
5. **Expert** — requires advanced techniques (swordfish, XY-wing, coloring, etc.)

### 2.2 The Recursive Hint System (Signature Feature)

This is what makes Infinite Sudoku unique:

1. Player is stuck on a cell and taps **"Hint"**
2. A modal explains: *"Solve a [difficulty - 1] puzzle to earn this hint!"*
3. A new puzzle loads (one difficulty level easier). The original game is **paused and preserved** in a stack.
4. Player solves the easier puzzle. Upon completion, they're returned to the original puzzle and the hinted cell is revealed.
5. If the player needs a hint in the *hint puzzle*, the same mechanic applies — another level deeper.
6. This continues recursively until **Beginner** difficulty, where hints are free (direct reveal) since there's nowhere easier to go.

**Stack model:**
```
Expert puzzle (stuck on R3C7)
  → Hard puzzle (spawned as hint)
      → Medium puzzle (spawned as hint)
          → ... all the way to Beginner if needed
```

**UX considerations:**
- A visible **breadcrumb / depth indicator** shows the player how deep they are (e.g., "Puzzle Stack: 3 deep")
- Players can **abandon** a hint puzzle at any depth and return to the parent (forfeiting the hint)
- Completing a hint puzzle awards **reduced points** (to discourage hint farming)
- Each hint-puzzle is a full, valid Sudoku — not a throwaway mini-game
- Time spent in hint puzzles is tracked separately and does not count toward the parent puzzle's solve time

### 2.3 Note-Taking System

- **Corner notes** — small digits in corners for candidates (pencil marks)
- **Center notes** — centered digits for "I know it's one of these"
- **Color highlighting** — tap cells to color-code them (6-8 color palette)
- Toggle between **input mode** and **note mode** with a single tap/keypress
- **Auto-remove notes** — when a digit is placed, automatically remove that digit from notes in the same row/column/box
- Option to **auto-fill candidates** for all empty cells (with confirmation prompt)

### 2.4 Power Features

- **Undo / Redo** — full history stack, unlimited depth
- **Keyboard shortcuts** (desktop):

| Action | Shortcut |
|--------|----------|
| Place digit | `1`-`9` |
| Delete digit | `Backspace` / `Delete` |
| Toggle note mode | `N` |
| Corner note | `Shift + 1`-`9` |
| Undo | `Ctrl/Cmd + Z` |
| Redo | `Ctrl/Cmd + Shift + Z` |
| Navigate cells | Arrow keys |
| Highlight digit | Double-tap a digit |
| Hint | `H` |
| Pause | `Space` |
| Color cell | `C` then `1`-`8` |

- **Highlight matching digits** — selecting a cell highlights all cells with the same digit
- **Highlight conflicts** — real-time error highlighting (toggleable for purists)
- **Timer** — with pause, displayed prominently
- **Auto-save** — game state persists across sessions (saved to local storage + cloud sync when logged in)
- **Night mode / themes** — dark mode, high contrast, classic newspaper style
- **Digit completion indicator** — shows which digits (1-9) are fully placed (all 9 instances)

### 2.5 Daily Puzzle

- One curated puzzle per day per mode (Classic + Killer)
- Global leaderboard for daily solve times
- **Streak tracking** — consecutive days completing the daily puzzle
- Calendar view showing completion history

---

## 3. Scoring & Stats

### 3.1 Points System

| Factor | Points |
|--------|--------|
| Base completion | 1000 |
| Difficulty multiplier | Beginner: x1, Easy: x2, Medium: x4, Hard: x8, Expert: x16 |
| Time bonus | Decreasing bonus based on solve time vs. par time |
| No hints used | +500 bonus |
| No errors made | +300 bonus |
| Hint penalty | -200 per hint used (recursive puzzle doesn't award full points) |

### 3.2 Stats Dashboard

- **Solve times** — best, average, and recent per difficulty per mode
- **Win rate** — percentage of started games that were completed
- **Streaks** — current and longest daily streak
- **Total games** — completed, abandoned, in-progress
- **Hints used** — total, average per game, deepest recursion reached
- **Graphs** — solve time trends over time

### 3.3 Leaderboards

- **Daily puzzle** — global ranking by time
- **All-time** — highest cumulative score
- **Weekly** — best score in a rolling 7-day window
- Leaderboards filterable by mode and difficulty

---

## 4. Puzzle Generation vs. Database

**Hybrid approach:**

### Generation (primary, for free play)
- Algorithmic puzzle generation on the client side using a constraint-based generator
- Difficulty is determined by the solving techniques required (not just the number of givens)
- A **solver engine** classifies difficulty by attempting progressively advanced techniques
- Generates puzzles on-demand — no storage needed, infinite supply
- Killer Sudoku cages are generated with valid, unique-sum groupings

### Database (for daily puzzles and curated content)
- Daily puzzles are **pre-generated and stored in D1** so all players get the same puzzle
- Quality-controlled: daily puzzles are generated in advance, tested for solvability and satisfying difficulty
- Stored with metadata: difficulty, techniques required, par time

### Why hybrid?
- Client-side generation means the app works offline and scales infinitely with zero server cost
- Server-stored dailies ensure a shared social experience (same puzzle, global leaderboard)

---

## 5. Technical Architecture

### 5.1 Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + Vite |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4 |
| **State management** | Zustand (lightweight, perfect for game state) |
| **Routing** | React Router v7 |
| **Auth** | Clerk |
| **Database** | Cloudflare D1 (SQLite at the edge) |
| **KV Store** | Cloudflare KV (daily puzzle cache, session data) |
| **Hosting** | Cloudflare Pages |
| **API** | Cloudflare Pages Functions (serverless, co-located with the app) |

### 5.2 Project Structure

```
infinite-sudoku/
├── public/
│   ├── favicon.ico
│   └── manifest.json              # PWA manifest
├── src/
│   ├── main.tsx                   # Entry point
│   ├── App.tsx                    # Root component + routing
│   ├── components/
│   │   ├── board/
│   │   │   ├── Board.tsx          # 9x9 grid container
│   │   │   ├── Cell.tsx           # Individual cell (digit, notes, colors)
│   │   │   ├── CageOverlay.tsx    # Killer Sudoku cage borders + sums
│   │   │   └── DigitBar.tsx       # Bottom bar for digit input (mobile)
│   │   ├── controls/
│   │   │   ├── ControlBar.tsx     # Undo, redo, erase, note toggle, hint
│   │   │   ├── Timer.tsx          # Game timer display
│   │   │   └── DifficultyPicker.tsx
│   │   ├── hint/
│   │   │   ├── HintModal.tsx      # "Solve a puzzle to earn a hint" modal
│   │   │   ├── PuzzleStack.tsx    # Breadcrumb / depth indicator
│   │   │   └── HintTransition.tsx # Animation between puzzle levels
│   │   ├── stats/
│   │   │   ├── StatsPage.tsx
│   │   │   ├── Leaderboard.tsx
│   │   │   └── StreakCalendar.tsx
│   │   ├── daily/
│   │   │   └── DailyPuzzle.tsx
│   │   ├── settings/
│   │   │   └── SettingsPage.tsx
│   │   └── ui/
│   │       ├── Modal.tsx
│   │       ├── Button.tsx
│   │       └── ThemeProvider.tsx
│   ├── engine/
│   │   ├── generator.ts           # Puzzle generation algorithm
│   │   ├── solver.ts              # Constraint-based solver + difficulty classifier
│   │   ├── killer.ts              # Killer Sudoku cage generation + validation
│   │   ├── validator.ts           # Move validation, conflict detection
│   │   └── types.ts               # Core game types (Grid, Cell, Cage, etc.)
│   ├── store/
│   │   ├── gameStore.ts           # Zustand store: board state, history, timer
│   │   ├── hintStore.ts           # Puzzle stack for recursive hints
│   │   ├── settingsStore.ts       # User preferences (theme, auto-check, etc.)
│   │   └── statsStore.ts          # Local stats + sync state
│   ├── hooks/
│   │   ├── useKeyboard.ts         # Keyboard shortcut handler
│   │   ├── useTimer.ts            # Timer logic
│   │   ├── useAutoSave.ts         # Persist game state
│   │   └── useCloudSync.ts        # Sync stats/state with D1 when logged in
│   ├── lib/
│   │   ├── api.ts                 # API client for Cloudflare Functions
│   │   ├── scoring.ts             # Points calculation
│   │   └── constants.ts           # Difficulty params, colors, etc.
│   └── styles/
│       └── index.css              # Tailwind imports + custom game styles
├── functions/                     # Cloudflare Pages Functions (API)
│   ├── api/
│   │   ├── daily.ts               # GET daily puzzle
│   │   ├── leaderboard.ts         # GET/POST leaderboard entries
│   │   ├── stats.ts               # GET/POST user stats
│   │   └── middleware.ts          # Clerk auth verification
│   └── _middleware.ts             # Global middleware
├── db/
│   └── schema.sql                 # D1 schema
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
├── wrangler.toml                  # Cloudflare config
├── package.json
└── PLAN.md
```

### 5.3 Database Schema (Cloudflare D1)

```sql
-- Users are managed by Clerk; we store Clerk user IDs as references
CREATE TABLE user_stats (
    clerk_user_id TEXT PRIMARY KEY,
    total_games_completed INTEGER DEFAULT 0,
    total_hints_used INTEGER DEFAULT 0,
    current_daily_streak INTEGER DEFAULT 0,
    longest_daily_streak INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE game_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clerk_user_id TEXT NOT NULL,
    mode TEXT NOT NULL,            -- 'classic' | 'killer'
    difficulty TEXT NOT NULL,      -- 'beginner' | 'easy' | 'medium' | 'hard' | 'expert'
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

CREATE TABLE daily_puzzles (
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

CREATE INDEX idx_game_results_user ON game_results(clerk_user_id);
CREATE INDEX idx_game_results_daily ON game_results(is_daily, daily_date);
CREATE INDEX idx_daily_puzzles_date ON daily_puzzles(date);
```

### 5.4 Key Cloudflare KV Usage

| Key Pattern | Value | Purpose |
|-------------|-------|---------|
| `daily:{date}:{mode}` | Puzzle JSON | Cache today's daily puzzle at the edge |
| `leaderboard:{date}:{mode}:top100` | Sorted results JSON | Cache daily leaderboard |

---

## 6. UI / UX Design

### 6.1 Layout

**Desktop (>768px):**
```
┌─────────────────────────────────────────────┐
│  Logo    Daily  |  Mode  Difficulty  | Timer │
├────────────────────────┬────────────────────┤
│                        │  Stats sidebar     │
│                        │  - Digits remaining│
│     9x9 Sudoku Board   │  - Hint depth      │
│                        │  - Score preview   │
│                        │                    │
├────────────────────────┴────────────────────┤
│  Controls: Undo | Redo | Notes | Hint | ... │
└─────────────────────────────────────────────┘
```

**Mobile (<768px):**
```
┌─────────────────────┐
│ Timer    ≡ Menu     │
├─────────────────────┤
│                     │
│  9x9 Sudoku Board   │
│  (touch-optimized)  │
│                     │
├─────────────────────┤
│ 1 2 3 4 5 6 7 8 9  │  ← Digit bar
├─────────────────────┤
│ ↩ ↪ ✏ 🎨 💡 ⌫     │  ← Controls
└─────────────────────┘
```

### 6.2 Design Principles

- **Touch targets minimum 44x44px** on mobile
- **Cell size scales** to fill available viewport (CSS Grid + `min()` / `clamp()`)
- **No pinch-to-zoom needed** — board always fits the screen
- **Haptic feedback** on mobile for digit placement (Vibration API)
- **Smooth animations** for hint transitions (puzzle slides out, new puzzle slides in)
- **Cage borders** in Killer mode use **dashed lines** with sum labels in the top-left corner of each cage
- **Accessible**: high contrast mode, screen reader labels for cells, ARIA grid role

### 6.3 Themes

| Theme | Description |
|-------|-------------|
| **Light** (default) | Clean white background, blue accent |
| **Dark** | True dark (#121212), muted cell borders |
| **Newspaper** | Warm cream background, serif digits, classic look |
| **High Contrast** | WCAG AAA compliant, bold borders |

---

## 7. Offline / PWA Support

- **Service worker** for offline play (Vite PWA plugin)
- App is installable on mobile home screens
- Offline games sync stats when connectivity returns
- Puzzle generation is entirely client-side, so free play always works offline
- Daily puzzles are cached aggressively in KV and service worker

---

## 8. Implementation Phases

### Phase 1 — Core Game (MVP)
- [ ] Project setup: Vite + React + TypeScript + Tailwind
- [ ] Sudoku engine: generator, solver, difficulty classifier
- [ ] Classic Sudoku board rendering (responsive grid)
- [ ] Cell selection, digit input (keyboard + touch)
- [ ] Basic note-taking (corner notes)
- [ ] Conflict highlighting
- [ ] Timer
- [ ] Undo/redo
- [ ] Game completion detection + celebration screen
- [ ] Local auto-save (localStorage)
- [ ] Deploy to Cloudflare Pages

### Phase 2 — Hint System + Killer Mode
- [ ] Recursive hint system with puzzle stack
- [ ] Hint modal + breadcrumb UI
- [ ] Puzzle stack state management
- [ ] Hint transition animations
- [ ] Killer Sudoku cage generation
- [ ] Cage overlay rendering (dashed borders + sum labels)
- [ ] Killer mode validation (cage sum + no repeats)
- [ ] Center notes
- [ ] Color highlighting for cells

### Phase 3 — Auth, Cloud Sync, Leaderboards
- [ ] Clerk integration (sign up / sign in)
- [ ] Cloudflare D1 schema + migrations
- [ ] Pages Functions API endpoints
- [ ] Cloud save/sync for game state and stats
- [ ] Points/scoring system
- [ ] Stats dashboard
- [ ] Daily puzzle system (generation pipeline + storage)
- [ ] Daily leaderboards
- [ ] Streak tracking + calendar

### Phase 4 — Polish & PWA
- [ ] Dark mode + themes
- [ ] PWA manifest + service worker
- [ ] Offline support
- [ ] Keyboard shortcut overlay / help screen
- [ ] Onboarding tutorial for new players
- [ ] Celebration animations (confetti on solve)
- [ ] Haptic feedback on mobile
- [ ] Performance optimization (memo, virtualization if needed)
- [ ] Accessibility audit (screen readers, keyboard nav, contrast)

### Phase 5 — Nice-to-Haves (Post-Launch)
- [ ] Share daily results (image/text like Wordle)
- [ ] Friends list + compare stats
- [ ] Achievement system / badges
- [ ] Puzzle replay (watch your solve playback)
- [ ] Additional variants (Thermo, Arrow, Sandwich)
- [ ] Multiplayer race mode
- [ ] Custom puzzle import (from string/URL)

---

## 9. Open Questions & Decisions

| # | Question | Current Lean | Notes |
|---|----------|-------------|-------|
| 1 | Should puzzle generation run in a Web Worker? | **Yes** | Prevents UI jank during generation, especially for harder puzzles |
| 2 | Should we use Canvas or DOM for the board? | **DOM (CSS Grid)** | Easier for accessibility, interactions, and responsiveness. Canvas only if perf demands it |
| 3 | Clerk free tier limits? | **10k MAU** | More than enough for launch; revisit if it grows |
| 4 | D1 vs KV for game results? | **D1** | Relational queries needed for leaderboards. KV for caching only |
| 5 | Should hint puzzles of the same difficulty share state? | **No** | Each hint spawn is a fresh puzzle to keep it clean |
| 6 | What happens at Beginner if you need a hint? | **Free reveal** | No easier puzzle exists, so just give it |

---

## 10. Success Metrics

- **Playable MVP** deployed to Cloudflare Pages
- **< 100ms** interaction latency (digit placement, navigation)
- **< 2s** puzzle generation time even on mobile (via Web Worker)
- **Lighthouse score > 95** on Performance, Accessibility, Best Practices
- **Works fully offline** after first load
- **Zero ongoing server costs** beyond Cloudflare free tier + Clerk free tier
