import type { PlanConfig, Task, TaskStatus } from "../src/types";
import { ALL_WEEKDAYS } from "../src/types";

export function task(id: string, minutes: number, status: TaskStatus = "todo"): Task {
  return {
    id,
    videoId: id.padEnd(11, "x").slice(0, 11),
    playlistId: "PL_test",
    position: Number(id.replace(/\D/g, "")) || 0,
    title: `Video ${id}`,
    durationSec: minutes * 60,
    status,
  };
}

export function tasks(...minutes: number[]): Task[] {
  return minutes.map((m, i) => task(`t${i + 1}`, m));
}

export function budgetPlan(minutesPerDay: number, overrides: Partial<PlanConfig> = {}): PlanConfig {
  return {
    startDate: "2026-01-05",
    mode: { kind: "byBudget", minutesPerDay },
    activeWeekdays: ALL_WEEKDAYS,
    skipDates: [],
    ...overrides,
  };
}

export function datePlan(endDate: string, overrides: Partial<PlanConfig> = {}): PlanConfig {
  return {
    startDate: "2026-01-05",
    mode: { kind: "byDate", endDate },
    activeWeekdays: ALL_WEEKDAYS,
    skipDates: [],
    ...overrides,
  };
}
