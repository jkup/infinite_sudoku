import { useTutorialStore, getTutorialById } from '../../store/tutorialStore';
import TutorialBoard from './TutorialBoard';

export default function TutorialLesson() {
  const phase = useTutorialStore((s) => s.phase);
  const activeTutorialId = useTutorialStore((s) => s.activeTutorialId);
  const startPractice = useTutorialStore((s) => s.startPractice);
  const openList = useTutorialStore((s) => s.openList);

  if (phase !== 'lesson' || !activeTutorialId) return null;

  const tutorial = getTutorialById(activeTutorialId);
  if (!tutorial) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'var(--color-overlay-bg)' }}
      role="dialog"
      aria-modal="true"
      aria-label={`Tutorial: ${tutorial.name}`}
    >
      <div
        className="rounded-2xl p-6 shadow-xl max-w-md mx-4 w-full max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--color-card-bg, var(--color-bg))' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <span
            className="px-2 py-0.5 rounded text-xs font-semibold"
            style={{ backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-text-muted)' }}
          >
            {tutorial.difficulty}
          </span>
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
            {tutorial.name}
          </h2>
        </div>

        {/* Lesson board */}
        <div className="mb-4">
          <TutorialBoard
            board={tutorial.lessonBoard}
            highlightCells={tutorial.highlightCells}
            highlightNotes={tutorial.highlightNotes}
          />
        </div>

        {/* Explanation */}
        <div className="space-y-3 mb-6">
          {tutorial.explanation.map((para, i) => (
            <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
              {para}
            </p>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => openList()}
            className="flex-1 px-4 py-2.5 rounded-xl font-medium text-sm border transition-colors"
            style={{
              color: 'var(--color-btn-text)',
              borderColor: 'var(--color-cell-border)',
              backgroundColor: 'var(--color-btn-bg)',
            }}
          >
            Back
          </button>
          <button
            onClick={startPractice}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
            style={{ backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)' }}
          >
            Try It
          </button>
        </div>
      </div>
    </div>
  );
}
