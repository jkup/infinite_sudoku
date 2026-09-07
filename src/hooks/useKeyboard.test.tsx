// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { gridFromValues } from '../engine/types';
import { useGameStore } from '../store/gameStore';
import { useTutorialStore } from '../store/tutorialStore';
import { useHintStore } from '../store/hintStore';
import { TUTORIALS } from '../data/tutorials';
import Board from '../components/board/Board';
import { useKeyboard } from './useKeyboard';

function Game() {
  useKeyboard();
  return <Board />;
}

/** fireEvent returns false when a handler called preventDefault, i.e. the app swallowed the key. */
const press = (target: Element | Window, init: KeyboardEventInit) => fireEvent.keyDown(target, init);

describe('keyboard shortcuts leave browser and OS chords alone', () => {
  beforeEach(() => {
    const tutorial = TUTORIALS[0];
    useGameStore.setState({
      grid: gridFromValues(tutorial.practicePuzzle.initial, true), puzzle: tutorial.practicePuzzle,
      selectedCell: { row: 0, col: 0 }, conflicts: new Map(), inputMode: 'digit', status: 'playing', history: [], historyIndex: -1,
    });
    useTutorialStore.setState({ phase: 'idle', activeTutorialId: null });
    useHintStore.setState({ hintRevealCell: null });
  });

  it('does not treat Cmd/Ctrl/Alt+digit as digit entry', () => {
    render(<Game />);
    const placeDigit = vi.spyOn(useGameStore.getState(), 'placeDigit');
    expect(press(window, { key: '1', metaKey: true })).toBe(true);
    expect(press(window, { key: '1', ctrlKey: true })).toBe(true);
    expect(press(window, { key: '1', altKey: true })).toBe(true);
    expect(placeDigit).not.toHaveBeenCalled();
    expect(useGameStore.getState().grid[0][0].digit).toBeNull();

    expect(press(window, { key: '1' })).toBe(false); // plain digit is ours
    expect(useGameStore.getState().grid[0][0].digit).toBe(1);
    placeDigit.mockRestore();
  });

  it('does not hijack Cmd+N, Cmd+C, Cmd+H, or Cmd+Space', () => {
    render(<Game />);
    for (const key of ['n', 'c', 'h', ' ']) expect(press(window, { key, metaKey: true })).toBe(true);
    expect(useGameStore.getState().inputMode).toBe('digit');
    expect(useGameStore.getState().status).toBe('playing');
  });

  it('still owns undo and redo, including the uppercase key Shift produces', () => {
    render(<Game />);
    act(() => { useGameStore.getState().placeDigit(1); });
    expect(useGameStore.getState().grid[0][0].digit).toBe(1);

    expect(press(window, { key: 'z', metaKey: true })).toBe(false);
    expect(useGameStore.getState().grid[0][0].digit).toBeNull();
    expect(press(window, { key: 'Z', metaKey: true, shiftKey: true })).toBe(false);
    expect(useGameStore.getState().grid[0][0].digit).toBe(1);
    expect(press(window, { key: 'z', ctrlKey: true })).toBe(false);
    expect(useGameStore.getState().grid[0][0].digit).toBeNull();
  });

  it('lets Cmd+Arrow reach the browser from a focused cell but keeps plain arrows and Ctrl+Home', () => {
    render(<Game />);
    const cell = screen.getByRole('gridcell', { name: /^Row 1, Column 1,/ });
    expect(press(cell, { key: 'ArrowLeft', metaKey: true })).toBe(true);
    expect(press(cell, { key: 'ArrowRight', altKey: true })).toBe(true);
    expect(useGameStore.getState().selectedCell).toEqual({ row: 0, col: 0 });

    expect(press(cell, { key: 'ArrowRight' })).toBe(false);
    expect(useGameStore.getState().selectedCell).toEqual({ row: 0, col: 1 });
    const moved = screen.getByRole('gridcell', { name: /^Row 1, Column 2,/ });
    expect(press(moved, { key: 'End', ctrlKey: true })).toBe(false);
    expect(useGameStore.getState().selectedCell).toEqual({ row: 8, col: 8 });
  });
});
