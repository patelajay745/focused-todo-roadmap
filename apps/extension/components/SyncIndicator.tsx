import { useEffect, useState } from 'react';
import { syncStateItem, type SyncState, type SyncStatus } from '../lib/sync';

const TONE: Record<SyncStatus, { dot: string; text: string; label: string }> = {
  connected: { dot: 'bg-accent', text: 'text-ink-muted', label: 'Database connected' },
  pending: { dot: 'bg-warn animate-pulse', text: 'text-warn', label: 'Changes not saved yet' },
  offline: { dot: 'bg-warn/70', text: 'text-warn', label: 'Database offline' },
  disabled: { dot: 'bg-white/25', text: 'text-ink-muted/70', label: 'Sync off' },
};

export function SyncIndicator() {
  const [state, setState] = useState<SyncState | null>(null);

  useEffect(() => {
    void syncStateItem.getValue().then(setState);
    return syncStateItem.watch(setState);
  }, []);

  if (!state) return null;

  const tone = TONE[state.status];

  return (
    <div
      title={detail(state)}
      className="fixed bottom-4 right-4 flex items-center gap-2 rounded-full border border-white/8 bg-surface-raised px-3 py-1.5"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
      <span className={`text-xs ${tone.text}`}>{tone.label}</span>
    </div>
  );
}

function detail(state: SyncState): string {
  if (state.error) return state.error;
  if (state.status === 'connected' && state.lastSyncedAt) {
    return `Last saved ${new Date(state.lastSyncedAt).toLocaleTimeString()}`;
  }
  if (state.status === 'pending' && state.pendingSince) {
    return `Waiting since ${new Date(state.pendingSince).toLocaleTimeString()}`;
  }
  if (state.status === 'disabled') return 'Turn on database sync in settings';
  return '';
}
