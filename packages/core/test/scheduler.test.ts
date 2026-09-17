import { describe, expect, test } from "bun:test";
import {
  buildSchedule,
  countActiveDays,
  isActiveDay,
  nextActiveDay,
  resolveBudgetSec,
  ScheduleError,
} from "../src/scheduler";
import { budgetPlan, datePlan, task, tasks } from "./helpers";

const minutesOf = (sec: number) => sec / 60;

describe("buildSchedule — budget mode", () => {
  test("never exceeds the daily budget", () => {
    const days = buildSchedule(tasks(20, 20, 20, 20, 20), budgetPlan(60));
    for (const day of days) expect(minutesOf(day.plannedSec)).toBeLessThanOrEqual(60);
  });

  test("packs greedily in playlist order", () => {
    const days = buildSchedule(tasks(20, 20, 20, 20, 20), budgetPlan(60));
    expect(days.map((d) => d.taskIds)).toEqual([
      ["t1", "t2", "t3"],
      ["t4", "t5"],
    ]);
  });

  test("keeps course order rather than optimally filling days", () => {
    const days = buildSchedule(tasks(50, 10, 50, 10), budgetPlan(60));
    expect(days.map((d) => d.taskIds)).toEqual([
      ["t1", "t2"],
      ["t3", "t4"],
    ]);
  });

  test("a video longer than the budget gets its own day instead of looping", () => {
    const days = buildSchedule([task("t1", 10), task("t2", 200), task("t3", 10)], budgetPlan(60));
    expect(days.map((d) => d.taskIds)).toEqual([["t1"], ["t2"], ["t3"]]);
    expect(minutesOf(days[1]!.plannedSec)).toBe(200);
  });

  test("assigns consecutive calendar days", () => {
    const days = buildSchedule(tasks(60, 60, 60), budgetPlan(60));
    expect(days.map((d) => d.date)).toEqual(["2026-01-05", "2026-01-06", "2026-01-07"]);
  });

  test("returns an empty schedule for no tasks", () => {
    expect(buildSchedule([], budgetPlan(60))).toEqual([]);
  });

  test("plannedSec equals the sum of that day's tasks", () => {
    const days = buildSchedule(tasks(20, 15, 40), budgetPlan(60));
    expect(days[0]!.plannedSec).toBe(35 * 60);
    expect(days[1]!.plannedSec).toBe(40 * 60);
  });
});

describe("buildSchedule — inactive days", () => {
  test("skips weekends when they are not active weekdays", () => {
    const plan = budgetPlan(60, { activeWeekdays: [1, 2, 3, 4, 5] });
    const days = buildSchedule(tasks(60, 60, 60, 60, 60, 60), plan);
    expect(days.map((d) => d.date)).toEqual([
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
      "2026-01-08",
      "2026-01-09",
      "2026-01-12",
    ]);
  });

  test("skips explicit skipDates", () => {
    const plan = budgetPlan(60, { skipDates: ["2026-01-06", "2026-01-07"] });
    const days = buildSchedule(tasks(60, 60), plan);
    expect(days.map((d) => d.date)).toEqual(["2026-01-05", "2026-01-08"]);
  });

  test("starts on the next active day when startDate is inactive", () => {
    const plan = budgetPlan(60, { startDate: "2026-01-10", activeWeekdays: [1, 2, 3, 4, 5] });
    expect(buildSchedule(tasks(60), plan)[0]!.date).toBe("2026-01-12");
  });

  test("isActiveDay respects both weekday and skip rules", () => {
    const plan = budgetPlan(60, { activeWeekdays: [1, 2, 3, 4, 5], skipDates: ["2026-01-07"] });
    expect(isActiveDay("2026-01-05", plan)).toBe(true);
    expect(isActiveDay("2026-01-07", plan)).toBe(false);
    expect(isActiveDay("2026-01-10", plan)).toBe(false);
  });

  test("countActiveDays excludes inactive days and inverted ranges", () => {
    const plan = budgetPlan(60, { activeWeekdays: [1, 2, 3, 4, 5] });
    expect(countActiveDays("2026-01-05", "2026-01-11", plan)).toBe(5);
    expect(countActiveDays("2026-01-11", "2026-01-05", plan)).toBe(0);
  });

  test("nextActiveDay returns the same day when it is already active", () => {
    expect(nextActiveDay("2026-01-05", budgetPlan(60))).toBe("2026-01-05");
  });
});

describe("resolveBudgetSec — byDate mode", () => {
  test("fits the work inside the requested number of days", () => {
    const plan = datePlan("2026-01-06");
    const days = buildSchedule(tasks(10, 10, 10), plan);
    expect(days.length).toBeLessThanOrEqual(2);
    expect(days.at(-1)!.date <= "2026-01-06").toBe(true);
  });

  test("handles the case where dividing total by days would overflow", () => {
    const plan = datePlan("2026-01-06");
    expect(minutesOf(resolveBudgetSec(tasks(10, 10, 10), plan))).toBe(20);
  });

  test("finds the smallest budget that still fits", () => {
    const plan = datePlan("2026-01-07");
    const budget = resolveBudgetSec(tasks(30, 30, 30, 30, 30), plan);
    expect(minutesOf(budget)).toBe(60);
  });

  test("one task per day needs only the longest task as budget", () => {
    const plan = datePlan("2026-01-09");
    expect(minutesOf(resolveBudgetSec(tasks(30, 30, 30, 30, 30), plan))).toBe(30);
  });

  test("never returns a budget below the longest single video", () => {
    const plan = datePlan("2026-02-05");
    const budget = resolveBudgetSec([task("t1", 90), task("t2", 5)], plan);
    expect(minutesOf(budget)).toBeGreaterThanOrEqual(90);
  });

  test("respects inactive weekdays when counting available days", () => {
    const plan = datePlan("2026-01-11", { activeWeekdays: [1, 2, 3, 4, 5] });
    const days = buildSchedule(tasks(30, 30, 30, 30, 30), plan);
    expect(days.length).toBeLessThanOrEqual(5);
    for (const day of days) expect([1, 2, 3, 4, 5]).toContain(new Date(day.date).getUTCDay());
  });

  test("an end date in the past collapses to a single catch-up day", () => {
    const plan = datePlan("2025-12-01");
    expect(buildSchedule(tasks(10, 10, 10), plan)).toHaveLength(1);
  });

  test("zero-length task lists need no budget", () => {
    expect(resolveBudgetSec([], datePlan("2026-01-10"))).toBe(0);
  });
});

describe("scheduler errors", () => {
  test("rejects a plan with no active weekdays", () => {
    const plan = budgetPlan(60, { activeWeekdays: [] });
    expect(() => buildSchedule(tasks(60), plan)).toThrow(ScheduleError);
  });

  test("rejects a non-positive budget", () => {
    expect(() => buildSchedule(tasks(60), budgetPlan(0))).toThrow(ScheduleError);
  });
});
