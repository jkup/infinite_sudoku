// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Timer from './Timer';
import { useGameStore } from '../../store/gameStore';

describe('Timer', () => {
  const pauseGame = vi.fn();
  const resumeGame = vi.fn();

  beforeEach(() => {
    pauseGame.mockClear();
    resumeGame.mockClear();
    useGameStore.setState({ status: 'playing', elapsedMs: 65_000, pauseGame, resumeGame });
  });

  it('shows the elapsed time and pauses from a finger-sized control', async () => {
    render(<Timer />);
    expect(screen.getByText('1:05')).toBeInTheDocument();
    const pause = screen.getByRole('button', { name: 'Pause game' });
    // The audit measured the bare glyph at about 9x20px; keep the 44px minimum.
    expect(pause).toHaveClass('min-w-11', 'min-h-11');
    await userEvent.setup().click(pause);
    expect(pauseGame).toHaveBeenCalledOnce();
  });

  it('resumes when paused and hides the control once the game is over', async () => {
    useGameStore.setState({ status: 'paused' });
    const { rerender } = render(<Timer />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Resume game' }));
    expect(resumeGame).toHaveBeenCalledOnce();

    useGameStore.setState({ status: 'completed' });
    rerender(<Timer />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
