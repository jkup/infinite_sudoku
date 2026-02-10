# Infinite Sudoku

A full-stack PWA Sudoku game with logic-based puzzle generation, multiple game modes, theming, authentication, and cloud sync.

## Quick Reference

```bash
npm run dev          # Vite dev server with HMR
npm run dev:full     # Wrangler Pages dev (includes Cloudflare Functions + D1)
npm run build        # tsc -b && vite build
npm run lint         # ESLint
npm run preview      # Preview production build
```

Build must pass `tsc -b` (strict mode, no unused locals/params) before Vite bundles.

## Tech Stack

- **React 19** + TypeScript (strict) + Vite 7
- **Tailwind CSS 4** via `@tailwindcss/vite` plugin (no PostCSS config — uses Vite plugin)
- **Zustand 5** for state management (3 stores: game, hint, theme)
- **Clerk** for auth (optional — app works without CLERK_PUBLIC key)
- **Cloudflare Pages** for hosting, **Pages Functions** for API, **D1** for database
- **vite-plugin-pwa** with Workbox for offline support

## Project Structure

```
src/
  engine/         # Pure logic — no React/DOM. Generator, solver, validator, killer cages
  store/          # Zustand stores (gameStore, hintStore, themeStore)
  components/     # React components organized by feature (board/, controls/, hint/, ui/, auth/, stats/)
  hooks/          # useKeyboard
  lib/            # API calls, localStorage persistence, scoring
functions/        # Cloudflare Pages Functions (API endpoints + JWT middleware)
db/               # D1 schema (schema.sql)
public/           # PWA icons (favicon.svg, pwa-192x192.png, pwa-512x512.png)
```

## Architecture Patterns

### State Management

All game state lives in Zustand stores accessed via hooks (`useGameStore`, `useHintStore`, `useThemeStore`). Stores are also accessed outside React via `useGameStore.getState()` (e.g., in keyboard handler). Game state auto-saves to localStorage via a debounced Zustand subscription.

### Engine (src/engine/)

Pure TypeScript, no framework dependencies — runs in both main thread and Web Worker.

- **generator.ts**: Generates filled grid via backtracking, then removes cells while verifying unique solution and logic solvability. Difficulty is determined by the hardest solving technique required.
- **solver.ts**: Constraint propagation solver with 10 technique levels (NakedSingle through YWing). Returns max technique used, which maps to difficulty.
- **validator.ts**: `findConflicts()` returns a Map of cells with duplicate digits in row/col/box. `getPeers()` returns all cells that share a row, column, or box.
- **killer.ts**: Generates connected cage groups tiling the grid. Cage sizes vary by difficulty.
- **generateAsync.ts**: Web Worker wrapper. Falls back to sync `generatePuzzle()` if Workers are unavailable.

### Hint System

The hint system uses puzzle stacking. When a player requests a hint, the current game state is pushed onto a stack and a new easier puzzle is loaded. Solving the easier puzzle "earns" the hint. This can nest recursively (hints on hints). The `hintStore` manages the stack and transitions.

### Theming

CSS custom properties on `:root` with `data-theme` attribute switching. Four themes: light (default), dark, newspaper, high-contrast. All colors are referenced as `var(--color-*)` in inline styles. Theme choice persists in localStorage.

**Important**: Components use inline `style={{ color: 'var(--color-text)' }}` rather than Tailwind color classes, because theme colors are CSS custom properties not in the Tailwind config.

### Killer Mode Borders

In killer mode, individual cell borders are uniform thin lines (no thick box boundaries). The dashed cage borders come from an SVG overlay (`CageOverlay.tsx`) positioned absolutely over the grid. The outer board border is a 2px solid line on the grid container in `Board.tsx`.

### Authentication

Sign-in uses a dedicated `/sign-in` route with Clerk's `<SignIn />` component (not Clerk's modal mode, which breaks on mobile when users swipe to switch apps). After successful sign-in, the user is redirected back to `/`.

### Mobile Layout

- Title ("Infinite Sudoku") is hidden on small screens (`hidden sm:block`)
- "New Game" button shortens to "New" on mobile
- Footer "File an issue" link is hidden on mobile
- Header items are centered on mobile, spread with title on desktop

## Environment Variables

Create a `.dev.vars` file for local development:

```
CLERK_PUBLIC=pk_test_...
CLERK_SECRET=sk_test_...
```

The app works without Clerk keys — auth features are gracefully disabled.

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/store/gameStore.ts` | Core game state, all game actions (placeDigit, undo, newGame, etc.) |
| `src/store/hintStore.ts` | Hint puzzle stack, transition animations |
| `src/engine/generator.ts` | Puzzle generation algorithm |
| `src/engine/solver.ts` | Logic solver + difficulty classification |
| `src/components/board/Cell.tsx` | Cell rendering (memo'd), border logic for classic vs killer |
| `src/components/board/Board.tsx` | Grid layout, selection/highlight logic |
| `src/App.tsx` | Main layout, overlays (completion, pause, onboarding, keyboard help) |
| `src/index.css` | Theme CSS custom properties, animation keyframes |
| `vite.config.ts` | Vite + React + Tailwind + PWA plugin config |

## Common Gotchas

- **Sets in state**: Cell notes are `Set<Digit>` — they must be cloned (`new Set(...)`) before mutation to avoid mutating history.
- **Grid cloning**: Always use `cloneGrid()` before modifying — the grid is a 2D array of objects with Sets.
- **Board width**: The board relies on its parent having a width. Wrapping `<Board />` in a div without `w-full` will collapse the grid into a single column.
- **Inline styles for theming**: Don't use Tailwind color utilities for themed colors — use `style={{ color: 'var(--color-*)' }}`.
- **PWA caching**: After changes, the service worker precache updates on build. During dev, PWA is not active.
