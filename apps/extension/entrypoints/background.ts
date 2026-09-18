import { findTaskByVideoId, getDayView, toDateKey } from '@ftr/core';
import type { Browser } from 'wxt/browser';
import { autoCompleteVideo } from '../lib/auto-complete';
import { buildRules, evaluateBlocking } from '../lib/blocking';
import { isVideoWatched, type WatchOutcome } from '../lib/messages';
import { blockingItem, bypassUntilItem, listRoadmaps, saveRoadmap } from '../lib/storage';
import {
  checkHealth,
  getSyncConfig,
  markPending,
  pullAll,
  pushAll,
  syncStateItem,
} from '../lib/sync';

const HEARTBEAT = 'ftr-heartbeat';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isVideoWatched(message)) return false;

    markWatched(message.videoId).then(sendResponse);
    return true;
  });

  browser.alarms.create(HEARTBEAT, { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === HEARTBEAT) void heartbeat();
  });

  browser.runtime.onStartup.addListener(() => void startup());
  browser.runtime.onInstalled.addListener(() => void startup());

  browser.storage.local.onChanged.addListener((changes) => {
    if (changes.blocking || changes.bypassUntil) void syncBlockingRules();
    if (changes.roadmaps) void onRoadmapsChanged();
  });

  void startup();
});

async function startup(): Promise<void> {
  await syncBlockingRules();
  await refreshSyncState();

  try {
    await pullAll();
  } catch {
    return;
  }
}

async function heartbeat(): Promise<void> {
  await syncBlockingRules();

  const state = await syncStateItem.getValue();
  if (state.pendingSince) await pushAll();
  else await refreshSyncState();
}

async function onRoadmapsChanged(): Promise<void> {
  await syncBlockingRules();
  await markPending();
  await pushAll();
}

async function refreshSyncState(): Promise<void> {
  const config = await getSyncConfig();

  if (!config.enabled) {
    const current = await syncStateItem.getValue();
    await syncStateItem.setValue({ ...current, status: 'disabled', error: null });
    return;
  }

  const reachable = await checkHealth(config);
  const current = await syncStateItem.getValue();

  await syncStateItem.setValue({
    ...current,
    status: reachable ? (current.pendingSince ? 'pending' : 'connected') : 'offline',
    error: reachable ? null : 'Server is not running',
  });
}

async function markWatched(videoId: string): Promise<WatchOutcome> {
  const roadmaps = await listRoadmaps();

  const completion = autoCompleteVideo(roadmaps, videoId);
  if (completion) {
    await saveRoadmap(completion.roadmap);
    return { status: 'completed', title: completion.title };
  }

  for (const roadmap of roadmaps) {
    const task = findTaskByVideoId(roadmap, videoId);
    if (task?.status === 'done') return { status: 'already', title: task.title };
  }

  return { status: 'none' };
}

async function isTargetDone(): Promise<boolean> {
  const today = toDateKey(new Date());
  const views = (await listRoadmaps())
    .map((roadmap) => getDayView(roadmap, today))
    .filter((view) => view.tasks.length > 0);

  return views.length > 0 && views.every((view) => view.isCleared);
}

async function syncBlockingRules(): Promise<void> {
  const [settings, bypassUntil] = await Promise.all([
    blockingItem.getValue(),
    bypassUntilItem.getValue(),
  ]);

  const state = evaluateBlocking({
    settings,
    now: new Date(),
    targetDone: await isTargetDone(),
    bypassUntil,
  });

  const existing = await browser.declarativeNetRequest.getDynamicRules();

  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: state.active ? (buildRules(settings.sites) as Browser.declarativeNetRequest.Rule[]) : [],
  });
}
