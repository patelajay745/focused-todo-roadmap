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
  startIndex?: number;
  now?: Date;
};

export function createRoadmap(input: CreateRoadmapInput): Roadmap {
  const timestamp = (input.now ?? new Date()).toISOString();
  const startIndex = Math.min(Math.max(0, Math.trunc(input.startIndex ?? 0)), input.videos.length);

  // Skipped videos deliberately get no completedAt, which keeps them out of every day view.
  const tasks: Task[] = input.videos.map((video, index) => ({
    id: `${input.playlistId}:${video.videoId}:${index}`,
    videoId: video.videoId,
    playlistId: input.playlistId,
    position: index,
    title: video.title,
    durationSec: Math.max(0, Math.round(video.durationSec)),
    status: index < startIndex ? "skipped" : "todo",
  }));

  return {
    id: crypto.randomUUID(),
    title: input.title,
    playlistId: input.playlistId,
    tasks,
    plan: input.plan,
    schedule: buildSchedule(
      tasks.filter((task) => task.status === "todo"),
      input.plan,
    ),
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

export function startPositionOf(roadmap: Roadmap): number {
  const first = roadmap.tasks.find((task) => task.status !== "skipped");
  return first?.position ?? roadmap.tasks.length;
}

// Status only — the caller re-plans, so moving the start point twice costs one rebuild.
export function withStartPoint(roadmap: Roadmap, startPosition: number): Roadmap {
  const tasks = roadmap.tasks.map((task) => {
    // Watched videos stay watched: moving the start point must never erase real progress.
    if (task.status === "done") return task;

    if (task.position < startPosition) {
      return task.status === "skipped" ? task : { ...task, status: "skipped" as const };
    }
    return task.status === "skipped" ? { ...task, status: "todo" as const } : task;
  });

  return { ...roadmap, tasks };
}
