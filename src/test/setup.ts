import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// jsdom does not implement the native dialog lifecycle or top layer.
// Browser verification covers native inertness; component tests cover our handlers.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
    this.querySelector<HTMLElement>('button:not(:disabled), select, input')?.focus();
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
}
