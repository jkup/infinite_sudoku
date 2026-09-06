# Accessibility behavior and verification

## Keyboard interaction

The Sudoku board has one Tab entry point. Arrow keys move between cells;
Home/End move within a row, and Ctrl+Home/End move to the first/last cell.
Digits, notes, erase, undo/redo, hints, and pause work while playing on the board.
Native controls keep their keyboard behavior: Space activates buttons, and arrow
keys operate the theme selector.

Settings and game settings are non-modal dialog popups containing native controls.
Enter or Space opens them and focuses the first control. Tab/Shift+Tab navigates;
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
Reduced motion and additional non-color status cues are tracked by A11Y-003.
