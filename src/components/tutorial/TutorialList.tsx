import { useTutorialStore } from '../../store/tutorialStore';
import { TUTORIALS } from '../../data/tutorials';

const ENABLED_TUTORIALS = new Set(['naked-single', 'hidden-single', 'pointing-pair']);

const LEVEL_GROUPS = [
  { label: 'Beginner', level: 1 },
  { label: 'Easy', level: 2 },
  { label: 'Medium', level: 3 },
  { label: 'Hard', level: 4 },
  { label: 'Expert', level: 5 },
];

export default function TutorialList() {
  const phase = useTutorialStore((s) => s.phase);
  const completedTutorials = useTutorialStore((s) => s.completedTutorials);
  const startLesson = useTutorialStore((s) => s.startLesson);
  const close = useTutorialStore((s) => s.close);

  if (phase !== 'list') return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'var(--color-overlay-bg)' }}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Tutorials"
    >
      <div
        className="rounded-2xl p-6 shadow-xl max-w-sm mx-4 w-full max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--color-card-bg, var(--color-bg))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
            Tutorials
          </h2>
          <button
            onClick={close}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-lg leading-none"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Learn the solving techniques used in Sudoku, from beginner to expert.
        </p>

        <div className="space-y-4">
          {LEVEL_GROUPS.map((group) => {
            const groupTutorials = TUTORIALS.filter((t) => t.level === group.level);
            if (groupTutorials.length === 0) return null;

            return (
              <div key={group.level}>
                <div
                  className="text-xs font-semibold uppercase tracking-wide mb-1.5"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {group.label}
                </div>
                <div className="space-y-1">
                  {groupTutorials.map((tutorial) => {
                    const isCompleted = completedTutorials.has(tutorial.id);
                    const isComingSoon = !ENABLED_TUTORIALS.has(tutorial.id);
                    return (
                      <button
                        key={tutorial.id}
                        onClick={() => !isComingSoon && startLesson(tutorial.id)}
                        disabled={isComingSoon}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left"
                        style={{
                          backgroundColor: 'var(--color-btn-bg)',
                          borderColor: 'var(--color-cell-border)',
                          color: isComingSoon ? 'var(--color-text-muted)' : 'var(--color-text)',
                          opacity: isComingSoon ? 0.6 : 1,
                          cursor: isComingSoon ? 'default' : 'pointer',
                        }}
                      >
                        <span className="text-sm font-medium flex-1">{tutorial.name}</span>
                        {isComingSoon && (
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            Coming Soon
                          </span>
                        )}
                        {isCompleted && !isComingSoon && (
                          <span
                            className="text-base leading-none"
                            style={{ color: 'var(--color-btn-active-bg)' }}
                            aria-label="Completed"
                          >
                            &#10003;
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
