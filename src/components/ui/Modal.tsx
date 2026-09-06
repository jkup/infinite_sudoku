import { useId, useLayoutEffect, useRef, type ComponentPropsWithoutRef } from 'react';
import { createPortal } from 'react-dom';

type Props = Omit<ComponentPropsWithoutRef<'dialog'>, 'onCancel'> & {
  onDismiss?: () => void;
};

/** Native modality makes the rest of the page inert, including other overlays. */
export default function Modal({ children, onDismiss, className = '', ...props }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const heading = dialog.querySelector('h2, h3');
    if (heading) {
      heading.id ||= `${id}-title`;
      dialog.setAttribute('aria-labelledby', heading.id);
    }
    const description = dialog.querySelector('p');
    if (description) {
      description.id ||= `${id}-description`;
      dialog.setAttribute('aria-describedby', description.id);
    }
    dialog.showModal();
    dialog.querySelector<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled)')?.focus();
    return () => {
      dialog.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, [id]);

  return createPortal(
    <dialog
      {...props}
      ref={ref}
      className={`app-modal ${className}`}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onDismiss?.();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key !== 'Tab') return;
        const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        )).filter((element) => !element.closest('[hidden], [inert]'));
        const first = elements[0];
        const last = elements.at(-1);
        if (!first) {
          event.preventDefault();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      {children}
    </dialog>,
    document.body,
  );
}
