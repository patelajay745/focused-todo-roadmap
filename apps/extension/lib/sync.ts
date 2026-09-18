import { storage } from '#imports';
import { roadmapSchema, type Roadmap } from '@ftr/core';
import { z } from 'zod';
import { listRoadmaps, saveRoadmap } from './storage';

export const DEVICE_HEADER = 'x-ftr-device';
export const DEFAULT_API_URL = 'http://localhost:3000';

export type SyncConfig = {
  enabled: boolean;
  apiUrl: string;
  deviceId: string;
};

export type SyncStatus = 'disabled' | 'offline' | 'pending' | 'connected';

export type SyncState = {
  status: SyncStatus;
  lastSyncedAt: string | null;
  pendingSince: string | null;
  error: string | null;
};

export const syncConfigItem = storage.defineItem<SyncConfig>('local:syncConfig', {
  fallback: { enabled: false, apiUrl: DEFAULT_API_URL, deviceId: '' },
});

export const syncStateItem = storage.defineItem<SyncState>('local:syncState', {
  fallback: { status: 'disabled', lastSyncedAt: null, pendingSince: null, error: null },
});

export async function getSyncConfig(): Promise<SyncConfig> {
  const config = await syncConfigItem.getValue();
  if (config.deviceId) return config;

  const withId = { ...config, deviceId: crypto.randomUUID() };
  await syncConfigItem.setValue(withId);
  return withId;
}

const pullBody = z.object({ roadmaps: z.array(roadmapSchema) });

async function request(config: SyncConfig, path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    return await fetch(`${config.apiUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'content-type': 'application/json', [DEVICE_HEADER]: config.deviceId, ...init?.headers },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkHealth(config: SyncConfig): Promise<boolean> {
  try {
    const response = await request(config, '/api/health');
    return response.ok;
  } catch {
    return false;
  }
}

export async function markPending(): Promise<void> {
  const state = await syncStateItem.getValue();
  if (state.pendingSince) return;

  await syncStateItem.setValue({ ...state, pendingSince: new Date().toISOString() });
}

export async function pushAll(): Promise<SyncState> {
  const config = await getSyncConfig();
  const previous = await syncStateItem.getValue();

  if (!config.enabled) {
    return persist({ status: 'disabled', lastSyncedAt: previous.lastSyncedAt, pendingSince: null, error: null });
  }

  try {
    const response = await request(config, '/api/sync', {
      method: 'POST',
      body: JSON.stringify({ roadmaps: await listRoadmaps() }),
    });

    if (!response.ok) {
      return persist({
        status: 'offline',
        lastSyncedAt: previous.lastSyncedAt,
        pendingSince: previous.pendingSince ?? new Date().toISOString(),
        error: `Server returned ${response.status}`,
      });
    }

    return persist({
      status: 'connected',
      lastSyncedAt: new Date().toISOString(),
      pendingSince: null,
      error: null,
    });
  } catch (cause) {
    return persist({
      status: 'offline',
      lastSyncedAt: previous.lastSyncedAt,
      pendingSince: previous.pendingSince ?? new Date().toISOString(),
      error: cause instanceof Error ? cause.message : 'Could not reach the server',
    });
  }
}

export async function pullAll(): Promise<number> {
  const config = await getSyncConfig();
  if (!config.enabled) return 0;

  const response = await request(config, '/api/sync');
  if (!response.ok) throw new Error(`Server returned ${response.status}`);

  const parsed = pullBody.safeParse(await response.json());
  if (!parsed.success) throw new Error('Unexpected response from the server');

  const local = new Map((await listRoadmaps()).map((roadmap) => [roadmap.id, roadmap]));
  let restored = 0;

  for (const remote of parsed.data.roadmaps) {
    if (isNewer(remote, local.get(remote.id))) {
      await saveRoadmap(remote);
      restored++;
    }
  }

  return restored;
}

function isNewer(remote: Roadmap, local: Roadmap | undefined): boolean {
  if (!local) return true;
  return new Date(remote.updatedAt).getTime() > new Date(local.updatedAt).getTime();
}

async function persist(state: SyncState): Promise<SyncState> {
  await syncStateItem.setValue(state);
  return state;
}
