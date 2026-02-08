import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useHintStore } from '../store/hintStore';
import type { Digit } from '../engine/types';

export function useKeyboard() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const state = useGameStore.getState();

      // Don't handle if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Digits 1-9
      if (e.key >= '1' && e.key <= '9') {
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

      // Arrow keys — navigate cells
      if (e.key.startsWith('Arrow') && state.selectedCell) {
        e.preventDefault();
        const { row, col } = state.selectedCell;
        let newRow = row;
        let newCol = col;

        switch (e.key) {
          case 'ArrowUp':    newRow = Math.max(0, row - 1); break;
          case 'ArrowDown':  newRow = Math.min(8, row + 1); break;
          case 'ArrowLeft':  newCol = Math.max(0, col - 1); break;
          case 'ArrowRight': newCol = Math.min(8, col + 1); break;
        }

        state.selectCell({ row: newRow, col: newCol });
        return;
      }

      // Backspace / Delete — erase
      if (e.key === 'Backspace' || e.key === 'Delete') {
        state.eraseCell();
        e.preventDefault();
        return;
      }

      // N — toggle note mode
      if (e.key === 'n' || e.key === 'N') {
        const next = state.inputMode === 'digit' ? 'corner' :
                     state.inputMode === 'corner' ? 'center' : 'digit';
        state.setInputMode(next);
        e.preventDefault();
        return;
      }

      // Ctrl/Cmd+Z — undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        state.undo();
        e.preventDefault();
        return;
      }

      // Ctrl/Cmd+Shift+Z — redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        state.redo();
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
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
