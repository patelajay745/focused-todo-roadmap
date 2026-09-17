import { storage } from '#imports';
import { roadmapSchema, type Roadmap } from '@ftr/core';

export type Settings = {
  youtubeApiKey: string;
};

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: { youtubeApiKey: '' },
});

const roadmapsItem = storage.defineItem<unknown[]>('local:roadmaps', {
  fallback: [],
});

export async function listRoadmaps(): Promise<Roadmap[]> {
  const stored = await roadmapsItem.getValue();
  if (!Array.isArray(stored)) return [];

  // Anything that no longer matches the schema is dropped rather than thrown on,
  // so a shape change can never leave the new tab unable to render.
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
