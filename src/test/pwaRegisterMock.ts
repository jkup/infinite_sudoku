import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void> {
  void options;
  return () => Promise.resolve();
}
