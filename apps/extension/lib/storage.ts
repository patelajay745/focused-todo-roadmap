import { storage } from '#imports';
import { roadmapSchema, type Roadmap } from '@ftr/core';
import { DEFAULT_BLOCKING, type BlockingSettings } from './blocking';

export type Settings = {
  youtubeApiKey: string;
};

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: { youtubeApiKey: '' },
});

export const blockingItem = storage.defineItem<BlockingSettings>('local:blocking', {
  fallback: DEFAULT_BLOCKING,
});

export const bypassUntilItem = storage.defineItem<number | null>('local:bypassUntil', {
  fallback: null,
});

export type BypassRecord = {
  at: string;
  reason: string;
  minutes: number;
};

export const bypassLogItem = storage.defineItem<BypassRecord[]>('local:bypassLog', {
  fallback: [],
});

const roadmapsItem = storage.defineItem<unknown[]>('local:roadmaps', {
  fallback: [],
});

export async function listRoadmaps(): Promise<Roadmap[]> {
  const stored = await roadmapsItem.getValue();
  if (!Array.isArray(stored)) return [];

  return stored.flatMap((entry) => {
    const parsed = roadmapSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function saveRoadmap(roadmap: Roadmap): Promise<void> {
  const existing = await listRoadmaps();
  const index = existing.findIndex((entry) => entry.id === roadmap.id);
  await roadmapsItem.setValue(
    index >= 0 ? existing.with(index, roadmap) : [...existing, roadmap],
  );
}

export async function deleteRoadmap(id: string): Promise<void> {
  const existing = await listRoadmaps();
  await roadmapsItem.setValue(existing.filter((entry) => entry.id !== id));
}

export function watchRoadmaps(onChange: (roadmaps: Roadmap[]) => void): () => void {
  return roadmapsItem.watch(() => {
    void listRoadmaps().then(onChange);
  });
}
