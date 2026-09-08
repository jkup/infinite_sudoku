import { useId, useLayoutEffect, useRef } from 'react';

/** A non-modal dialog for mixed native controls, navigated with Tab. */
export function usePopup(open: boolean | string, onClose: () => void, initialFocus: 'control' | 'panel' = 'control') {
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; });

  useLayoutEffect(() => {
    if (!open) return;
    const root = ref.current!;
    const trigger = triggerRef.current!;
    const panel = root.querySelector<HTMLElement>('[data-game-popup]')!;
    // Focusing a native select during a touch gesture can open the OS picker.
    const target = initialFocus === 'panel' ? panel : panel.querySelector<HTMLElement>('button, select, input');
    (target ?? panel).focus();
    const outside = (event: MouseEvent) => {
      if (!root.contains(event.target as Node)) closeRef.current();
    };
    const focus = (event: FocusEvent) => {
      if (!root.contains(event.target as Node)) closeRef.current();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        trigger.focus();
      }
    };
    root.addEventListener('keydown', key);
    document.addEventListener('mousedown', outside);
    document.addEventListener('focusin', focus);
    return () => {
      root.removeEventListener('keydown', key);
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('focusin', focus);
      // Restore before a replacement modal captures its return destination.
      if (panel.contains(document.activeElement) || document.activeElement === document.body) trigger.focus();
    };
  }, [open, initialFocus]);

  return { ref, triggerRef, id };
}
