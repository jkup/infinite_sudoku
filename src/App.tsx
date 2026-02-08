import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import { useGameStore } from './store/gameStore';
import { useHintStore } from './store/hintStore';
import { useKeyboard } from './hooks/useKeyboard';
import type { Difficulty, GameMode } from './engine/types';
import Board from './components/board/Board';
import DigitBar from './components/board/DigitBar';
import ControlBar from './components/controls/ControlBar';
import Timer from './components/controls/Timer';
import DifficultyPicker from './components/controls/DifficultyPicker';
import ModePicker from './components/controls/ModePicker';
import PuzzleStack from './components/hint/PuzzleStack';
import ConfirmModal from './components/ui/ConfirmModal';
import UserButton from './components/auth/UserButton';
import StatsPanel from './components/stats/StatsPanel';

// Check both names: VITE_CLERK_PUBLISHABLE_KEY (local dev) and CLERK_PUBLIC (Cloudflare production)
const CLERK_KEY = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.CLERK_PUBLIC) as string | undefined;

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

  useKeyboard();

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

  const [showStats, setShowStats] = useState(false);

  if (!puzzle) return null;

  return (
    <div className="flex flex-col items-center min-h-screen bg-white px-4 py-6">
      {/* Header */}
      <div className="w-full max-w-[min(90vw,500px)] mb-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-slate-800">Infinite Sudoku</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowStats(!showStats)}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Stats
            </button>
            {CLERK_KEY && <UserButton />}
            <Timer />
          </div>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <ModePicker onRequestNewGame={requestNewGame} />
          <DifficultyPicker onRequestNewGame={requestNewGame} />
        </div>
      </div>

      {/* Stats panel */}
      {showStats && (
        <div className="w-full max-w-[min(90vw,500px)] mb-4">
          {CLERK_KEY ? (
            <StatsPanel />
          ) : (
            <div className="text-center text-slate-400 text-sm py-6">
              Sign in to track your stats across devices.
            </div>
          )}
        </div>
      )}

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
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 shadow-xl text-center max-w-sm mx-4">
            <div className="text-4xl mb-3">&#127881;</div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Hint Earned!
            </h2>
            <p className="text-slate-500 mb-6">
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
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 shadow-xl text-center max-w-sm mx-4">
            <div className="text-4xl mb-3">&#127942;</div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Puzzle Complete!
            </h2>
            <p className="text-slate-500 mb-6">
              Great job solving this {difficulty} {mode} puzzle!
            </p>
            <button
              onClick={() => newGame(difficulty, mode)}
              className="px-6 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 active:bg-blue-700 transition-colors"
            >
              New Game
            </button>
          </div>
        </div>
      )}

      {/* Paused overlay */}
      {status === 'paused' && (
        <div className="fixed inset-0 bg-white/90 flex items-center justify-center z-50">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Paused</h2>
            <button
              onClick={() => useGameStore.getState().resumeGame()}
              className="px-6 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 active:bg-blue-700 transition-colors"
            >
              Resume
            </button>
          </div>
        </div>
      )}
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
