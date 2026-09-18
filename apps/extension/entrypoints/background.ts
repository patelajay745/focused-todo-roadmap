import { findTaskByVideoId } from '@ftr/core';
import { autoCompleteVideo } from '../lib/auto-complete';
import { isVideoWatched, type WatchOutcome } from '../lib/messages';
import { listRoadmaps, saveRoadmap } from '../lib/storage';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isVideoWatched(message)) return false;

    markWatched(message.videoId).then(sendResponse);
    return true;
  });
});

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
