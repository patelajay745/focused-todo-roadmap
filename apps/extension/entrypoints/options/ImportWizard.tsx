import {
  ALL_WEEKDAYS,
  addDays,
  createRoadmap,
  formatDuration,
  parsePlaylistId,
  resolveBudgetSec,
  toDateKey,
  totalSec,
  type Roadmap,
} from '@ftr/core';
import { useMemo, useState } from 'react';
import { Button, Field, Input, Notice } from '../../components/ui';
import { saveRoadmap } from '../../lib/storage';
import { importPlaylist, type PlaylistImport } from '../../lib/youtube-api';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function describeDaysOff(activeWeekdays: number[]): string {
  const off = ALL_WEEKDAYS.filter((day) => !activeWeekdays.includes(day)).map(
    (day) => WEEKDAY_NAMES[day]!,
  );

  if (off.length === 0) return 'Studying every day — no weekly day off.';
  if (off.length === 7) return 'Every day is off, so nothing can be scheduled.';

  const list =
    off.length === 1
      ? off[0]!
      : `${off.slice(0, -1).join(', ')} and ${off.at(-1)!}`;
  return `Off every ${list}. This applies to this playlist only.`;
}

type Stage =
  | { kind: 'idle' }
  | { kind: 'fetching'; fetched: number }
  | { kind: 'ready'; data: PlaylistImport }
  | { kind: 'error'; message: string };

export function ImportWizard({
  apiKey,
  onSaved,
}: {
  apiKey: string;
  onSaved: () => void;
}) {
  const today = toDateKey(new Date());

  const [url, setUrl] = useState('');
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [startDate, setStartDate] = useState(today);
  const [modeKind, setModeKind] = useState<'byBudget' | 'byDate'>('byBudget');
  const [minutesPerDay, setMinutesPerDay] = useState(60);
  const [endDate, setEndDate] = useState(addDays(today, 30));
  const [weekdays, setWeekdays] = useState<number[]>(ALL_WEEKDAYS);
  const [daysOff, setDaysOff] = useState<string[]>([]);
  const [dayOffDraft, setDayOffDraft] = useState('');
  const [startIndex, setStartIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const data = stage.kind === 'ready' ? stage.data : null;

  const preview = useMemo(() => {
    if (!data) return null;
    try {
      const roadmap = createRoadmap({
        title: data.title,
        playlistId: data.playlistId,
        videos: data.videos,
        startIndex,
        plan: {
          startDate,
          mode:
            modeKind === 'byBudget'
              ? { kind: 'byBudget', minutesPerDay }
              : { kind: 'byDate', endDate },
          activeWeekdays: weekdays,
          skipDates: daysOff,
        },
      });
      return { roadmap, error: null as string | null };
    } catch (cause) {
      return {
        roadmap: null,
        error: cause instanceof Error ? cause.message : 'Could not build a plan.',
      };
    }
  }, [data, startDate, modeKind, minutesPerDay, endDate, weekdays, daysOff, startIndex]);

  async function fetchPlaylist() {
    const playlistId = parsePlaylistId(url);
    if (!playlistId) {
      setStage({ kind: 'error', message: 'That does not look like a playlist URL.' });
      return;
    }

    setStage({ kind: 'fetching', fetched: 0 });
    try {
      const data = await importPlaylist(playlistId, apiKey, (fetched) =>
        setStage({ kind: 'fetching', fetched }),
      );
      setStage({ kind: 'ready', data });
      setStartIndex(0);
    } catch (cause) {
      setStage({
        kind: 'error',
        message: cause instanceof Error ? cause.message : 'Import failed.',
      });
    }
  }

  async function save() {
    if (!preview?.roadmap) return;
    setSaving(true);
    try {
      await saveRoadmap(preview.roadmap);
      setStage({ kind: 'idle' });
      setUrl('');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  function toggleWeekday(day: number) {
    setWeekdays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort(),
    );
  }

  return (
    <div className="space-y-4">
      <Field
        label="Playlist URL"
        hint="Paste a YouTube playlist link, or just the playlist ID."
      >
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.youtube.com/playlist?list=..."
            disabled={!apiKey || stage.kind === 'fetching'}
          />
          <Button
            onClick={() => void fetchPlaylist()}
            disabled={!apiKey || !url.trim() || stage.kind === 'fetching'}
          >
            {stage.kind === 'fetching' ? 'Fetching…' : 'Fetch'}
          </Button>
        </div>
      </Field>

      {stage.kind === 'fetching' && stage.fetched > 0 ? (
        <Notice tone="info">Loaded {stage.fetched} videos…</Notice>
      ) : null}

      {stage.kind === 'error' ? <Notice tone="error">{stage.message}</Notice> : null}

      {data ? (
        <>
          <div className="rounded-lg border border-white/10 px-3 py-2.5">
            <p className="text-sm font-medium">{data.title}</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {data.videos.length} videos · {formatDuration(totalSec(data.videos))} total
              {data.unavailable > 0
                ? ` · ${data.unavailable} private or deleted video${data.unavailable === 1 ? '' : 's'} skipped`
                : ''}
            </p>
          </div>

          <Field
            label="Start from"
            hint={
              startIndex > 0
                ? `Videos 1–${startIndex} stay on the roadmap as skipped, so you can come back to them.`
                : 'Already watched the first few? Start further in.'
            }
          >
            <select
              value={startIndex}
              onChange={(event) => setStartIndex(Number(event.target.value))}
              className="w-full rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-ink outline-none focus:border-accent/60"
            >
              {data.videos.map((video, index) => (
                <option key={video.videoId} value={index}>
                  {index + 1}. {video.title} ({formatDuration(video.durationSec)})
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </Field>

            <Field label="Pace">
              <div className="flex gap-2">
                <Button
                  variant={modeKind === 'byBudget' ? 'primary' : 'ghost'}
                  onClick={() => setModeKind('byBudget')}
                  className="flex-1"
                >
                  Per day
                </Button>
                <Button
                  variant={modeKind === 'byDate' ? 'primary' : 'ghost'}
                  onClick={() => setModeKind('byDate')}
                  className="flex-1"
                >
                  By date
                </Button>
              </div>
            </Field>
          </div>

          {modeKind === 'byBudget' ? (
            <Field label="Minutes per day">
              <Input
                type="number"
                min={5}
                step={5}
                value={minutesPerDay}
                onChange={(event) => setMinutesPerDay(Math.max(5, Number(event.target.value)))}
              />
            </Field>
          ) : (
            <Field label="Finish by">
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </Field>
          )}

          <Field label="Study days" hint={describeDaysOff(weekdays)}>
            <div className="flex gap-1.5">
              {WEEKDAY_LABELS.map((label, day) => (
                <button
                  key={day}
                  onClick={() => toggleWeekday(day)}
                  className={`h-9 w-9 rounded-lg text-sm transition ${
                    weekdays.includes(day)
                      ? 'bg-accent text-surface font-medium'
                      : 'border border-white/10 text-ink-muted hover:bg-white/5'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Days off" hint="Specific dates to skip — travel, exams, anything.">
            <div className="flex gap-2">
              <Input
                type="date"
                value={dayOffDraft}
                onChange={(event) => setDayOffDraft(event.target.value)}
              />
              <Button
                variant="ghost"
                disabled={!dayOffDraft || daysOff.includes(dayOffDraft)}
                onClick={() => {
                  setDaysOff((current) => [...current, dayOffDraft].sort());
                  setDayOffDraft('');
                }}
              >
                Add
              </Button>
            </div>
            {daysOff.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {daysOff.map((date) => (
                  <li key={date}>
                    <button
                      onClick={() => setDaysOff((current) => current.filter((d) => d !== date))}
                      className="rounded-md border border-white/10 px-2 py-1 text-xs text-ink-muted hover:border-warn/40 hover:text-warn"
                    >
                      {date} ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Field>

          {preview?.error ? <Notice tone="error">{preview.error}</Notice> : null}

          {preview?.roadmap ? (
            <SchedulePreview roadmap={preview.roadmap} />
          ) : null}

          <div className="flex gap-2">
            <Button onClick={() => void save()} disabled={!preview?.roadmap || saving}>
              {saving ? 'Saving…' : 'Save roadmap'}
            </Button>
            <Button variant="ghost" onClick={() => setStage({ kind: 'idle' })}>
              Cancel
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SchedulePreview({ roadmap }: { roadmap: Roadmap }) {
  const byId = new Map(roadmap.tasks.map((task) => [task.id, task]));
  const lastDay = roadmap.schedule.at(-1);

  const planned = roadmap.tasks.filter((task) => task.status === 'todo');
  const skipped = roadmap.tasks.length - planned.length;

  const budgetSec = resolveBudgetSec(planned, roadmap.plan);
  const overruns = roadmap.schedule.filter((day) => day.plannedSec > budgetSec);
  const longestVideo = Math.max(...planned.map((task) => task.durationSec));

  return (
    <div className="space-y-3">
      {overruns.length > 0 ? (
        <Notice tone="info">
          {overruns.length} day{overruns.length === 1 ? '' : 's'} run over your target because a
          single video is longer than it — the longest is {formatDuration(longestVideo)}. Videos
          are never split across days.
        </Notice>
      ) : null}

      <div className="rounded-lg border border-white/10">
        <div className="flex items-baseline justify-between border-b border-white/5 px-3 py-2.5">
          <p className="text-sm font-medium">
            {roadmap.schedule.length} study day{roadmap.schedule.length === 1 ? '' : 's'}
            <span className="ml-2 font-normal text-xs text-ink-muted">
              {planned.length} video{planned.length === 1 ? '' : 's'} ·{' '}
              {formatDuration(totalSec(planned))}
              {skipped > 0 ? ` · ${skipped} skipped` : ''}
            </span>
          </p>
          <p className="text-xs text-ink-muted">ends {lastDay?.date}</p>
        </div>
        <ul className="max-h-64 overflow-y-auto divide-y divide-white/5">
          {roadmap.schedule.map((day, index) => (
            <li key={day.date} className="flex items-baseline gap-3 px-3 py-2 text-xs">
              <span className="w-6 shrink-0 text-ink-muted">{index + 1}</span>
              <span className="w-24 shrink-0 text-ink-muted">{day.date}</span>
              <span
                className={`w-14 shrink-0 ${day.plannedSec > budgetSec ? 'text-warn' : ''}`}
              >
                {formatDuration(day.plannedSec)}
              </span>
              <span className="truncate text-ink-muted">
                {day.taskIds.map((id) => byId.get(id)?.title).filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
