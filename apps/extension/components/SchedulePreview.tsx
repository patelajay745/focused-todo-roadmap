import { formatDuration, resolveBudgetSec, totalSec, type Roadmap } from '@ftr/core';
import { Notice } from './ui';

export function SchedulePreview({ roadmap }: { roadmap: Roadmap }) {
  const byId = new Map(roadmap.tasks.map((task) => [task.id, task]));
  const planned = roadmap.tasks.filter((task) => task.status === 'todo');
  const skipped = roadmap.tasks.length - planned.length;
  const lastDay = roadmap.schedule.at(-1);

  if (planned.length === 0) {
    return <Notice tone="success">Every video is done. Nothing left to schedule.</Notice>;
  }

  const budgetSec = resolveBudgetSec(planned, roadmap.plan);
  const overruns = roadmap.schedule.filter((day) => day.plannedSec > budgetSec);
  const longestVideo = Math.max(...planned.map((task) => task.durationSec));

  return (
    <div className="space-y-3">
      {overruns.length > 0 ? (
        <Notice tone="info">
          {overruns.length} day{overruns.length === 1 ? '' : 's'} run over your target because a
          single video is longer than it — the longest is {formatDuration(longestVideo)}. Videos are
          never split across days.
        </Notice>
      ) : null}

      <div className="rounded-lg border border-white/10">
        <div className="flex items-baseline justify-between border-b border-white/5 px-3 py-2.5">
          <p className="text-sm font-medium">
            {roadmap.schedule.length} study day{roadmap.schedule.length === 1 ? '' : 's'}
            <span className="ml-2 text-xs font-normal text-ink-muted">
              {planned.length} video{planned.length === 1 ? '' : 's'} ·{' '}
              {formatDuration(totalSec(planned))}
              {skipped > 0 ? ` · ${skipped} skipped` : ''}
            </span>
          </p>
          <p className="text-xs text-ink-muted">ends {lastDay?.date}</p>
        </div>
        <ul className="max-h-64 divide-y divide-white/5 overflow-y-auto">
          {roadmap.schedule.map((day, index) => (
            <li key={day.date} className="flex items-baseline gap-3 px-3 py-2 text-xs">
              <span className="w-6 shrink-0 text-ink-muted">{index + 1}</span>
              <span className="w-24 shrink-0 text-ink-muted">{day.date}</span>
              <span className={`w-14 shrink-0 ${day.plannedSec > budgetSec ? 'text-warn' : ''}`}>
                {formatDuration(day.plannedSec)}
              </span>
              <span className="truncate text-ink-muted">
                {day.taskIds
                  .map((id) => byId.get(id)?.title)
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
