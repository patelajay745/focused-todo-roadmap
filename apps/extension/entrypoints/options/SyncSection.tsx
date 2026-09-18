import { useEffect, useState } from 'react';
import { Button, Field, Input, Notice } from '../../components/ui';
import {
  checkHealth,
  getSyncConfig,
  pullAll,
  pushAll,
  syncConfigItem,
  syncStateItem,
  type SyncConfig,
  type SyncState,
} from '../../lib/sync';

export function SyncSection() {
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [state, setState] = useState<SyncState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void getSyncConfig().then(setConfig);
    void syncStateItem.getValue().then(setState);
    return syncStateItem.watch(setState);
  }, []);

  if (!config) return null;

  function patch(changes: Partial<SyncConfig>) {
    const next = { ...config!, ...changes };
    setConfig(next);
    void syncConfigItem.setValue(next);
  }

  async function test() {
    setBusy(true);
    setMessage(null);
    try {
      const reachable = await checkHealth(config!);
      setMessage(reachable ? 'Connected.' : 'Could not reach the server. Is it running?');
      if (reachable) await pushAll();
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    setMessage(null);
    try {
      const count = await pullAll();
      setMessage(count > 0 ? `Restored ${count} roadmap(s).` : 'Nothing newer on the server.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Restore failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(event) => {
            patch({ enabled: event.target.checked });
            if (event.target.checked) void pushAll();
          }}
          className="mt-1 h-4 w-4 accent-[oklch(0.72_0.17_145)]"
        />
        <span>
          <span className="block text-sm font-medium">Back up to my database</span>
          <span className="mt-0.5 block text-xs text-ink-muted">
            Your new tab keeps working whether or not the server is running.
          </span>
        </span>
      </label>

      {config.enabled ? (
        <>
          <Field label="Server address" hint="Runs locally via bun run dev:web.">
            <Input value={config.apiUrl} onChange={(event) => patch({ apiUrl: event.target.value })} />
          </Field>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => void test()} disabled={busy}>
              {busy ? 'Checking…' : 'Test connection'}
            </Button>
            <Button variant="ghost" onClick={() => void restore()} disabled={busy}>
              Restore from database
            </Button>
          </div>

          {message ? <Notice tone="info">{message}</Notice> : null}

          {state ? (
            <p className="text-xs text-ink-muted">
              Status: {state.status}
              {state.lastSyncedAt
                ? ` · last saved ${new Date(state.lastSyncedAt).toLocaleString()}`
                : ''}
              {state.error ? ` · ${state.error}` : ''}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
