import { CrossCross } from 'pikaicons';
import { useEffect, useState } from 'react';
import { Button, Field, Input, Notice } from '../../components/ui';
import { normaliseSite, type BlockingSettings } from '../../lib/blocking';
import { blockingItem, bypassLogItem, type BypassRecord } from '../../lib/storage';

export function BlockingSection() {
  const [settings, setSettings] = useState<BlockingSettings | null>(null);
  const [siteDraft, setSiteDraft] = useState('');
  const [log, setLog] = useState<BypassRecord[]>([]);

  useEffect(() => {
    void blockingItem.getValue().then(setSettings);
    void bypassLogItem.getValue().then(setLog);
  }, []);

  if (!settings) return null;

  function patch(changes: Partial<BlockingSettings>) {
    const next = { ...settings!, ...changes };
    setSettings(next);
    void blockingItem.setValue(next);
  }

  function addSite() {
    const site = normaliseSite(siteDraft);
    if (!site || settings!.sites.includes(site)) return;
    patch({ sites: [...settings!.sites, site].sort() });
    setSiteDraft('');
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) => patch({ enabled: event.target.checked })}
          className="mt-1 h-4 w-4 accent-[oklch(0.72_0.17_145)]"
        />
        <span>
          <span className="block text-sm font-medium">Block distractions while I study</span>
          <span className="mt-0.5 block text-xs text-ink-muted">
            YouTube watch pages always stay open — the course lives there.
          </span>
        </span>
      </label>

      {settings.enabled ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <Input
                type="time"
                value={settings.startTime}
                onChange={(event) => patch({ startTime: event.target.value })}
              />
            </Field>
            <Field label="Until">
              <Input
                type="time"
                value={settings.endTime}
                onChange={(event) => patch({ endTime: event.target.value })}
              />
            </Field>
          </div>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={settings.stopWhenTargetDone}
              onChange={(event) => patch({ stopWhenTargetDone: event.target.checked })}
              className="mt-1 h-4 w-4 accent-[oklch(0.72_0.17_145)]"
            />
            <span className="text-sm">
              Stop blocking once today&rsquo;s videos are done
              <span className="mt-0.5 block text-xs text-ink-muted">
                Finish early, get your evening back.
              </span>
            </span>
          </label>

          <Field label="Blocked sites">
            <div className="flex gap-2">
              <Input
                value={siteDraft}
                onChange={(event) => setSiteDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addSite();
                  }
                }}
                placeholder="reddit.com"
              />
              <Button variant="ghost" onClick={addSite} disabled={!siteDraft.trim()}>
                Add
              </Button>
            </div>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {settings.sites.map((site) => (
                <li key={site}>
                  <button
                    onClick={() => patch({ sites: settings.sites.filter((s) => s !== site) })}
                    aria-label={`Stop blocking ${site}`}
                    className="flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-xs text-ink-muted hover:border-warn/40 hover:text-warn"
                  >
                    {site}
                    <CrossCross className="h-3 w-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </Field>

          {log.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                Bypasses
              </p>
              <ul className="space-y-1">
                {[...log].reverse().slice(0, 5).map((entry) => (
                  <li key={entry.at} className="text-xs text-ink-muted">
                    <span className="text-warn">
                      {new Date(entry.at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>{' '}
                    — {entry.reason}
                  </li>
                ))}
              </ul>
              <Button
                variant="ghost"
                className="mt-2"
                onClick={() => {
                  setLog([]);
                  void bypassLogItem.setValue([]);
                }}
              >
                Clear log
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <Notice tone="info">
          Turn this on and the sites below redirect to your remaining videos during your study
          window.
        </Notice>
      )}
    </div>
  );
}
