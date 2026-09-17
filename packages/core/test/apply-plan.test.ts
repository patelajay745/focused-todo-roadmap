import { describe, expect, test } from "bun:test";
import { markTask } from "../src/roadmap";
import { applyPlan, scheduleEndDate } from "../src/scheduler";
import { createRoadmap } from "../src/roadmap";
import type { PlanConfig, Roadmap } from "../src/types";
import { budgetPlan } from "./helpers";

function build(count = 6, minutes = 60): Roadmap {
  return createRoadmap({
    title: "Course",
    playlistId: "PL_test",
    videos: Array.from({ length: count }, (_, i) => ({
      videoId: `v${i}`.padEnd(11, "x"),
      title: `Video ${i + 1}`,
      durationSec: minutes * 60,
    })),
    plan: budgetPlan(60),
    now: new Date("2026-01-05T09:00:00Z"),
  });
}

function futureDays(roadmap: Roadmap, today: string): string[] {
  return roadmap.schedule.filter((day) => day.date >= today).map((day) => day.date);
}

function withDone(roadmap: Roadmap, count: number, on: string): Roadmap {
  let next = roadmap;
  for (const task of roadmap.tasks.slice(0, count)) {
    next = markTask(next, task.id, { status: "done", at: new Date(`${on}T10:00:00`) });
  }
  return next;
}

describe("applyPlan", () => {
  test("re-packs remaining work under a new pace", () => {
    const roadmap = build(6);
    const faster: PlanConfig = { ...roadmap.plan, mode: { kind: "byBudget", minutesPerDay: 180 } };
    const next = applyPlan(roadmap, faster, "2026-01-05");
    expect(next.schedule).toHaveLength(2);
  });

  test("keeps completed days untouched", () => {
    const roadmap = withDone(build(6), 2, "2026-01-05");
    const before = roadmap.schedule.filter((day) => day.date < "2026-01-07");
    const next = applyPlan(roadmap, roadmap.plan, "2026-01-07");
    expect(next.schedule.filter((day) => day.date < "2026-01-07")).toEqual(before);
  });

  test("only reschedules unfinished videos", () => {
    const roadmap = withDone(build(6), 2, "2026-01-05");
    const next = applyPlan(roadmap, roadmap.plan, "2026-01-07");
    const future = next.schedule
      .filter((day) => day.date >= "2026-01-07")
      .flatMap((day) => day.taskIds);
    expect(future).toHaveLength(4);
    for (const id of future) {
      expect(next.tasks.find((task) => task.id === id)!.status).toBe("todo");
    }
  });

  test("honours newly added days off", () => {
    const roadmap = build(3);
    const withDaysOff: PlanConfig = { ...roadmap.plan, skipDates: ["2026-01-06", "2026-01-07"] };
    const next = applyPlan(roadmap, withDaysOff, "2026-01-05");
    expect(next.schedule.map((day) => day.date)).toEqual([
      "2026-01-05",
      "2026-01-08",
      "2026-01-09",
    ]);
  });

  test("honours newly removed study weekdays", () => {
    const roadmap = build(3);
    const weekdaysOnly: PlanConfig = { ...roadmap.plan, activeWeekdays: [1, 2, 3, 4, 5] };
    const next = applyPlan(roadmap, weekdaysOnly, "2026-01-05");
    for (const day of next.schedule) {
      expect([0, 6]).not.toContain(new Date(day.date).getUTCDay());
    }
  });

  test("switching to a deadline pulls the end date in", () => {
    const roadmap = build(6);
    const byDate: PlanConfig = { ...roadmap.plan, mode: { kind: "byDate", endDate: "2026-01-07" } };
    const next = applyPlan(roadmap, byDate, "2026-01-05");
    expect(scheduleEndDate(next.schedule)! <= "2026-01-07").toBe(true);
  });

  test("a past start date is pulled forward to today", () => {
    const roadmap = build(3);
    const stale: PlanConfig = { ...roadmap.plan, startDate: "2025-06-01" };
    const next = applyPlan(roadmap, stale, "2026-01-10");
    expect(next.plan.startDate).toBe("2026-01-10");
    expect(futureDays(next, "2026-01-10")[0]).toBe("2026-01-10");
  });

  test("a future start date is respected", () => {
    const roadmap = build(3);
    const later: PlanConfig = { ...roadmap.plan, startDate: "2026-02-01" };
    const next = applyPlan(roadmap, later, "2026-01-10");
    expect(futureDays(next, "2026-01-10")[0]).toBe("2026-02-01");
  });

  test("days that already passed unworked stay on the record", () => {
    const roadmap = build(3);
    const next = applyPlan(roadmap, roadmap.plan, "2026-01-10");
    expect(next.schedule.some((day) => day.date < "2026-01-10")).toBe(true);
  });

  test("a finished roadmap keeps its history and takes the new plan", () => {
    const roadmap = withDone(build(2), 2, "2026-01-05");
    const next = applyPlan(roadmap, { ...roadmap.plan, skipDates: ["2026-01-09"] }, "2026-01-07");
    expect(next.plan.skipDates).toEqual(["2026-01-09"]);
    expect(next.schedule.every((day) => day.date < "2026-01-07")).toBe(true);
  });

  test("never drops or duplicates unfinished work", () => {
    const roadmap = withDone(build(6), 2, "2026-01-05");
    const next = applyPlan(roadmap, roadmap.plan, "2026-01-07");
    const future = next.schedule
      .filter((day) => day.date >= "2026-01-07")
      .flatMap((day) => day.taskIds);
    expect(new Set(future).size).toBe(4);
  });
});
