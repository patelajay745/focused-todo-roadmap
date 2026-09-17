import { addDays, maxDateKey, weekdayOf, type DateKey } from "./dates";
import { totalSec, type DayPlan, type PlanConfig, type Roadmap, type Task } from "./types";

const MAX_SCHEDULE_DAYS = 3650;

export class ScheduleError extends Error {}

export function isActiveDay(date: DateKey, plan: PlanConfig): boolean {
  return plan.activeWeekdays.includes(weekdayOf(date)) && !plan.skipDates.includes(date);
}

export function nextActiveDay(from: DateKey, plan: PlanConfig): DateKey {
  for (let i = 0; i < MAX_SCHEDULE_DAYS; i++) {
    const candidate = addDays(from, i);
    if (isActiveDay(candidate, plan)) return candidate;
  }
  throw new ScheduleError("No active day found within 10 years of " + from);
}

export function countActiveDays(from: DateKey, to: DateKey, plan: PlanConfig): number {
  if (to < from) return 0;
  let count = 0;
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    if (isActiveDay(cursor, plan)) count++;
  }
  return count;
}

function packSequential(tasks: Task[], budgetSec: number): Task[][] {
  const chunks: Task[][] = [];
  let current: Task[] = [];
  let currentSec = 0;

  for (const task of tasks) {
    if (current.length > 0 && currentSec + task.durationSec > budgetSec) {
      chunks.push(current);
      current = [];
      currentSec = 0;
    }
    current.push(task);
    currentSec += task.durationSec;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function resolveBudgetSec(tasks: Task[], plan: PlanConfig): number {
  if (plan.activeWeekdays.length === 0) {
    throw new ScheduleError("Plan has no active weekdays");
  }

  if (plan.mode.kind === "byBudget") {
    return Math.round(plan.mode.minutesPerDay * 60);
  }

  const total = totalSec(tasks);
  if (total === 0) return 0;

  const start = nextActiveDay(plan.startDate, plan);
  const end = maxDateKey(plan.mode.endDate, start);
  const dayCount = countActiveDays(start, end, plan);
  if (dayCount < 1) {
    throw new ScheduleError(`No active days between ${start} and ${end}`);
  }

  const longestTask = Math.max(...tasks.map((t) => t.durationSec));

  let lo = Math.max(longestTask, 1);
  let hi = Math.max(total, lo);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (packSequential(tasks, mid).length <= dayCount) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export function buildSchedule(tasks: Task[], plan: PlanConfig): DayPlan[] {
  if (tasks.length === 0) return [];

  const budgetSec = resolveBudgetSec(tasks, plan);
  if (budgetSec <= 0) {
    throw new ScheduleError("Daily budget must be greater than zero");
  }

  const chunks = packSequential(tasks, budgetSec);
  const days: DayPlan[] = [];
  let cursor = nextActiveDay(plan.startDate, plan);

  for (const chunk of chunks) {
    days.push({
      date: cursor,
      taskIds: chunk.map((t) => t.id),
      plannedSec: totalSec(chunk),
    });
    cursor = nextActiveDay(addDays(cursor, 1), plan);
  }

  return days;
}

export type RescheduleMode = "catchUp" | "relax";

export function scheduleEndDate(schedule: DayPlan[]): DateKey | null {
  return schedule.length > 0 ? schedule[schedule.length - 1]!.date : null;
}

export function reschedule(roadmap: Roadmap, today: DateKey, mode: RescheduleMode): Roadmap {
  const remaining = roadmap.tasks.filter((t) => t.status === "todo");
  const history = roadmap.schedule.filter((day) => day.date < today);

  if (remaining.length === 0) {
    return { ...roadmap, schedule: history };
  }

  const start = nextActiveDay(today, roadmap.plan);
  const plan: PlanConfig = { ...roadmap.plan, startDate: start, mode: buildMode() };

  return { ...roadmap, plan, schedule: [...history, ...buildSchedule(remaining, plan)] };

  function buildMode(): PlanConfig["mode"] {
    if (mode === "relax") {
      const budgetSec = resolveBudgetSec(roadmap.tasks, roadmap.plan);
      return { kind: "byBudget", minutesPerDay: budgetSec / 60 };
    }
    const currentEnd = scheduleEndDate(roadmap.schedule);
    return { kind: "byDate", endDate: maxDateKey(currentEnd ?? start, start) };
  }
}

export type ReschedulePreview = {
  mode: RescheduleMode;
  minutesPerDay: number;
  endDate: DateKey;
  activeDays: number;
};

export function previewReschedule(roadmap: Roadmap, today: DateKey): ReschedulePreview[] {
  return (["catchUp", "relax"] as const).flatMap((mode) => {
    const next = reschedule(roadmap, today, mode);
    const remaining = next.tasks.filter((t) => t.status === "todo");
    const future = next.schedule.filter((day) => day.date >= today);
    const endDate = scheduleEndDate(next.schedule);
    if (remaining.length === 0 || endDate === null) return [];
    return [
      {
        mode,
        minutesPerDay: Math.round(resolveBudgetSec(remaining, next.plan) / 60),
        endDate,
        activeDays: future.length,
      },
    ];
  });
}
