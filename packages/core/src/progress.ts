import { toDateKey, type DateKey } from "./dates";
import { resolveBudgetSec, scheduleEndDate } from "./scheduler";
import { isComplete, totalSec, type Roadmap, type Task } from "./types";

export type PaceStatus = "ahead" | "on-track" | "behind" | "done";

export type Pace = {
  status: PaceStatus;
  totalSec: number;
  doneSec: number;
  remainingSec: number;
  expectedDoneSec: number;
  behindSec: number;
  daysBehind: number;
  endDate: DateKey | null;
};

export type DayView = {
  date: DateKey;
  tasks: Task[];
  plannedSec: number;
  doneSec: number;
  isCleared: boolean;
};

function completedOn(task: Task): DateKey | null {
  if (!task.completedAt) return null;
  const parsed = new Date(task.completedAt);
  return Number.isNaN(parsed.getTime()) ? null : toDateKey(parsed);
}

export function getDayView(roadmap: Roadmap, date: DateKey): DayView {
  const byId = new Map(roadmap.tasks.map((task) => [task.id, task]));
  const day = roadmap.schedule.find((entry) => entry.date === date);

  const scheduled = (day?.taskIds ?? [])
    .map((id) => byId.get(id))
    .filter((task): task is Task => task !== undefined);

  const scheduledIds = new Set(scheduled.map((task) => task.id));
  const finishedToday = roadmap.tasks.filter(
    (task) => !scheduledIds.has(task.id) && completedOn(task) === date,
  );

  const tasks = [...scheduled, ...finishedToday];
  const done = tasks.filter(isComplete);

  return {
    date,
    tasks,
    plannedSec: day?.plannedSec ?? totalSec(tasks),
    doneSec: totalSec(done),
    isCleared: tasks.length > 0 && done.length === tasks.length,
  };
}

export function getPace(roadmap: Roadmap, today: DateKey): Pace {
  const total = totalSec(roadmap.tasks);
  const doneSec = totalSec(roadmap.tasks.filter(isComplete));

  const byId = new Map(roadmap.tasks.map((task) => [task.id, task]));
  const distinctDueTaskIds = new Set(
    roadmap.schedule.filter((day) => day.date <= today).flatMap((day) => day.taskIds),
  );
  const expectedDoneSec = [...distinctDueTaskIds].reduce(
    (sum, id) => sum + (byId.get(id)?.durationSec ?? 0),
    0,
  );

  const behindSec = Math.max(0, Math.min(expectedDoneSec, total) - doneSec);
  const budgetSec = safeBudgetSec(roadmap);

  return {
    status: resolveStatus(),
    totalSec: total,
    doneSec,
    remainingSec: Math.max(0, total - doneSec),
    expectedDoneSec,
    behindSec,
    daysBehind: budgetSec > 0 ? Math.ceil(behindSec / budgetSec) : 0,
    endDate: scheduleEndDate(roadmap.schedule),
  };

  function resolveStatus(): PaceStatus {
    if (total > 0 && doneSec >= total) return "done";
    if (behindSec > 0) return "behind";
    if (doneSec > expectedDoneSec) return "ahead";
    return "on-track";
  }
}

function safeBudgetSec(roadmap: Roadmap): number {
  try {
    return resolveBudgetSec(roadmap.tasks, roadmap.plan);
  } catch {
    return 0;
  }
}

export function getStreak(roadmap: Roadmap, today: DateKey): number {
  const days = roadmap.schedule
    .filter((day) => day.date <= today && day.taskIds.length > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  let streak = 0;
  for (const [index, day] of days.entries()) {
    if (getDayView(roadmap, day.date).isCleared) {
      streak++;
      continue;
    }
    // An unfinished today shouldn't zero a streak you haven't lost yet.
    if (index === 0 && day.date === today) continue;
    break;
  }
  return streak;
}

export type RoadmapProgress = {
  dayIndex: number;
  totalDays: number;
  tasksDone: number;
  tasksTotal: number;
  fraction: number;
};

export function getProgress(roadmap: Roadmap, today: DateKey): RoadmapProgress {
  const tasksDone = roadmap.tasks.filter(isComplete).length;
  const total = totalSec(roadmap.tasks);
  const doneSec = totalSec(roadmap.tasks.filter(isComplete));

  return {
    dayIndex: roadmap.schedule.filter((day) => day.date <= today).length,
    totalDays: roadmap.schedule.length,
    tasksDone,
    tasksTotal: roadmap.tasks.length,
    fraction: total > 0 ? doneSec / total : 0,
  };
}
