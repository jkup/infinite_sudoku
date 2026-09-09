// @vitest-environment jsdom
import { useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePopup } from './usePopup';

/** Where the panel would land before clamping, as a viewport rectangle. */
let naturalRect = { left: 0, right: 0 };

function Picker() {
  const [open, setOpen] = useState(false);
  const { ref, triggerRef, id } = usePopup(open, () => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button ref={triggerRef} aria-expanded={open} onClick={() => setOpen(!open)}>Open</button>
      {open && (
        <div id={id} role="dialog" aria-label="Panel" data-game-popup tabIndex={-1}>
          <button>Choice</button>
        </div>
      )}
    </div>
  );
}

const originalRect = HTMLElement.prototype.getBoundingClientRect;
function mockPanelRect() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (!this.hasAttribute('data-game-popup')) return originalRect.call(this);
    const { left, right } = naturalRect;
    return { left, right, x: left, y: 0, top: 0, bottom: 0, width: right - left, height: 0, toJSON: () => ({}) } as DOMRect;
  });
}

describe('usePopup viewport clamping', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('leaves a panel that fits where it is', async () => {
    window.innerWidth = 375;
    naturalRect = { left: 10, right: 300 };
    mockPanelRect();
    render(<Picker />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog').style.translate).toBe('');
  });

  it('shifts a panel left when it would run off the right edge', async () => {
    window.innerWidth = 375;
    naturalRect = { left: 120, right: 406 }; // 31px past the edge, as the audit measured
    mockPanelRect();
    render(<Picker />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog').style.translate).toBe('-39px'); // 375 - 8 - 406
  });

  it('never pushes a panel past the left edge to fit the right', async () => {
    window.innerWidth = 320;
    naturalRect = { left: 4, right: 400 };
    mockPanelRect();
    render(<Picker />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog').style.translate).toBe('4px'); // 8 - 4
  });

  it('re-clamps on resize and stops listening once closed', async () => {
    const user = userEvent.setup();
    window.innerWidth = 1024;
    naturalRect = { left: 500, right: 780 };
    mockPanelRect();
    render(<Picker />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const panel = screen.getByRole('dialog');
    expect(panel.style.translate).toBe('');

    act(() => { window.innerWidth = 600; window.dispatchEvent(new Event('resize')); });
    expect(panel.style.translate).toBe('-188px'); // 600 - 8 - 780

    const spy = HTMLElement.prototype.getBoundingClientRect as ReturnType<typeof vi.fn>;
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    spy.mockClear();
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(spy).not.toHaveBeenCalled();
  });
});
