import { browser } from '#imports';
import {
  addDays,
  formatDuration,
  getDayView,
  getOverallStreak,
  getProgress,
  getWeek,
  isComplete,
  toDateKey,
  totalSec,
  type DateKey,
  type Roadmap,
} from '@ftr/core';
import { Settings01 } from 'pikaicons';
import { useEffect, useState } from 'react';
import { WeekStrip } from '../../components/WeekStrip';
import { listRoadmaps, saveRoadmap, watchRoadmaps } from '../../lib/storage';
import { DayCard } from './DayCard';

export default function App() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[] | null>(null);
  const today = useToday();

  const [picked, setPicked] = useState<DateKey | null>(null);
  const date = picked ?? today;

  useEffect(() => {
    void listRoadmaps().then(setRoadmaps);
    return watchRoadmaps(setRoadmaps);
  }, []);

  function update(next: Roadmap) {
    setRoadmaps((current) =>
      current ? current.map((entry) => (entry.id === next.id ? next : entry)) : current,
    );
    void saveRoadmap(next);
  }

  if (roadmaps === null) return <Shell date={date} today={today} />;

  const active = roadmaps.filter((roadmap) => getDayView(roadmap, date).tasks.length > 0);
  const idle = roadmaps.filter((roadmap) => !active.includes(roadmap));

  return (
    <Shell
      date={date}
      today={today}
      streak={getOverallStreak(roadmaps, today)}
      onBackToToday={picked && picked !== today ? () => setPicked(null) : undefined}
    >
      {roadmaps.length === 0 ? (
        <EmptyState />
      ) : (
        <WeekStrip
          days={getWeek(roadmaps, today, { anchor: date })}
          selected={date}
          onSelect={(next) => setPicked(next === today ? null : next)}
          onShiftWeek={(offset) => setPicked(addDays(date, offset * 7))}
        />
      )}

      {active.map((roadmap) => (
        <DayCard
          key={roadmap.id}
          roadmap={roadmap}
          date={date}
          today={today}
          onChange={update}
        />
      ))}

      {active.length === 0 && roadmaps.length > 0 ? (
        <p className="text-sm text-ink-muted">
          {date === today
            ? 'Nothing scheduled today. Enjoy the day off.'
            : 'Nothing was scheduled on this day.'}
        </p>
      ) : null}

      {idle.length > 0 ? <IdleList roadmaps={idle} today={today} /> : null}
    </Shell>
  );
}

function Shell({
  date,
  today,
  streak,
  onBackToToday,
  children,
}: {
  date: DateKey;
  today: DateKey;
  streak?: number;
  onBackToToday?: () => void;
  children?: React.ReactNode;
}) {
  const label = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T00:00:00`));

  return (
    <main className="font-sans min-h-screen bg-surface text-ink">
      <div className="mx-auto max-w-2xl space-y-5 px-6 py-14">
        <header className="flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-medium">{label}</h1>
            {date !== today ? (
              <span className="text-xs text-ink-muted">
                {date < today ? 'past' : 'upcoming'}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            {onBackToToday ? (
              <button
                onClick={onBackToToday}
                className="text-sm text-accent transition hover:brightness-110"
              >
                Today
              </button>
            ) : null}
            {streak !== undefined && streak > 0 ? (
              <span className="text-sm text-accent">
                {streak} day{streak === 1 ? '' : 's'} consistent
              </span>
            ) : null}
            <button
              onClick={() => void browser.runtime.openOptionsPage()}
              aria-label="Settings"
              className="text-ink-muted transition hover:text-ink"
            >
              <Settings01 className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <section className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
      <p className="text-sm text-ink-muted">
        No roadmap yet. Import a YouTube playlist and it becomes a dated plan you meet here.
      </p>
      <button
        onClick={() => void browser.runtime.openOptionsPage()}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:brightness-110"
      >
        Import a playlist
      </button>
    </section>
  );
}

function IdleList({ roadmaps, today }: { roadmaps: Roadmap[]; today: DateKey }) {
  return (
    <ul className="space-y-1 pt-2">
      {roadmaps.map((roadmap) => {
        const progress = getProgress(roadmap, today);
        const left = roadmap.tasks.filter((task) => !isComplete(task));

        return (
          <li key={roadmap.id} className="flex items-baseline gap-3 rounded-lg px-1 py-1.5 text-sm">
            <span className="min-w-0 flex-1 truncate text-ink-muted">{roadmap.title}</span>
            <span className="shrink-0 text-xs text-ink-muted">
              {left.length === 0
                ? 'Finished'
                : `${Math.round(progress.fraction * 100)}% · ${formatDuration(totalSec(left))} left`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function useToday(): DateKey {
  const [today, setToday] = useState(() => toDateKey(new Date()));

  useEffect(() => {
    const rollOverAtMidnight = setInterval(() => setToday(toDateKey(new Date())), 60_000);
    return () => clearInterval(rollOverAtMidnight);
  }, []);

  return today;
}
