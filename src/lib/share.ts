export type ShareOutcome = 'shared' | 'copied' | 'failed';

/**
 * Hand text to the platform share sheet when the browser offers one, else copy
 * it to the clipboard. A user cancelling the share sheet counts as failed so
 * the UI does not claim success; callers should say nothing loud in that case.
 */
export async function shareText(text: string, title?: string): Promise<ShareOutcome> {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  if (nav?.share && (!nav.canShare || nav.canShare({ text }))) {
    try {
      await nav.share(title ? { text, title } : { text });
      return 'shared';
    } catch {
      // Cancelled or unsupported payload: fall through to the clipboard.
    }
  }
  try {
    await nav?.clipboard?.writeText(text);
    return nav?.clipboard ? 'copied' : 'failed';
  } catch {
    return 'failed';
  }
}
