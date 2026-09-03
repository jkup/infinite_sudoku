import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { useGameStore } from '../../store/gameStore';

export default function PwaLifecycle() {
  const [updateReady, setUpdateReady] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const retryCompletion = useGameStore((state) => state.retryCompletion);
  const updateServiceWorker = useRef<(reloadPage?: boolean) => Promise<void>>(async () => undefined);

  useEffect(() => {
    updateServiceWorker.current = registerSW({
      onNeedRefresh: () => setUpdateReady(true),
      onOfflineReady: () => setOfflineReady(true),
    });
    const retry = () => retryCompletion();
    window.addEventListener('online', retry);
    if (navigator.onLine) retry();
    return () => window.removeEventListener('online', retry);
  }, [retryCompletion]);

  if (!updateReady && !offlineReady) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[60] w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl p-4 shadow-xl" style={{ backgroundColor: 'var(--color-card-bg)', color: 'var(--color-text)' }} role="status" aria-live="polite">
      {updateReady ? (
        <>
          <p className="font-semibold">An update is ready.</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>Your puzzle is saved. Update when you are ready to reload.</p>
          <div className="mt-3 flex justify-end gap-3">
            <button className="underline" onClick={() => setUpdateReady(false)}>Later</button>
            <button className="rounded-lg px-3 py-2 font-semibold" style={{ backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)' }} onClick={() => void updateServiceWorker.current(true)}>Update now</button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p>Ready to play offline.</p>
          <button aria-label="Dismiss offline-ready notice" onClick={() => setOfflineReady(false)}>&times;</button>
        </div>
      )}
    </div>
  );
}
