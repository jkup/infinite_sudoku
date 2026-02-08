import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from './store/gameStore';
import { useKeyboard } from './hooks/useKeyboard';
import type { Difficulty, GameMode } from './engine/types';
import Board from './components/board/Board';
import DigitBar from './components/board/DigitBar';
import ControlBar from './components/controls/ControlBar';
import Timer from './components/controls/Timer';
import DifficultyPicker from './components/controls/DifficultyPicker';
import ModePicker from './components/controls/ModePicker';
import ConfirmModal from './components/ui/ConfirmModal';

function GameScreen() {
  const newGame = useGameStore((s) => s.newGame);
  const puzzle = useGameStore((s) => s.puzzle);
  const status = useGameStore((s) => s.status);
  const difficulty = useGameStore((s) => s.difficulty);
  const mode = useGameStore((s) => s.mode);
  const historyIndex = useGameStore((s) => s.historyIndex);

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
    if (hasProgress) {
      setPendingGame({ difficulty: d, mode: m });
    } else {
      newGame(d, m);
    }
  }, [historyIndex, status, newGame]);

  const confirmNewGame = useCallback(() => {
    if (pendingGame) {
      newGame(pendingGame.difficulty, pendingGame.mode);
      setPendingGame(null);
    }
  }, [pendingGame, newGame]);

  if (!puzzle) return null;

  return (
    <div className="flex flex-col items-center min-h-screen bg-white px-4 py-6">
      {/* Header */}
      <div className="w-full max-w-[min(90vw,500px)] mb-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-slate-800">Infinite Sudoku</h1>
          <Timer />
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <ModePicker onRequestNewGame={requestNewGame} />
          <DifficultyPicker onRequestNewGame={requestNewGame} />
        </div>
      </div>

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
          message="Your current progress will be lost."
          confirmLabel="New Game"
          cancelLabel="Keep Playing"
          onConfirm={confirmNewGame}
          onCancel={() => setPendingGame(null)}
        />
      )}

      {/* Completion overlay */}
      {status === 'completed' && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 shadow-xl text-center max-w-sm mx-4">
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
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GameScreen />} />
      </Routes>
    </BrowserRouter>
  );
}
