// @vitest-environment jsdom
/// <reference lib="dom" />
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Global stylesheet regressions. Tailwind 4's preflight removed the pointer
 * cursor from buttons, so src/index.css restores it; these tests apply the
 * plain CSS rules in jsdom and read back computed styles. The file is read
 * from disk because Vitest's CSS pipeline returns an empty module for `?raw`.
 */
function loadPlainRules(): string {
  const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
  // jsdom cannot resolve Tailwind's @import or understand @theme; drop them.
  return css.replace(/^@import[^\n]*\n/m, '').replace(/@theme\s*\{[^}]*\}/s, '');
}

function mount(html: string): void {
  const style = document.createElement('style');
  style.textContent = loadPlainRules();
  document.head.append(style);
  document.body.innerHTML = html;
}

afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });

describe('button affordances', () => {
  it('gives enabled buttons a pointer cursor and leaves disabled ones alone', () => {
    mount('<button id="go">Update now</button><button id="off" disabled>Later</button>');
    expect(getComputedStyle(document.getElementById('go')!).cursor).toBe('pointer');
    expect(getComputedStyle(document.getElementById('off')!).cursor).not.toBe('pointer');
  });

  it('lets a component override the cursor for a non-interactive state', () => {
    mount('<button id="soft" style="cursor: default">Digit</button>');
    expect(getComputedStyle(document.getElementById('soft')!).cursor).toBe('default');
  });
});
