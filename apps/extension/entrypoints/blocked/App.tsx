import { browser } from '#imports';
import {
  formatDuration,
  getDayView,
  isComplete,
  toDateKey,
  totalSec,
  watchUrl,
  type Roadmap,
  type Task,
} from '@ftr/core';
import { ArrowRight } from 'pikaicons';
import { useEffect, useState } from 'react';
import { Button, Input } from '../../components/ui';
import { bypassLogItem, bypassUntilItem, listRoadmaps } from '../../lib/storage';

const BYPASS_MINUTES = 5;
const MIN_REASON_LENGTH = 15;

export default function App() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[] | null>(null);
  const [reason, setReason] = useState('');
  const [releasing, setReleasing] = useState(false);
  const today = toDateKey(new Date());

  useEffect(() => {
    void listRoadmaps().then(setRoadmaps);
  }, []);

  const pending: { roadmap: Roadmap; task: Task }[] = (roadmaps ?? []).flatMap((roadmap) =>
    getDayView(roadmap, today)
      .tasks.filter((task) => !isComplete(task))
      .map((task) => ({ roadmap, task })),
  );

  const next = pending[0];
  const remainingSec = totalSec(pending.map(({ task }) => task));

  async function bypass() {
    setReleasing(true);
    const now = Date.now();

    await bypassUntilItem.setValue(now + BYPASS_MINUTES * 60_000);
    const log = await bypassLogItem.getValue();
    await bypassLogItem.setValue([
      ...log.slice(-19),
      { at: new Date(now).toISOString(), reason: reason.trim(), minutes: BYPASS_MINUTES },
    ]);

    window.location.replace('about:blank');
  }

  return (
    <main className="font-sans grid min-h-screen place-items-center bg-surface px-6 py-16 text-ink">
      <div className="w-full max-w-lg">
        <p className="text-sm text-ink-muted">Blocked during your study window</p>
        <h1 className="mt-2 text-2xl font-semibold">
          {next ? 'You have work left today.' : 'Nothing left today.'}
        </h1>

        {pending.length > 0 ? (
          <>
            <p className="mt-2 text-sm text-ink-muted">
              {pending.length} video{pending.length === 1 ? '' : 's'} ·{' '}
              {formatDuration(remainingSec)} remaining
            </p>

            <ul className="mt-5 space-y-1">
              {pending.map(({ roadmap, task }) => (
                <li key={task.id} className="flex items-baseline gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                    {formatDuration(task.durationSec)}
                  </span>
                  <span className="sr-only">{roadmap.title}</span>
                </li>
              ))}
            </ul>

            {next ? (
              <a
                href={watchUrl(next.task.videoId, next.roadmap.playlistId)}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-surface transition hover:brightness-110"
              >
                Open next video
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            Blocking is still on because your window is open. Adjust it in settings.
          </p>
        )}

        <details className="mt-10 border-t border-white/8 pt-5">
          <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
            I need {BYPASS_MINUTES} minutes anyway
          </summary>
          <div className="mt-3 space-y-2">
            <p className="text-xs text-ink-muted">
              Say why. It gets logged and shown on your new tab.
            </p>
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why do you need this right now?"
            />
            <Button
              variant="ghost"
              disabled={reason.trim().length < MIN_REASON_LENGTH || releasing}
              onClick={() => void bypass()}
            >
              {reason.trim().length < MIN_REASON_LENGTH
                ? `${MIN_REASON_LENGTH - reason.trim().length} more characters`
                : `Unblock for ${BYPASS_MINUTES} minutes`}
            </Button>
          </div>
        </details>

        <button
          onClick={() => void browser.runtime.openOptionsPage()}
          className="mt-8 block text-xs text-ink-muted transition hover:text-ink"
        >
          Settings
        </button>
      </div>
    </main>
  );
}
