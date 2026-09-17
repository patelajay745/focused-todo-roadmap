import {
  applyPlan,
  formatDuration,
  startPositionOf,
  toDateKey,
  withStartPoint,
  type Roadmap,
} from '@ftr/core';
import { useMemo, useState } from 'react';
import {
  draftFromPlan,
  PlanFields,
  planFromDraft,
  type PlanDraft,
} from '../../components/PlanFields';
import { SchedulePreview } from '../../components/SchedulePreview';
import { Button, Field, Input, Notice } from '../../components/ui';
import { saveRoadmap } from '../../lib/storage';

export function RoadmapEditor({
  roadmap,
  onDone,
}: {
  roadmap: Roadmap;
  onDone: () => void;
}) {
  const today = toDateKey(new Date());
  const [title, setTitle] = useState(roadmap.title);
  const [draft, setDraft] = useState<PlanDraft>(() => draftFromPlan(roadmap.plan));
  const [startPosition, setStartPosition] = useState(() => startPositionOf(roadmap));
  const [saving, setSaving] = useState(false);

  const doneCount = roadmap.tasks.filter((task) => task.status === 'done').length;

  const preview = useMemo(() => {
    try {
      const moved = withStartPoint(roadmap, startPosition);
      const replanned = applyPlan(moved, planFromDraft(draft), today);
      return { roadmap: { ...replanned, title: title.trim() || roadmap.title }, error: null };
    } catch (cause) {
      return {
        roadmap: null,
        error: cause instanceof Error ? cause.message : 'Could not rebuild the plan.',
      };
    }
  }, [roadmap, draft, title, today, startPosition]);

  async function save() {
    if (!preview.roadmap) return;
    setSaving(true);
    try {
      await saveRoadmap({ ...preview.roadmap, updatedAt: new Date().toISOString() });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-white/10 p-4">
      <Field label="Title">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>

      <Field
        label="Start from"
        hint={
          doneCount > 0
            ? `Videos before this become skipped — except the ${doneCount} you have already watched, which stay done.`
            : 'Videos before this become skipped. Move it back any time to restore them.'
        }
      >
        <select
          value={startPosition}
          onChange={(event) => setStartPosition(Number(event.target.value))}
          className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent/60"
        >
          {roadmap.tasks.map((task) => (
            <option key={task.id} value={task.position}>
              {task.position + 1}. {task.title} ({formatDuration(task.durationSec)})
              {task.status === 'done' ? ' — watched' : ''}
            </option>
          ))}
        </select>
      </Field>

      <PlanFields draft={draft} onChange={setDraft} />

      <Notice tone="info">
        Days you already finished stay as they are. Only unwatched videos get re-planned.
      </Notice>

      {preview.error ? <Notice tone="error">{preview.error}</Notice> : null}
      {preview.roadmap ? <SchedulePreview roadmap={preview.roadmap} /> : null}

      <div className="flex gap-2">
        <Button onClick={() => void save()} disabled={!preview.roadmap || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
