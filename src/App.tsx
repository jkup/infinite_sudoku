import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState, useCallback, useRef } from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import { useGameStore } from './store/gameStore';
import { useHintStore } from './store/hintStore';
import { useThemeStore, type Theme } from './store/themeStore';
import { useKeyboard } from './hooks/useKeyboard';
import type { Difficulty, GameMode } from './engine/types';
import Board from './components/board/Board';
import DigitBar from './components/board/DigitBar';
import ControlBar from './components/controls/ControlBar';
import Timer from './components/controls/Timer';
import GameModePicker from './components/controls/GameModePicker';
import PuzzleStack from './components/hint/PuzzleStack';
import ConfirmModal from './components/ui/ConfirmModal';
import KeyboardHelp from './components/ui/KeyboardHelp';
import Onboarding from './components/ui/Onboarding';
import UserButton from './components/auth/UserButton';
import StatsPanel from './components/stats/StatsPanel';

// Check both names: VITE_CLERK_PUBLISHABLE_KEY (local dev) and CLERK_PUBLIC (Cloudflare production)
const CLERK_KEY = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.CLERK_PUBLIC) as string | undefined;

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'newspaper', label: 'Newspaper' },
  { value: 'high-contrast', label: 'High Contrast' },
];

function ThemePicker() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value as Theme)}
      className="text-sm font-medium rounded-lg px-2 py-1.5 border cursor-pointer transition-colors"
      style={{
        backgroundColor: 'var(--color-btn-bg)',
        color: 'var(--color-btn-text)',
        borderColor: 'var(--color-cell-border)',
      }}
      aria-label="Theme"
    >
      {THEME_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function GearMenu({ onShowShortcuts }: { onShowShortcuts: () => void }) {
  const [open, setOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 flex items-center justify-center rounded-lg border transition-colors text-lg"
        style={{
          backgroundColor: 'var(--color-btn-bg)',
          color: 'var(--color-btn-text)',
          borderColor: 'var(--color-cell-border)',
        }}
        aria-label="Settings"
      >
        &#9881;
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 rounded-lg border shadow-lg p-3 min-w-[200px]"
          style={{
            backgroundColor: 'var(--color-card-bg, var(--color-bg))',
            borderColor: 'var(--color-cell-border)',
          }}
        >
          {/* Theme */}
          <div className="mb-3">
            <div className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
              Theme
            </div>
            <ThemePicker />
          </div>

          {/* Stats toggle */}
          <div className="mb-2">
            <button
              onClick={() => {
                setShowStats(!showStats);
                setOpen(false);
              }}
              className="w-full px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors text-left"
              style={{
                color: 'var(--color-btn-text)',
                borderColor: 'var(--color-cell-border)',
                backgroundColor: 'var(--color-btn-bg)',
              }}
            >
              {showStats ? 'Hide Stats' : 'Show Stats'}
            </button>
          </div>

          {/* Keyboard shortcuts */}
          <div>
            <button
              onClick={() => {
                onShowShortcuts();
                setOpen(false);
              }}
              className="w-full px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors text-left"
              style={{
                color: 'var(--color-btn-text)',
                borderColor: 'var(--color-cell-border)',
                backgroundColor: 'var(--color-btn-bg)',
              }}
            >
              Shortcuts
            </button>
          </div>
        </div>
      )}

      {/* Stats panel rendered outside the dropdown */}
      {showStats && (
        <div className="absolute right-0 top-full mt-12 z-40 w-[min(90vw,400px)]">
          <div
            className="rounded-lg border shadow-lg p-3"
            style={{
              backgroundColor: 'var(--color-card-bg, var(--color-bg))',
              borderColor: 'var(--color-cell-border)',
            }}
          >
            {CLERK_KEY ? (
              <StatsPanel />
            ) : (
              <div className="text-center text-sm py-4" style={{ color: 'var(--color-text-muted)' }}>
                Sign in to track your stats across devices.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GameScreen() {
  const newGame = useGameStore((s) => s.newGame);
  const puzzle = useGameStore((s) => s.puzzle);
  const status = useGameStore((s) => s.status);
  const difficulty = useGameStore((s) => s.difficulty);
  const mode = useGameStore((s) => s.mode);
  const historyIndex = useGameStore((s) => s.historyIndex);

  const hintStack = useHintStore((s) => s.stack);
  const completeHintPuzzle = useHintStore((s) => s.completeHintPuzzle);
  const isInHintStack = hintStack.length > 0;

  const [pendingGame, setPendingGame] = useState<{ difficulty: Difficulty; mode: GameMode } | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  useKeyboard(useCallback(() => setShowKeyboardHelp((v) => !v), []));

  const loadSavedGame = useGameStore((s) => s.loadSavedGame);

  // Start a game on first load — try restoring a saved game first
  useEffect(() => {
    if (!puzzle) {
      const restored = loadSavedGame();
      if (!restored) {
        newGame('easy');
      }
    }
  }, [puzzle, newGame, loadSavedGame]);

  // Request a new game — confirm if the current game has progress
  const requestNewGame = useCallback((d: Difficulty, m: GameMode) => {
    const hasProgress = historyIndex >= 0 && status === 'playing';
    if (hasProgress || isInHintStack) {
      setPendingGame({ difficulty: d, mode: m });
    } else {
      newGame(d, m);
    }
  }, [historyIndex, status, newGame, isInHintStack]);

  const confirmNewGame = useCallback(() => {
    if (pendingGame) {
      // Clear the hint stack when starting a fresh game
      useHintStore.setState({ stack: [] });
      newGame(pendingGame.difficulty, pendingGame.mode);
      setPendingGame(null);
    }
  }, [pendingGame, newGame]);

  if (!puzzle) return null;

  return (
    <div
      className="flex flex-col items-center min-h-screen px-4 py-3 transition-colors duration-200"
      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
    >
      {/* Header */}
      <div className="w-full max-w-[min(95vw,500px)] mb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-lg font-bold whitespace-nowrap" style={{ color: 'var(--color-text)' }}>Infinite Sudoku</h1>
            <GameModePicker onRequestNewGame={requestNewGame} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {CLERK_KEY && <UserButton />}
            <Timer />
            <GearMenu onShowShortcuts={() => setShowKeyboardHelp(true)} />
          </div>
        </div>
      </div>

      {/* Hint puzzle stack indicator */}
      <PuzzleStack />

      {/* Board */}
      <Board />

      {/* Controls */}
      <ControlBar onRequestNewGame={requestNewGame} />

      {/* Digit input */}
      <DigitBar />

      {/* Confirm new game modal */}
      {pendingGame && (
        <ConfirmModal
          title="Start new game?"
          message={isInHintStack
            ? "You're in a hint puzzle. Starting a new game will discard all progress including parent puzzles."
            : "Your current progress will be lost."
          }
          confirmLabel="New Game"
          cancelLabel="Keep Playing"
          onConfirm={confirmNewGame}
          onCancel={() => setPendingGame(null)}
        />
      )}

      {/* Completion overlay — different for hint puzzles vs regular */}
      {status === 'completed' && isInHintStack && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'var(--color-overlay-bg)' }}>
          <div className="rounded-2xl p-8 shadow-xl text-center max-w-sm mx-4" style={{ backgroundColor: 'var(--color-card-bg)' }}>
            <div className="text-4xl mb-3">&#127881;</div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
              Hint Earned!
            </h2>
            <p className="mb-6" style={{ color: 'var(--color-text-muted)' }}>
              Nice work! The answer will be revealed in your
              {hintStack.length > 1 ? ' parent' : ''} puzzle.
            </p>
            <button
              onClick={completeHintPuzzle}
              className="px-6 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 active:bg-amber-700 transition-colors"
            >
              Claim Hint
            </button>
          </div>
        </div>
      )}

      {status === 'completed' && !isInHintStack && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'var(--color-overlay-bg)' }}>
          <div className="rounded-2xl p-8 shadow-xl text-center max-w-sm mx-4" style={{ backgroundColor: 'var(--color-card-bg)' }}>
            <div className="text-4xl mb-3">&#127942;</div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
              Puzzle Complete!
            </h2>
            <p className="mb-6" style={{ color: 'var(--color-text-muted)' }}>
              Great job solving this {difficulty} {mode} puzzle!
            </p>
            <button
              onClick={() => newGame(difficulty, mode)}
              className="px-6 py-3 rounded-xl font-semibold transition-colors"
              style={{ backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)' }}
            >
              New Game
            </button>
          </div>
        </div>
      )}

      {/* Paused overlay */}
      {status === 'paused' && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'var(--color-overlay-bg)' }}
        >
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>Paused</h2>
            <button
              onClick={() => useGameStore.getState().resumeGame()}
              className="px-6 py-3 rounded-xl font-semibold transition-colors"
              style={{ backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)' }}
            >
              Resume
            </button>
          </div>
        </div>
      )}

      {/* Keyboard help overlay */}
      {showKeyboardHelp && <KeyboardHelp onClose={() => setShowKeyboardHelp(false)} />}

      {/* Onboarding for first-time players */}
      <Onboarding />

      {/* Footer */}
      <footer className="mt-4 mb-2 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <p>Made with &#10084;&#65039; by jkup</p>
        <p className="mt-1">
          <a
            href="https://github.com/jkup/infinite_sudoku/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            File an issue or feature request
          </a>
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  const router = (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GameScreen />} />
      </Routes>
    </BrowserRouter>
  );

  // Graceful fallback: if no Clerk key, render without auth
  if (!CLERK_KEY) {
    return router;
  }

  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      {router}
    </ClerkProvider>
  );
}
