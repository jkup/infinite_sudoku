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

describe('plain shortcuts', () => {
  beforeEach(() => {
    const tutorial = TUTORIALS[0];
    useGameStore.setState({
      grid: gridFromValues(tutorial.practicePuzzle.initial, true), puzzle: tutorial.practicePuzzle,
      selectedCell: { row: 0, col: 0 }, conflicts: new Map(), inputMode: 'digit', status: 'playing', history: [], historyIndex: -1,
      difficulty: 'easy',
    });
    useTutorialStore.setState({ phase: 'idle', activeTutorialId: null });
    useHintStore.setState({ hintRevealCell: null, stack: [], transition: null });
  });

  it('erases with Backspace and Delete', () => {
    render(<Game />);
    act(() => { useGameStore.getState().placeDigit(1); });
    expect(press(window, { key: 'Backspace' })).toBe(false);
    expect(useGameStore.getState().grid[0][0].digit).toBeNull();
    act(() => { useGameStore.getState().placeDigit(1); });
    expect(press(window, { key: 'Delete' })).toBe(false);
    expect(useGameStore.getState().grid[0][0].digit).toBeNull();
  });

  it('cycles note modes with N and enters a corner note with Shift+digit without changing mode', () => {
    render(<Game />);
    press(window, { key: 'n' });
    expect(useGameStore.getState().inputMode).toBe('corner');
    press(window, { key: 'N' });
    expect(useGameStore.getState().inputMode).toBe('center');
    press(window, { key: 'n' });
    expect(useGameStore.getState().inputMode).toBe('digit');

    expect(press(window, { key: '3', shiftKey: true })).toBe(false);
    expect(useGameStore.getState().grid[0][0].cornerNotes.has(3)).toBe(true);
    expect(useGameStore.getState().inputMode).toBe('digit');
  });

  it('pauses and resumes with Space, deselects with Escape, and opens help with ?', () => {
    const onToggleHelp = vi.fn();
    function WithHelp() { useKeyboard(onToggleHelp); return <Board />; }
    render(<WithHelp />);
    expect(press(window, { key: ' ' })).toBe(false);
    expect(useGameStore.getState().status).toBe('paused');
    expect(press(window, { key: ' ' })).toBe(false);
    expect(useGameStore.getState().status).toBe('playing');

    expect(press(window, { key: 'Escape' })).toBe(false);
    expect(useGameStore.getState().selectedCell).toBeNull();

    expect(press(window, { key: '?' })).toBe(false);
    expect(onToggleHelp).toHaveBeenCalledOnce();
  });

  it('requests a hint with H', () => {
    render(<Game />);
    const requestHint = vi.spyOn(useHintStore.getState(), 'requestHint');
    expect(press(window, { key: 'h' })).toBe(false);
    expect(requestHint).toHaveBeenCalledOnce();
    requestHint.mockRestore();
  });

  it('stays out of the way while typing in a form control or a dialog is open', () => {
    render(<><Game /><input aria-label="Name" /></>);
    const input = screen.getByRole('textbox', { name: 'Name' });
    input.focus();
    expect(press(input, { key: '1' })).toBe(true);
    expect(useGameStore.getState().grid[0][0].digit).toBeNull();

    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.append(dialog);
    expect(press(window, { key: '1' })).toBe(true);
    expect(useGameStore.getState().grid[0][0].digit).toBeNull();
    dialog.remove();
  });
});
