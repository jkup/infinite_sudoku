import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useHintStore } from '../store/hintStore';
import type { Digit } from '../engine/types';

export function useKeyboard(onToggleHelp?: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || document.querySelector('dialog[open], [data-game-popup]')) return;
      if (e.target instanceof Element && e.target.closest('button, select, input, textarea, a, [contenteditable="true"], [role="dialog"]')) return;
      const state = useGameStore.getState();
      // Cmd/Ctrl/Alt chords belong to the browser and OS (Cmd+1 switches tabs,
      // Cmd+Left goes back). Only the explicit undo/redo chords below use them.
      const chord = e.ctrlKey || e.metaKey || e.altKey;

      // Ctrl/Cmd+Z — undo; Ctrl/Cmd+Shift+Z — redo (key reports as 'Z' with Shift held)
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) state.redo(); else state.undo();
        e.preventDefault();
        return;
      }
      if (chord) return;

      // Digits 1-9 (or 1-6 for mini grids)
      const gridSize = state.grid.length || 9;
      if (e.key >= '1' && e.key <= '9' && parseInt(e.key) <= gridSize) {
        const digit = parseInt(e.key) as Digit;

        if (e.shiftKey) {
          // Shift+digit = corner note
          const prevMode = state.inputMode;
          state.setInputMode('corner');
          state.placeDigit(digit);
          state.setInputMode(prevMode);
        } else {
          state.placeDigit(digit);
        }
        e.preventDefault();
        return;
      }

      // Backspace / Delete — erase
      if (e.key === 'Backspace' || e.key === 'Delete') {
        state.eraseCell();
        e.preventDefault();
        return;
      }

      // N — cycle note modes (digit → corner → center → digit)
      if (e.key === 'n' || e.key === 'N') {
        const next = state.inputMode === 'digit' ? 'corner' :
                     state.inputMode === 'corner' ? 'center' : 'digit';
        state.setInputMode(next);
        e.preventDefault();
        return;
      }

      // C — toggle color mode; digits then paint (1–8) or clear (9)
      if (e.key === 'c' || e.key === 'C') {
        state.setInputMode(state.inputMode === 'color' ? 'digit' : 'color');
        e.preventDefault();
        return;
      }

      // Space — pause/resume
      if (e.key === ' ') {
        if (state.status === 'playing') state.pauseGame();
        else if (state.status === 'paused') state.resumeGame();
        e.preventDefault();
        return;
      }

      // H — request hint
      if (e.key === 'h' || e.key === 'H') {
        useHintStore.getState().requestHint();
        e.preventDefault();
        return;
      }

      // Escape — deselect
      if (e.key === 'Escape') {
        state.selectCell(null);
        e.preventDefault();
        return;
      }

      // ? — toggle keyboard help
      if (e.key === '?' && onToggleHelp) {
        onToggleHelp();
        e.preventDefault();
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleHelp]);
}
