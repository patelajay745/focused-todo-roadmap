import { formatDuration, toDateKey } from '@ftr/core';

export default function App() {
  const today = toDateKey(new Date());

  return (
    <main className="font-sans min-h-screen bg-surface text-ink flex items-center justify-center p-8">
      <div className="w-full max-w-xl">
        <p className="text-ink-muted text-sm tracking-wide uppercase">{today}</p>
        <h1 className="mt-2 text-3xl font-semibold">No roadmap yet</h1>
        <p className="mt-3 text-ink-muted">
          Import a YouTube playlist from the extension options to see today&rsquo;s target here.
        </p>
        <p className="mt-8 text-xs text-ink-muted">
          core wired up &middot; sample duration {formatDuration(3723)}
        </p>
      </div>
    </main>
  );
}
