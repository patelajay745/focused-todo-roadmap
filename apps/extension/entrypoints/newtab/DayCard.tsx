import {
  formatDuration,
  getDayView,
  getPace,
  getProgress,
  isComplete,
  markTask,
  totalSec,
  watchUrl,
  type DateKey,
  type Pace,
  type Roadmap,
  type Task,
} from '@ftr/core';
import { ArrowRight, CheckTick } from 'pikaicons';
import { ProgressRing } from '../../components/ProgressRing';

export function DayCard({
  roadmap,
  date,
  today,
  onChange,
}: {
  roadmap: Roadmap;
  date: DateKey;
  today: DateKey;
  onChange: (next: Roadmap) => void;
}) {
  const view = getDayView(roadmap, date);
  const progress = getProgress(roadmap, today);
  const pace = getPace(roadmap, today);
  const remaining = view.tasks.filter((task) => !isComplete(task));
  const next = remaining[0];

  function toggle(task: Task) {
    onChange(markTask(roadmap, task.id, { status: isComplete(task) ? 'todo' : 'done' }));
  }

  return (
    <section className="rounded-2xl border border-white/8 bg-surface-raised p-5">
      <header className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{roadmap.title}</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Day {progress.dayIndex} of {progress.totalDays}
            {pace.endDate ? <> · ends {formatDay(pace.endDate)}</> : null}
          </p>
          <PaceLine pace={pace} remainingToday={totalSec(remaining)} isToday={date === today} />
        </div>
        <ProgressRing fraction={progress.fraction} />
      </header>

      <div className="mt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${Math.round(progress.fraction * 100)}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-ink-muted">
          {Math.round(progress.fraction * 100)}% of the playlist · {progress.tasksDone} of{' '}
          {progress.tasksTotal} videos · {formatDuration(pace.doneSec)} of{' '}
          {formatDuration(pace.totalSec)} watched
        </p>
      </div>

      {view.tasks.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">Nothing was scheduled on this day.</p>
      ) : (
        <ul className="mt-4 space-y-1">
          {view.tasks.map((task) => {
            const done = isComplete(task);
            return (
              <li
                key={task.id}
                className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-white/4"
              >
                <button
                  onClick={() => toggle(task)}
                  aria-label={done ? `Mark ${task.title} unwatched` : `Mark ${task.title} watched`}
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${
                    done
                      ? 'border-accent bg-accent text-surface'
                      : 'border-white/20 hover:border-accent/60'
                  }`}
                >
                  {done ? <CheckTick className="h-3.5 w-3.5" aria-hidden /> : null}
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
      )}

      {next ? (
        <a
          href={watchUrl(next.videoId, roadmap.playlistId)}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:brightness-110"
        >
          {date < today ? 'Catch up' : 'Start next'}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </a>
      ) : view.tasks.length > 0 ? (
        <p className="mt-4 text-sm text-accent">
          {date === today ? 'Done for today' : 'All done'} — {view.tasks.length} video
          {view.tasks.length === 1 ? '' : 's'}, {formatDuration(view.doneSec)}.
        </p>
      ) : null}
    </section>
  );
}

function PaceLine({
  pace,
  remainingToday,
  isToday,
}: {
  pace: Pace;
  remainingToday: number;
  isToday: boolean;
}) {
  if (pace.status === 'done') {
    return <p className="mt-1 text-sm text-accent">Finished — every video watched.</p>;
  }

  if (pace.status === 'behind') {
    return (
      <p className="mt-1 text-sm text-warn">
        {pace.daysBehind} day{pace.daysBehind === 1 ? '' : 's'} behind ·{' '}
        {formatDuration(pace.behindSec)} to catch up
      </p>
    );
  }

  const label = pace.status === 'ahead' ? 'Ahead of plan' : 'On track';
  return (
    <p className="mt-1 text-sm text-ink-muted">
      {label}
      {isToday && remainingToday > 0 ? ` · ${formatDuration(remainingToday)} left today` : ''}
    </p>
  );
}

function formatDay(date: DateKey): string {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(
    new Date(`${date}T00:00:00`),
  );
}
