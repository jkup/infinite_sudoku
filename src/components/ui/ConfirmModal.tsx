type ConfirmModalProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'var(--color-overlay-bg)' }}
      onClick={onCancel}
      role="dialog" aria-modal="true" aria-label={title}
    >
      <div
        className="rounded-2xl p-6 shadow-xl max-w-sm mx-4 text-center"
        style={{ backgroundColor: 'var(--color-card-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>{title}</h2>
        <p className="text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}>{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl font-medium transition-colors"
            style={{ backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-btn-text)' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl font-medium transition-colors"
            style={{ backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
