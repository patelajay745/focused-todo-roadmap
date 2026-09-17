import {
  formatDuration,
  getDayView,
  getProgress,
  isComplete,
  markTask,
  totalSec,
  watchUrl,
  type DateKey,
  type Roadmap,
  type Task,
} from '@ftr/core';
import { ProgressRing } from '../../components/ProgressRing';

export function TodayCard({
  roadmap,
  today,
  onChange,
}: {
  roadmap: Roadmap;
  today: DateKey;
  onChange: (next: Roadmap) => void;
}) {
  const view = getDayView(roadmap, today);
  const progress = getProgress(roadmap, today);
  const remaining = view.tasks.filter((task) => !isComplete(task));
  const next = remaining[0];

  function toggle(task: Task) {
    onChange(
      markTask(roadmap, task.id, { status: isComplete(task) ? 'todo' : 'done' }),
    );
  }

  return (
    <section className="rounded-2xl border border-white/8 bg-surface-raised p-5">
      <header className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">{roadmap.title}</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Day {progress.dayIndex} of {progress.totalDays}
            {remaining.length > 0 ? (
              <> · {formatDuration(totalSec(remaining))} left today</>
            ) : null}
          </p>
        </div>
        <ProgressRing fraction={progress.fraction} />
      </header>

      <ul className="mt-4 space-y-1">
        {view.tasks.map((task) => {
          const done = isComplete(task);
          return (
            <li key={task.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-white/4">
              <button
                onClick={() => toggle(task)}
                aria-label={done ? `Mark ${task.title} unwatched` : `Mark ${task.title} watched`}
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${
                  done
                    ? 'border-accent bg-accent text-surface'
                    : 'border-white/20 hover:border-accent/60'
                }`}
              >
                {done ? <CheckIcon /> : null}
              </button>

              <a
                href={watchUrl(task.videoId, roadmap.playlistId)}
                target="_blank"
                rel="noreferrer"
                className={`min-w-0 flex-1 truncate text-sm transition hover:text-accent ${
                  done ? 'text-ink-muted line-through' : ''
                }`}
              >
                {task.title}
              </a>

              <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                {formatDuration(task.durationSec)}
              </span>
            </li>
          );
        })}
      </ul>

      {next ? (
        <a
          href={watchUrl(next.videoId, roadmap.playlistId)}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:brightness-110"
        >
          Start next
          <span aria-hidden>→</span>
        </a>
      ) : (
        <p className="mt-4 text-sm text-accent">
          Done for today — {view.tasks.length} video{view.tasks.length === 1 ? '' : 's'},{' '}
          {formatDuration(view.doneSec)}.
        </p>
      )}
    </section>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M2.5 6.5L5 9l4.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
