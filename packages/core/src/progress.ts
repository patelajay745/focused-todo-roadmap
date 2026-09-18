import { addDays, toDateKey, weekOf, type DateKey } from "./dates";
import { resolveBudgetSec, scheduleEndDate } from "./scheduler";
import { isComplete, totalSec, type Roadmap, type Task } from "./types";

export type PaceStatus = "ahead" | "on-track" | "behind" | "done";

export type Pace = {
  status: PaceStatus;
  totalSec: number;
  doneSec: number;
  remainingSec: number;
  dueBeforeTodaySec: number;
  dueThroughTodaySec: number;
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

function plannedTasks(roadmap: Roadmap): Task[] {
  return roadmap.tasks.filter((task) => task.status !== "skipped");
}

export function getPace(roadmap: Roadmap, today: DateKey): Pace {
  const planned = plannedTasks(roadmap);
  const total = totalSec(planned);
  const doneSec = totalSec(planned.filter(isComplete));

  const plannedById = new Map(planned.map((task) => [task.id, task]));

  const idsOn = (limit: (date: DateKey) => boolean) =>
    new Set(roadmap.schedule.filter((day) => limit(day.date)).flatMap((day) => day.taskIds));

  const sumOf = (ids: Iterable<string>) =>
    [...ids].reduce((sum, id) => sum + (plannedById.get(id)?.durationSec ?? 0), 0);

  const replannedAhead = idsOn((date) => date >= today);
  const overdueIds = [...idsOn((date) => date < today)].filter((id) => !replannedAhead.has(id));

  const dueBeforeTodaySec = sumOf(overdueIds);
  const dueThroughTodaySec = sumOf(idsOn((date) => date <= today));

  const behindSec = Math.max(0, Math.min(dueBeforeTodaySec, total) - doneSec);
  const budgetSec = safeBudgetSec(roadmap);

  return {
    status: resolveStatus(),
    totalSec: total,
    doneSec,
    remainingSec: Math.max(0, total - doneSec),
    dueBeforeTodaySec,
    dueThroughTodaySec,
    behindSec,
    daysBehind: budgetSec > 0 ? Math.ceil(behindSec / budgetSec) : 0,
    endDate: scheduleEndDate(roadmap.schedule),
  };

  function resolveStatus(): PaceStatus {
    if (total > 0 && doneSec >= total) return "done";
    if (behindSec > 0) return "behind";
    if (doneSec > dueThroughTodaySec) return "ahead";
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
    if (index === 0 && day.date === today) continue;
    break;
  }
  return streak;
}

export type DayStatus = "cleared" | "partial" | "missed" | "upcoming" | "off";

export type WeekDay = {
  date: DateKey;
  isToday: boolean;
  status: DayStatus;
  plannedSec: number;
  doneSec: number;
  taskCount: number;
};

export type WeekOptions = {
  anchor?: DateKey;
  weekStartsOn?: number;
};

export function getWeek(
  roadmaps: Roadmap[],
  today: DateKey,
  { anchor = today, weekStartsOn = 1 }: WeekOptions = {},
): WeekDay[] {
  return weekOf(anchor, weekStartsOn).map((date) => {
    const views = roadmaps.map((roadmap) => getDayView(roadmap, date));
    const withWork = views.filter((view) => view.tasks.length > 0);

    const plannedSec = withWork.reduce((sum, view) => sum + view.plannedSec, 0);
    const doneSec = withWork.reduce((sum, view) => sum + view.doneSec, 0);
    const taskCount = withWork.reduce((sum, view) => sum + view.tasks.length, 0);

    return {
      date,
      isToday: date === today,
      status: resolveStatus(),
      plannedSec,
      doneSec,
      taskCount,
    };

    function resolveStatus(): DayStatus {
      if (withWork.length === 0) return "off";
      if (withWork.every((view) => view.isCleared)) return "cleared";
      if (doneSec > 0) return "partial";
      return date < today ? "missed" : "upcoming";
    }
  });
}

export function getOverallStreak(roadmaps: Roadmap[], today: DateKey, lookbackDays = 365): number {
  let streak = 0;

  for (let offset = 0; offset < lookbackDays; offset++) {
    const date = addDays(today, -offset);
    const due = roadmaps
      .map((roadmap) => getDayView(roadmap, date))
      .filter((view) => view.tasks.length > 0);

    if (due.length === 0) continue;
    if (due.every((view) => view.isCleared)) {
      streak++;
      continue;
    }
    if (offset === 0) continue;
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
  const planned = plannedTasks(roadmap);
  const done = planned.filter(isComplete);
  const total = totalSec(planned);

  return {
    dayIndex: roadmap.schedule.filter((day) => day.date <= today).length,
    totalDays: roadmap.schedule.length,
    tasksDone: done.length,
    tasksTotal: planned.length,
    fraction: total > 0 ? totalSec(done) / total : 0,
  };
}
