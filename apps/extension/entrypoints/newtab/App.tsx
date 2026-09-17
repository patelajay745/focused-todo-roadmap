import { browser } from '#imports';
import {
  formatDuration,
  getDayView,
  getProgress,
  isComplete,
  toDateKey,
  totalSec,
  type DateKey,
  type Roadmap,
} from '@ftr/core';
import { useEffect, useState } from 'react';
import { listRoadmaps, saveRoadmap, watchRoadmaps } from '../../lib/storage';
import { TodayCard } from './TodayCard';

export default function App() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[] | null>(null);
  const today = useToday();

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

  if (roadmaps === null) return <Shell today={today} />;

  const active = roadmaps.filter((roadmap) => getDayView(roadmap, today).tasks.length > 0);
  const idle = roadmaps.filter((roadmap) => !active.includes(roadmap));

  return (
    <Shell today={today}>
      {roadmaps.length === 0 ? <EmptyState /> : null}

      {active.map((roadmap) => (
        <TodayCard key={roadmap.id} roadmap={roadmap} today={today} onChange={update} />
      ))}

      {active.length === 0 && roadmaps.length > 0 ? (
        <p className="text-ink-muted">Nothing scheduled today. Enjoy the day off.</p>
      ) : null}

      {idle.length > 0 ? <IdleList roadmaps={idle} today={today} /> : null}
    </Shell>
  );
}

function Shell({ today, children }: { today: DateKey; children?: React.ReactNode }) {
  const label = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${today}T00:00:00`));

  return (
    <main className="min-h-screen bg-surface text-ink">
      <div className="mx-auto max-w-xl px-6 py-16 space-y-5">
        <header className="flex items-baseline justify-between">
          <h1 className="text-lg font-medium">{label}</h1>
          <button
            onClick={() => void browser.runtime.openOptionsPage()}
            className="text-xs text-ink-muted transition hover:text-ink"
          >
            Settings
          </button>
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
        const finished = left.length === 0;

        return (
          <li
            key={roadmap.id}
            className="flex items-baseline gap-3 rounded-lg px-1 py-1.5 text-sm"
          >
            <span className="min-w-0 flex-1 truncate text-ink-muted">{roadmap.title}</span>
            <span className="shrink-0 text-xs text-ink-muted">
              {finished
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
