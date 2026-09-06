import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const stylesheet = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

// Test the actual shipped theme tokens, including the small notes and mobile
// digits: use the normal-text threshold rather than assuming large text.
const themes = [...stylesheet.matchAll(/(:root|\[data-theme="[^"]+"\])\s*\{([^}]+)\}/g)];
function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high + 0.05) / (low + 0.05);
}
const boardBackgrounds = ['cell-bg', 'cell-selected', 'cell-highlighted', 'cell-given', 'cell-digit-match', 'cell-conflict', 'tutorial-primary', 'tutorial-secondary', 'tutorial-target'];
const textPairs: [string, string[]][] = [
  ['text', ['bg', 'bg-secondary', 'card-bg', ...boardBackgrounds]],
  ['text-muted', ['bg', 'bg-secondary', 'card-bg', 'btn-bg']],
  ['btn-text', ['btn-bg', 'btn-hover']],
  ['btn-active-text', ['btn-active-bg']],
  ['digit-given', boardBackgrounds],
  ['digit-placed', boardBackgrounds.filter((bg) => bg !== 'cell-conflict')],
  ['digit-error', ['cell-selected', 'cell-conflict']],
  ['note', boardBackgrounds],
];

describe('theme contrast (WCAG 2.2)', () => {
  it('covers all four shipped themes', () => expect(themes).toHaveLength(4));
  for (const [, theme, body] of themes) {
    const tokens = Object.fromEntries([...body.matchAll(/--color-([\w-]+):\s*(#[\da-fA-F]{6})/g)].map((match) => [match[1], match[2]]));
    it(`${theme} provides 4.5:1 for text in each applicable state`, () => {
      for (const [foreground, backgrounds] of textPairs) {
        for (const background of backgrounds) {
          expect(tokens[foreground], foreground).toBeDefined();
          expect(tokens[background], background).toBeDefined();
          expect(contrast(tokens[foreground], tokens[background]), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
    it(`${theme} provides 3:1 for board boundaries and state/focus outlines`, () => {
      for (const foreground of ['board-border', 'cell-border', 'cage-border', 'text']) {
        for (const background of boardBackgrounds) {
          expect(contrast(tokens[foreground], tokens[background]), `${foreground} on ${background}`).toBeGreaterThanOrEqual(3);
        }
      }
    });
  }
});
