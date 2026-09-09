import { useId, useLayoutEffect, useRef } from 'react';

/** Minimum gap kept between a popup panel and the viewport edges. */
const VIEWPORT_MARGIN = 8;

/**
 * Shift a panel so it stays inside the viewport. Its trigger can sit anywhere
 * in a wrapped header, so on narrow phones an anchored panel would otherwise
 * run off an edge. The left edge wins when both overflow. Uses `translate` so
 * it works for left- and right-anchored panels without touching their layout.
 */
export function clampPanelToViewport(panel: HTMLElement, viewportWidth = window.innerWidth) {
  panel.style.translate = '';
  const rect = panel.getBoundingClientRect();
  let shift = Math.min(0, viewportWidth - VIEWPORT_MARGIN - rect.right);
  if (rect.left + shift < VIEWPORT_MARGIN) shift = VIEWPORT_MARGIN - rect.left;
  if (shift !== 0) panel.style.translate = `${shift}px`;
}

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
    const clamp = () => clampPanelToViewport(panel);
    clamp();
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
    window.addEventListener('resize', clamp);
    return () => {
      root.removeEventListener('keydown', key);
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('focusin', focus);
      window.removeEventListener('resize', clamp);
      // Restore before a replacement modal captures its return destination.
      if (panel.contains(document.activeElement) || document.activeElement === document.body) trigger.focus();
    };
  }, [open, initialFocus]);

  return { ref, triggerRef, id };
}
