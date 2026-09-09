# Accessibility behavior and verification

## Keyboard interaction

The Sudoku board has one Tab entry point. Arrow keys move between cells;
Home/End move within a row, and Ctrl+Home/End move to the first/last cell.
Digits, notes, erase, undo/redo, hints, and pause work while playing on the board.
Native controls keep their keyboard behavior: Space activates buttons, and arrow
keys operate the theme selector.

Settings and game settings are non-modal dialog popups containing native controls.
Enter or Space opens them. Settings focuses its panel so opening it on mobile
does not activate the native theme picker; Tab reaches the theme selector. Game
settings focuses its first control. Tab/Shift+Tab navigates;
Escape closes and returns to the trigger. Moving focus outside closes the popup
without pulling focus back. The triggers expose expanded state and popup identity.
Mode and difficulty choices expose their selected state with `aria-pressed`.

Onboarding, confirmation, shortcuts, tutorials, pause, completion, and hint help
use the shared native `Modal` component. The browser makes background content
inert; Tab stays inside the dialog. The heading labels the dialog, and the first
paragraph supplies its description when present. Initial focus goes to the first
enabled control (the safe cancel action in confirmations). Closing restores the
original trigger when it still exists, including transitions from a popup to a
modal. Pause and resume retain the same trigger element.

Escape dismisses onboarding/help, cancels confirmation, resumes a paused game,
and returns from a tutorial lesson to the list. Completion dialogs require their
visible action (New Game, Claim Hint, or Continue). Game shortcuts are suspended
while a modal or popup is open. Long dialog cards scroll within the viewport.

## A11Y-002 verification — 2026-09-06

- Component regression tests cover accessible names/descriptions, initial focus,
  forward/reverse Tab wrapping, native cancel handling, required completion
  actions, shortcut isolation, native Space activation, popup Tab exit, and focus
  restoration through confirmation, pause, and tutorial transitions.
- jsdom supplies only a dialog lifecycle stub. Real Chrome checks verify native
  modality, focus containment, Escape handling, popup-to-modal transitions,
  pause/resume, hint help, tutorials, and statistics.
- Chrome layout/focus checks covered desktop and 375px mobile width, including
  light, dark, and high-contrast dialogs and scrollable tutorial content.
- The repository owner verified VoiceOver in Chrome announces “Keyboard
  Shortcuts, dialog, Close, button”; browser inspection independently confirmed
  Escape restores focus to Settings. This is a targeted screen-reader check,
  not a comprehensive assistive-technology audit.

For future overlay changes, repeat those interactions with keyboard and
VoiceOver/Chrome, check narrow layouts and each theme, and run `npm run check`.

## Motion and non-color cues

The app follows `prefers-reduced-motion` and responds when that preference changes
without reloading. Reduced motion removes board slides, hint pulses, CSS
transitions, and confetti. Revealed hints retain a static outline for two seconds;
completion text and actions remain available. Changing the preference back does
not replay an expired celebration.

Color is supplemented by persistent visual cues:

- Selected cells have an inset outline, in addition to the keyboard focus ring.
- Conflicting digits have a wavy underline and an accessible invalid state.
- Selected input modes and game-setting choices have underlined labels and
  `aria-pressed` state.
- Fully placed digits have visible checkmarks and disabled, “all placed” labels.
- Tutorial targets have double outlines; primary and secondary clues use solid
  and dashed outlines. The lesson includes a legend and cell descriptions.
  Practice targets remain marked after an incorrect entry, until solved.
- Onboarding shows a textual step count alongside its decorative progress dots.

## Contrast policy and A11Y-003 verification — 2026-09-06

Theme tests use the WCAG relative-luminance formula and require at least **4.5:1**
for text, including small notes and mobile digits, and **3:1** for cell/box/cage
boundaries and state/focus outlines against applicable board backgrounds. These
thresholds follow [WCAG 2.2](https://www.w3.org/TR/WCAG22/#contrast-minimum) and
[non-text contrast guidance](https://www.w3.org/WAI/WCAG21/understanding/non-text-contrast.html).

`tests/themeContrast.test.ts` reads the actual stylesheet tokens for light, dark,
newspaper, and high-contrast themes. It checks normal, selected, conflict,
matching-digit, and tutorial backgrounds as applicable. The Node TypeScript
project includes this filesystem-based test. Token checks do not establish whole
page WCAG conformance or assess third-party Clerk UI and browser-native widgets.

Automated component checks cover reduced motion on initial render, live
preference changes, listener cleanup, expired celebrations, completed-digit
checkmarks, mode switching, and tutorial target descriptions. CSS disables all
animations/transitions under the reduced-motion media query, while the React
preference subscription also suppresses board-slide classes and confetti.

Chrome visual checks covered conflicts, selected modes/cells, notes and tutorial
outlines at desktop and 375px mobile width across the four themes. High-contrast
keyboard focus remained visible, and the tested mobile views had no horizontal
overflow. The automated motion checks use a mocked `matchMedia`; they do not
constitute a manual macOS preference-toggle test.

For a manual motion smoke check, enable macOS Accessibility → Display → Reduce
motion, reveal an empty Easy cell, and verify the answer has a static outline.
Enter/leave a nested hint puzzle and verify there is no slide; completion should
show its summary without confetti. Toggle the preference during an open session
to check that it applies without reloading.

## Mobile audit fixes — 2026-09-08

Failed replacement puzzle loads use a named modal with Retry and Back to Puzzle.
Back to Puzzle receives initial focus; Escape also returns to the retained board.
The board, notes and history survive, and its timer excludes loading/error time.
Loading uses a non-dismissible modal to prevent background input. Regression
tests cover repeated retry, both dismissal paths, notes, resumed play, and timer
recovery. This addresses the mobile audit's Daily error trap; the wider UI-001
loading/empty-state work remains open.
Chrome verification at 375×667 confirmed the error card fits, Back to Puzzle
is initially focused, and both it and native Escape restore the retained board.
`npm run check` passed with 257 unit tests and 38 Workers integration tests.

## Mobile audit fixes — 2026-09-09

Header controls wrap instead of overflowing 320px viewports. Popup panels from
`usePopup` (game settings, daily list, settings, statistics) are clamped inside
the viewport with an 8px margin after opening and on resize, so a panel under a
mid-header trigger no longer runs off the right edge at 320–375px. Hook tests
cover fitting, right-edge overflow, left-edge priority, resize, and cleanup.
