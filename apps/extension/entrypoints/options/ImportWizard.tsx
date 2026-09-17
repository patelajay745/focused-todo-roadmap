import { createRoadmap, formatDuration, parsePlaylistId, toDateKey, totalSec } from '@ftr/core';
import { useMemo, useState } from 'react';
import {
  newPlanDraft,
  PlanFields,
  planFromDraft,
  type PlanDraft,
} from '../../components/PlanFields';
import { SchedulePreview } from '../../components/SchedulePreview';
import { Button, Field, Input, Notice } from '../../components/ui';
import { saveRoadmap } from '../../lib/storage';
import { importPlaylist, type PlaylistImport } from '../../lib/youtube-api';

type Stage =
  | { kind: 'idle' }
  | { kind: 'fetching'; fetched: number }
  | { kind: 'ready'; data: PlaylistImport }
  | { kind: 'error'; message: string };

export function ImportWizard({ apiKey, onSaved }: { apiKey: string; onSaved: () => void }) {
  const today = toDateKey(new Date());

  const [url, setUrl] = useState('');
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [draft, setDraft] = useState<PlanDraft>(() => newPlanDraft(today));
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
        plan: planFromDraft(draft),
      });
      return { roadmap, error: null as string | null };
    } catch (cause) {
      return {
        roadmap: null,
        error: cause instanceof Error ? cause.message : 'Could not build a plan.',
      };
    }
  }, [data, draft, startIndex]);

  async function fetchPlaylist() {
    const playlistId = parsePlaylistId(url);
    if (!playlistId) {
      setStage({ kind: 'error', message: 'That does not look like a playlist URL.' });
      return;
    }

    setStage({ kind: 'fetching', fetched: 0 });
    try {
      const result = await importPlaylist(playlistId, apiKey, (fetched) =>
        setStage({ kind: 'fetching', fetched }),
      );
      setStage({ kind: 'ready', data: result });
      setStartIndex(0);
      setDraft(newPlanDraft(today));
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

  return (
    <div className="space-y-4">
      <Field label="Playlist URL" hint="Paste a YouTube playlist link, or just the playlist ID.">
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
                ? ` · ${data.unavailable} private or deleted video${
                    data.unavailable === 1 ? '' : 's'
                  } skipped`
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
              className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent/60"
            >
              {data.videos.map((video, index) => (
                <option key={video.videoId} value={index}>
                  {index + 1}. {video.title} ({formatDuration(video.durationSec)})
                </option>
              ))}
            </select>
          </Field>

          <PlanFields draft={draft} onChange={setDraft} />

          {preview?.error ? <Notice tone="error">{preview.error}</Notice> : null}
          {preview?.roadmap ? <SchedulePreview roadmap={preview.roadmap} /> : null}

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
