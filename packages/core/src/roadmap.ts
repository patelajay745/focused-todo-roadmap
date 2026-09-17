import { buildSchedule } from "./scheduler";
import type { PlanConfig, Roadmap, Task, TaskStatus } from "./types";

export type ImportedVideo = {
  videoId: string;
  title: string;
  durationSec: number;
};

export type CreateRoadmapInput = {
  title: string;
  playlistId: string;
  videos: ImportedVideo[];
  plan: PlanConfig;
  now?: Date;
};

export function createRoadmap(input: CreateRoadmapInput): Roadmap {
  const timestamp = (input.now ?? new Date()).toISOString();

  const tasks: Task[] = input.videos.map((video, index) => ({
    id: `${input.playlistId}:${video.videoId}:${index}`,
    videoId: video.videoId,
    playlistId: input.playlistId,
    position: index,
    title: video.title,
    durationSec: Math.max(0, Math.round(video.durationSec)),
    status: "todo",
  }));

  return {
    id: crypto.randomUUID(),
    title: input.title,
    playlistId: input.playlistId,
    tasks,
    plan: input.plan,
    schedule: buildSchedule(tasks, input.plan),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export type MarkTaskOptions = {
  status: TaskStatus;
  at?: Date;
  auto?: boolean;
};

export function markTask(roadmap: Roadmap, taskId: string, options: MarkTaskOptions): Roadmap {
  const timestamp = (options.at ?? new Date()).toISOString();
  let changed = false;

  const tasks = roadmap.tasks.map((task) => {
    if (task.id !== taskId || task.status === options.status) return task;
    changed = true;

    if (options.status === "todo") {
      const { completedAt, autoCompleted, ...rest } = task;
      return { ...rest, status: options.status };
    }

    return {
      ...task,
      status: options.status,
      completedAt: timestamp,
      autoCompleted: options.auto ?? false,
    };
  });

  return changed ? { ...roadmap, tasks, updatedAt: timestamp } : roadmap;
}

export function findTaskByVideoId(roadmap: Roadmap, videoId: string): Task | undefined {
  return roadmap.tasks.find((task) => task.videoId === videoId);
}
