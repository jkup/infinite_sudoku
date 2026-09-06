// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmModal from './ConfirmModal';
import Modal from './Modal';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useGameStore } from '../../store/gameStore';
import GameModePicker from '../controls/GameModePicker';
import Timer from '../controls/Timer';
import TutorialList from '../tutorial/TutorialList';
import TutorialLesson from '../tutorial/TutorialLesson';
import { useTutorialStore } from '../../store/tutorialStore';

function Confirmation() {
  const [open, setOpen] = useState(false);
  useKeyboard();
  return <><button onClick={() => setOpen(true)}>Open</button>{open && <ConfirmModal title="Discard progress?" message="Your puzzle will be lost." onCancel={() => setOpen(false)} onConfirm={() => setOpen(false)} />}</>;
}

describe('modal interactions', () => {
  it('labels the dialog, focuses the safe action, wraps Tab both ways and restores the trigger', async () => {
    const user = userEvent.setup();
    render(<Confirmation />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Discard progress?' });
    expect(dialog).toHaveAccessibleDescription('Your puzzle will be lost.');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('blocks game shortcuts in a modal and preserves native Space button activation', async () => {
    const user = userEvent.setup();
    const place = vi.spyOn(useGameStore.getState(), 'placeDigit');
    const mode = useGameStore.getState().inputMode;
    render(<Confirmation />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.keyboard('1n h{Backspace}');
    expect(place).not.toHaveBeenCalled();
    expect(useGameStore.getState().inputMode).toBe(mode);
    // Space activates Cancel instead of pausing the game.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    place.mockRestore();
  });

  it('keeps mandatory completion dialogs open when native Escape requests dismissal', () => {
    render(<Modal aria-label="Complete"><button>Continue</button></Modal>);
    const dialog = screen.getByRole('dialog');
    const event = new Event('cancel', { cancelable: true });
    fireEvent(dialog, event);
    expect(event.defaultPrevented).toBe(true);
    expect(dialog).toHaveAttribute('open');
  });
});

describe('game settings popup', () => {
  it('supports keyboard entry, Escape, selection and focus restoration into a confirmation', async () => {
    const user = userEvent.setup();
    function Settings() {
      const [confirm, setConfirm] = useState(false);
      useKeyboard();
      return <><GameModePicker onRequestNewGame={() => setConfirm(true)} />{confirm && <ConfirmModal title="Change game?" message="Discard progress" onCancel={() => setConfirm(false)} onConfirm={() => setConfirm(false)} />}</>;
    }
    render(<Settings />);
    const trigger = screen.getByRole('button', { name: /Classic/ });
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Classic' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard(' ');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Killer' })).toHaveFocus();
    await user.keyboard('{Enter}');
    fireEvent(screen.getByRole('dialog', { name: 'Change game?' }), new Event('cancel', { cancelable: true }));
    expect(trigger).toHaveFocus();
  });

  it('closes when Tab leaves the popup without pulling focus back', async () => {
    const user = userEvent.setup();
    render(<><GameModePicker onRequestNewGame={() => {}} /><button>After</button></>);
    await user.click(screen.getByRole('button', { name: /Classic/ }));
    screen.getByRole('button', { name: 'Expert' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});


describe('overlay transitions', () => {
  it('returns to the pause control after resuming', async () => {
    const user = userEvent.setup();
    useGameStore.setState({ status: 'playing' });
    function Pause() {
      const status = useGameStore((state) => state.status);
      return <><Timer />{status === 'paused' && <Modal onDismiss={() => useGameStore.setState({ status: 'playing' })}><h2>Paused</h2><button onClick={() => useGameStore.setState({ status: 'playing' })}>Resume</button></Modal>}</>;
    }
    render(<Pause />);
    await user.click(screen.getByRole('button', { name: 'Pause game' }));
    expect(screen.getByRole('button', { name: 'Resume' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.getByRole('button', { name: 'Pause game' })).toHaveFocus();
  });

  it('keeps focus in replacement tutorial dialogs and returns to their original trigger', async () => {
    const user = userEvent.setup();
    useTutorialStore.setState({ phase: 'idle', activeTutorialId: null });
    render(<><button onClick={() => useTutorialStore.getState().openList()}>Learn</button><TutorialList /><TutorialLesson /></>);
    await user.click(screen.getByRole('button', { name: 'Learn' }));
    await user.click(screen.getByRole('button', { name: 'Naked Single' }));
    expect(screen.getByRole('button', { name: 'Back' })).toHaveFocus();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.getByRole('button', { name: 'Learn' })).toHaveFocus();
  });
});
