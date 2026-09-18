import { findTaskByVideoId, markTask, type Roadmap } from '@ftr/core';

export type AutoCompletion = {
  roadmap: Roadmap;
  title: string;
};

export function autoCompleteVideo(
  roadmaps: Roadmap[],
  videoId: string,
  at?: Date,
): AutoCompletion | null {
  for (const roadmap of roadmaps) {
    const task = findTaskByVideoId(roadmap, videoId);
    const isPending = task?.status === 'todo';
    if (!task || !isPending) continue;

    return {
      roadmap: markTask(roadmap, task.id, { status: 'done', auto: true, at }),
      title: task.title,
    };
  }

  return null;
}
