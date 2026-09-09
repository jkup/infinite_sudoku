import { useReducedMotion } from './hooks/useReducedMotion';
import { usePopup } from './hooks/usePopup';
import Modal from './components/ui/Modal';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useGameStore } from './store/gameStore';
import { useHintStore } from './store/hintStore';
import { useTutorialStore, getTutorialById } from './store/tutorialStore';
import { useThemeStore, type Theme } from './store/themeStore';
import { usePreferencesStore } from './store/preferencesStore';
import { useKeyboard } from './hooks/useKeyboard';
import type { Difficulty, GameMode } from './engine/types';
import Board from './components/board/Board';
import DigitBar from './components/board/DigitBar';
import ControlBar from './components/controls/ControlBar';
import Timer from './components/controls/Timer';
import GameModePicker from './components/controls/GameModePicker';
import DailyPicker, { DailyPickerWithProgress } from './components/controls/DailyPicker';
import PuzzleStack from './components/hint/PuzzleStack';
import ConfirmModal from './components/ui/ConfirmModal';
import KeyboardHelp from './components/ui/KeyboardHelp';
import Onboarding from './components/ui/Onboarding';
import Confetti from './components/ui/Confetti';
import UserButton from './components/auth/UserButton';
import StatsPanel from './components/stats/StatsPanel';
import ScoreSummary from './components/stats/ScoreSummary';
import Leaderboard, { type LeaderboardStanding } from './components/stats/Leaderboard';
import ShareResultButton from './components/stats/ShareResultButton';
import { formatDailyDate, utcDateString } from './lib/daily';
import TutorialList from './components/tutorial/TutorialList';
import TutorialLesson from './components/tutorial/TutorialLesson';
import { setAuthTokenGetter } from './lib/api';
import PwaLifecycle from './components/ui/PwaLifecycle';

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
  const { ref, triggerRef, id } = usePopup(open ? 'settings' : showStats ? 'stats' : false, () => { setOpen(false); setShowStats(false); }, 'panel');
  const checkAnswers = usePreferencesStore((s) => s.checkAnswers);
  const setCheckAnswers = usePreferencesStore((s) => s.setCheckAnswers);
  const mode = useGameStore((s) => s.mode);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        aria-expanded={open || showStats}
        aria-controls={open || showStats ? id : undefined}
        aria-haspopup="dialog"
        onClick={() => { setOpen(!open); setShowStats(false); }}
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
          id={id}
          role="dialog"
          aria-label="Settings"
          data-game-popup
          tabIndex={-1}
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

          {/* Check Answers toggle */}
          <div className="mb-3">
            <label
              className="flex items-center gap-2 cursor-pointer text-sm font-medium"
              style={{ color: 'var(--color-btn-text)' }}
            >
              <input
                type="checkbox"
                checked={checkAnswers}
                onChange={(e) => setCheckAnswers(e.target.checked)}
                className="accent-current w-4 h-4"
              />
              Check Answers
            </label>
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

          {/* Tutorials */}
          <div className="mb-2">
            <button
              onClick={() => {
                useTutorialStore.getState().openList();
                setOpen(false);
              }}
              className="w-full px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors text-left"
              style={{
                color: 'var(--color-btn-text)',
                borderColor: 'var(--color-cell-border)',
                backgroundColor: 'var(--color-btn-bg)',
              }}
            >
              Tutorials
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
        <div id={id} role="dialog" aria-label="Statistics" data-game-popup tabIndex={-1} className="absolute right-0 top-full mt-12 z-40 w-[min(90vw,400px)]">
          <div
            className="rounded-lg border shadow-lg p-3"
            style={{
              backgroundColor: 'var(--color-card-bg, var(--color-bg))',
              borderColor: 'var(--color-cell-border)',
            }}
          >
            <button onClick={() => setShowStats(false)} aria-label="Close statistics">Close</button>
            {CLERK_KEY ? (
              <>
                <StatsPanel />
                <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-cell-border)' }}>
                  <Leaderboard date={utcDateString()} mode={mode} />
                </div>
              </>
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

function SignInPage() {
  const navigate = useNavigate();
  const { isSignedIn } = useClerkAuth();
  const theme = useThemeStore((s) => s.theme);

  // Redirect to home once signed in
  useEffect(() => {
    if (isSignedIn) {
      void navigate('/', { replace: true });
    }
  }, [isSignedIn, navigate]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-4"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <SignIn
        routing="virtual"
        signUpUrl="/sign-up"
        appearance={{ variables: { colorPrimary: theme === 'dark' ? '#60a5fa' : '#3b82f6' } }}
      />
      <button
        onClick={() => navigate('/')}
        className="mt-4 text-sm font-medium transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
      >
        &larr; Back to game
      </button>
    </div>
  );
}

function SignUpPage() {
  const navigate = useNavigate();
  const { isSignedIn } = useClerkAuth();
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    if (isSignedIn) {
      void navigate('/', { replace: true });
    }
  }, [isSignedIn, navigate]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-4"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <SignUp
        routing="virtual"
        signInUrl="/sign-in"
        appearance={{ variables: { colorPrimary: theme === 'dark' ? '#60a5fa' : '#3b82f6' } }}
      />
      <button
        onClick={() => navigate('/')}
        className="mt-4 text-sm font-medium transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
      >
        &larr; Back to game
      </button>
    </div>
  );
}

type PendingGame =
  | { kind: 'new'; difficulty: Difficulty; mode: GameMode }
  | { kind: 'daily'; mode: GameMode; date: string };

function GameScreen() {
  const newGame = useGameStore((s) => s.newGame);
  const startDaily = useGameStore((s) => s.startDaily);
  const retryGeneration = useGameStore((s) => s.retryGeneration);
  const dismissGenerationError = useGameStore((s) => s.dismissGenerationError);
  const puzzle = useGameStore((s) => s.puzzle);
  const status = useGameStore((s) => s.status);
  const difficulty = useGameStore((s) => s.difficulty);
  const mode = useGameStore((s) => s.mode);
  const historyIndex = useGameStore((s) => s.historyIndex);
  const grid = useGameStore((s) => s.grid);
  const generationStatus = useGameStore((s) => s.generationStatus);
  const generationError = useGameStore((s) => s.generationError);
  const pendingGameSettings = useGameStore((s) => s.pendingGameSettings);
  const completionSyncStatus = useGameStore((s) => s.completionSyncStatus);
  const completionSyncError = useGameStore((s) => s.completionSyncError);
  const retryCompletion = useGameStore((s) => s.retryCompletion);

  const hintStack = useHintStore((s) => s.stack);
  const completeHintPuzzle = useHintStore((s) => s.completeHintPuzzle);
  const hintTransition = useHintStore((s) => s.transition);
  const clearTransition = useHintStore((s) => s.clearTransition);
  const hintRevealCell = useHintStore((s) => s.hintRevealCell);
  const clearHintReveal = useHintStore((s) => s.clearHintReveal);
  const isInHintStack = hintStack.length > 0;

  const tutorialPhase = useTutorialStore((s) => s.phase);
  const activeTutorialId = useTutorialStore((s) => s.activeTutorialId);
  const completePractice = useTutorialStore((s) => s.completePractice);
  const abandonPractice = useTutorialStore((s) => s.abandonPractice);
  const isInTutorialPractice = tutorialPhase === 'practice';
  const activeTutorial = activeTutorialId ? getTutorialById(activeTutorialId) : null;

  const [pendingGame, setPendingGame] = useState<PendingGame | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  // Keyed by daily so a standing from a previous daily is never shared as this one's.
  const [dailyStanding, setDailyStanding] = useState<{ key: string; standing: LeaderboardStanding | null } | null>(null);
  const dailyKey = puzzle?.daily ? `${puzzle.daily.date}|${mode}` : null;
  const currentStanding = dailyKey && dailyStanding?.key === dailyKey ? dailyStanding.standing : null;
  const recordStanding = useCallback((standing: LeaderboardStanding | null) => {
    if (dailyKey) setDailyStanding({ key: dailyKey, standing });
  }, [dailyKey, setDailyStanding]);

  const tutorialFocusDone = !!(
    isInTutorialPractice &&
    activeTutorial &&
    grid.length > 0 &&
    activeTutorial.focusCells.every(({ row, col }) =>
      grid[row]?.[col]?.digit === activeTutorial.practicePuzzle.solution[row]?.[col]
    )
  );
  const reducedMotion = useReducedMotion();
  const boardAnim = hintTransition && !reducedMotion
    ? hintTransition === 'deeper' ? 'board-slide-left' : 'board-slide-right'
    : null;

  // Trigger board slide animation on hint transitions
  useEffect(() => {
    if (!hintTransition) return;
    const timer = setTimeout(clearTransition, 300);
    return () => clearTimeout(timer);
  }, [hintTransition, clearTransition]);

  // Clear hint reveal highlight after the animation completes
  useEffect(() => {
    if (!hintRevealCell) return;
    const timer = setTimeout(clearHintReveal, 2000);
    return () => clearTimeout(timer);
  }, [hintRevealCell, clearHintReveal]);

  useKeyboard(useCallback(() => setShowKeyboardHelp((v) => !v), [setShowKeyboardHelp]));

  // Auto-pause when tab/app is hidden, auto-resume when visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        useGameStore.getState().autoPause();
      } else {
        useGameStore.getState().autoResume();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const loadSavedGame = useGameStore((s) => s.loadSavedGame);
  const recoveryNotice = useGameStore((s) => s.recoveryNotice);
  const clearRecoveryNotice = useGameStore((s) => s.clearRecoveryNotice);

  // Start a game on first load — try restoring a saved game first
  useEffect(() => {
    if (!puzzle) {
      const restored = loadSavedGame();
      if (!restored) {
        newGame('easy');
      }
    }
  }, [puzzle, newGame, loadSavedGame]);

  const beginPendingGame = useCallback((pending: PendingGame) => {
    if (pending.kind === 'daily') startDaily(pending.mode, pending.date === utcDateString() ? undefined : pending.date);
    else newGame(pending.difficulty, pending.mode);
  }, [newGame, startDaily]);

  // Request a new game — confirm if the current game has progress
  const requestGame = useCallback((pending: PendingGame) => {
    const hasProgress = historyIndex >= 0 && status === 'playing';
    if (hasProgress || isInHintStack) {
      setPendingGame(pending);
    } else {
      beginPendingGame(pending);
    }
  }, [historyIndex, status, isInHintStack, beginPendingGame, setPendingGame]);

  const requestNewGame = useCallback((d: Difficulty, m: GameMode) => {
    requestGame({ kind: 'new', difficulty: d, mode: m });
  }, [requestGame]);

  const requestDaily = useCallback((m: GameMode, date: string) => {
    requestGame({ kind: 'daily', mode: m, date });
  }, [requestGame]);

  const confirmNewGame = useCallback(() => {
    if (pendingGame) {
      // Clear the hint stack when starting a fresh game
      useHintStore.setState({ stack: [] });
      beginPendingGame(pendingGame);
      setPendingGame(null);
    }
  }, [pendingGame, beginPendingGame, setPendingGame]);

  if (!puzzle) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
        <div className="text-center" role="status" aria-live="polite">
          {generationStatus === 'error' ? (
            <>
              <h1 className="text-xl font-bold mb-2">Couldn&apos;t create a puzzle</h1>
              <p className="mb-4" style={{ color: 'var(--color-text-muted)' }}>{generationError}</p>
              <button
                className="px-5 py-2.5 rounded-xl font-semibold"
                style={{ backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)' }}
                onClick={() => pendingGameSettings ? retryGeneration() : newGame('easy')}
              >
                Try Again
              </button>
            </>
          ) : <p className="font-semibold">{pendingGameSettings?.daily ? "Loading today's daily puzzle…" : 'Generating your puzzle…'}</p>}
        </div>
      </main>
    );
  }

  return (
    <main
      className="flex flex-col items-center min-h-screen px-2 sm:px-4 py-3 transition-colors duration-200"
      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
    >
      {/* Header */}
      <div className="w-full max-w-[min(98vw,500px)] mb-1">
        <div className="flex items-center justify-center sm:justify-between gap-2 flex-wrap">
          <h1 className="hidden sm:block text-lg font-bold whitespace-nowrap" style={{ color: 'var(--color-text)' }}>
            Infinite Sudoku
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-1.5 min-w-0 max-w-full [&>*]:shrink-0">
            <GameModePicker onRequestNewGame={requestNewGame} />
            {CLERK_KEY ? <DailyPickerWithProgress onRequestDaily={requestDaily} /> : <DailyPicker onRequestDaily={requestDaily} />}
            {CLERK_KEY && <UserButton />}
            <Timer />
            <GearMenu onShowShortcuts={() => setShowKeyboardHelp(true)} />
          </div>
        </div>
      </div>

      {/* Daily puzzle banner */}
      {puzzle.daily && !isInHintStack && !isInTutorialPractice && (
        <p className="w-full max-w-[min(98vw,500px)] mb-2 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          Daily puzzle &middot; {formatDailyDate(puzzle.daily.date)}
        </p>
      )}

      {/* Hint puzzle stack indicator */}
      <PuzzleStack />

      {/* Tutorial practice banner */}
      {isInTutorialPractice && activeTutorial && (
        <div className="w-full max-w-[min(90vw,500px)] mx-auto mb-3">
          <div
            className="rounded-xl px-4 py-3 border flex items-center justify-between"
            style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-cell-border)' }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Tutorial: {activeTutorial.name}
              <span className="block text-xs font-normal mt-1">Fill the double-outlined target cells.</span>
            </span>
            <button
              onClick={abandonPractice}
              className="text-xs font-medium px-2.5 py-1 rounded-md transition-colors"
              style={{ backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-text-muted)' }}
            >
              Quit
            </button>
          </div>
        </div>
      )}

      {/* Board */}
      <div className={`w-full max-w-[min(98vw,500px)]${boardAnim ? ` ${boardAnim}` : ''}`}>
        <Board />
      </div>

      {/* Controls */}
      <ControlBar onRequestNewGame={requestNewGame} />

      {/* Digit input */}
      <DigitBar />

      {generationStatus !== 'idle' && (
        <Modal
          key={generationStatus}
          onDismiss={generationStatus === 'error' ? dismissGenerationError : undefined}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-overlay-bg)' }}
          aria-label="Puzzle loading"
        >
          <div className="rounded-2xl p-6 shadow-xl text-center max-w-sm mx-4" style={{ backgroundColor: 'var(--color-card-bg)' }}>
            {generationStatus === 'loading' ? (
              <p className="font-semibold" role="status">{pendingGameSettings?.daily ? "Loading today's daily puzzle…" : 'Generating your puzzle…'}</p>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-2">Couldn&apos;t {pendingGameSettings?.daily ? 'load the daily' : 'create a'} puzzle</h2>
                <p className="mb-4" style={{ color: 'var(--color-text-muted)' }}>{generationError}</p>
                <button
                  className="px-5 py-2.5 rounded-xl font-semibold mr-2"
                  style={{ backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-btn-text)' }}
                  onClick={dismissGenerationError}
                >
                  Back to Puzzle
                </button>
                <button
                  className="px-5 py-2.5 rounded-xl font-semibold"
                  style={{ backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)' }}
                  onClick={retryGeneration}
                >
                  Try Again
                </button>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Confirm new game modal */}
      {pendingGame && (
        <ConfirmModal
          title={pendingGame.kind === 'daily'
            ? (pendingGame.date === utcDateString() ? "Start today's daily puzzle?" : `Start the daily for ${formatDailyDate(pendingGame.date)}?`)
            : 'Start new game?'}
          message={isInHintStack
            ? "You're in a hint puzzle. Starting a new game will discard all progress including parent puzzles."
            : "Your current progress will be lost."
          }
          confirmLabel={pendingGame.kind === 'daily' ? 'Play Daily' : 'New Game'}
          cancelLabel="Keep Playing"
          onConfirm={confirmNewGame}
          onCancel={() => setPendingGame(null)}
        />
      )}

      {/* Tutorial practice completion overlay */}
      {(tutorialFocusDone || status === 'completed') && isInTutorialPractice && (
        <>
        <Confetti />
        <Modal className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'var(--color-overlay-bg)' }} role="dialog" aria-modal="true" aria-label="Tutorial complete">
          <div className="rounded-2xl p-8 shadow-xl text-center max-w-sm mx-4" style={{ backgroundColor: 'var(--color-card-bg)' }}>
            <div className="text-4xl mb-3">&#127891;</div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
              Tutorial Complete!
            </h2>
            <p className="mb-6" style={{ color: 'var(--color-text-muted)' }}>
              Great work! You've mastered the {activeTutorial?.name} technique.
            </p>
            <button
              onClick={completePractice}
              className="px-6 py-3 rounded-xl font-semibold transition-colors"
              style={{ backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)' }}
            >
              Continue
            </button>
          </div>
        </Modal>
        </>
      )}

      {recoveryNotice && (
        <div className="fixed top-4 left-1/2 z-50 flex max-w-md -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-3 shadow-lg" style={{ backgroundColor: 'var(--color-card-bg)', color: 'var(--color-text)' }} role="status">
          <span>{recoveryNotice}</span>
          <button onClick={clearRecoveryNotice} aria-label="Dismiss recovery notice" className="font-bold">&times;</button>
        </div>
      )}

      {/* Completion overlay — different for hint puzzles vs regular */}
      {status === 'completed' && !isInTutorialPractice && isInHintStack && (
        <Modal className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'var(--color-overlay-bg)' }} role="dialog" aria-modal="true" aria-label="Hint earned">
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
              className="px-6 py-3 rounded-xl font-semibold transition-colors"
              style={{ backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)' }}
            >
              Claim Hint
            </button>
          </div>
        </Modal>
      )}

      {status === 'completed' && !isInTutorialPractice && !isInHintStack && (
        <>
        <Confetti />
        <Modal className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'var(--color-overlay-bg)' }} role="dialog" aria-modal="true" aria-label="Puzzle complete">
          <div className="rounded-2xl p-8 shadow-xl text-center max-w-sm mx-4" style={{ backgroundColor: 'var(--color-card-bg)' }}>
            <div className="text-4xl mb-3">&#127942;</div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
              {puzzle.daily ? 'Daily Complete!' : 'Puzzle Complete!'}
            </h2>
            <p className="mb-4" style={{ color: 'var(--color-text-muted)' }}>
              {puzzle.daily
                ? `You solved the ${difficulty} ${mode} daily for ${formatDailyDate(puzzle.daily.date)}.`
                : `Great job solving this ${difficulty} ${mode} puzzle!`}
            </p>
            <ScoreSummary />
            {puzzle.daily && CLERK_KEY && (
              <div className="mb-4">
                <Leaderboard date={puzzle.daily.date} mode={mode} refreshKey={completionSyncStatus} onStanding={recordStanding} />
              </div>
            )}
            {puzzle.daily && (
              <div className="mb-4">
                <ShareResultButton date={puzzle.daily.date} standing={currentStanding} />
              </div>
            )}
            <div className="mb-4 text-sm" aria-live="polite" style={{ color: 'var(--color-text-muted)' }}>
              {completionSyncStatus === 'syncing' && <p>Syncing stats…</p>}
              {completionSyncStatus === 'synced' && <p>Stats synced.</p>}
              {completionSyncStatus === 'pending' && (
                <div>
                  <p>{completionSyncError}</p>
                  <button onClick={retryCompletion} className="mt-2 underline font-semibold">Retry stats sync</button>
                </div>
              )}
            </div>
            <button
              onClick={() => newGame(difficulty, mode)}
              className="px-6 py-3 rounded-xl font-semibold transition-colors"
              style={{ backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)' }}
            >
              New Game
            </button>
          </div>
        </Modal>
        </>
      )}

      {/* Paused overlay */}
      {status === 'paused' && (
        <Modal onDismiss={() => useGameStore.getState().resumeGame()}
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'var(--color-overlay-bg)' }}
          role="dialog" aria-modal="true" aria-label="Game paused"
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
        </Modal>
      )}

      {/* Keyboard help overlay */}
      {showKeyboardHelp && <KeyboardHelp onClose={() => setShowKeyboardHelp(false)} />}

      {/* Onboarding for first-time players */}
      <Onboarding />

      {/* Tutorial overlays */}
      <TutorialList />
      <TutorialLesson />

      {/* Footer */}
      <footer className="mt-4 mb-2 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <p>Made with &#10084;&#65039; by jkup</p>
        <p className="mt-1 hidden sm:block">
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
    </main>
  );
}

/** Bridges Clerk's useAuth into the non-React api module */
function AuthTokenBridge() {
  const { getToken } = useClerkAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    useGameStore.getState().retryCompletion();
  }, [getToken]);
  return null;
}

export default function App() {
  const router = (
    <>
      <PwaLifecycle />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<GameScreen />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />
        </Routes>
      </BrowserRouter>
    </>
  );

  // Graceful fallback: if no Clerk key, render without auth
  if (!CLERK_KEY) {
    return router;
  }

  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      <AuthTokenBridge />
      {router}
    </ClerkProvider>
  );
}
