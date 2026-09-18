import {
  formatDuration,
  previewReschedule,
  reschedule,
  type DateKey,
  type Pace,
  type Roadmap,
  type RescheduleMode,
} from '@ftr/core';
import { formatDay } from '../../lib/format';

const COPY: Record<RescheduleMode, { label: string; note: string }> = {
  catchUp: { label: 'Catch up', note: 'keep the deadline, do more each day' },
  relax: { label: 'Push the deadline', note: 'keep the pace, finish later' },
};

export function RescheduleBanner({
  roadmap,
  today,
  pace,
  onChange,
}: {
  roadmap: Roadmap;
  today: DateKey;
  pace: Pace;
  onChange: (next: Roadmap) => void;
}) {
  const options = previewReschedule(roadmap, today);
  if (options.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-warn/30 bg-warn/6 p-4">
      <p className="text-sm font-semibold text-warn">
        {pace.daysBehind} day{pace.daysBehind === 1 ? '' : 's'} behind ·{' '}
        {formatDuration(pace.behindSec)} owed
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        Currently ending {pace.endDate ? formatDay(pace.endDate) : 'unscheduled'}. Something has to
        give — pick which.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <button
            key={option.mode}
            onClick={() => onChange(reschedule(roadmap, today, option.mode))}
            className="rounded-lg border border-white/12 px-3 py-2.5 text-left transition hover:border-accent/50 hover:bg-white/5"
          >
            <span className="block text-sm font-medium">{COPY[option.mode].label}</span>
            <span className="mt-0.5 block text-xs text-accent">
              {option.minutesPerDay} min/day · ends {formatDay(option.endDate)}
            </span>
            <span className="mt-0.5 block text-xs text-ink-muted">{COPY[option.mode].note}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
