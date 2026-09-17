import { describe, expect, test } from "bun:test";
import { startOfWeek, weekOf } from "../src/dates";
import { getOverallStreak, getWeek } from "../src/progress";
import { createRoadmap, markTask } from "../src/roadmap";
import type { Roadmap } from "../src/types";
import { budgetPlan } from "./helpers";

function build(count = 10, weekdays = [0, 1, 2, 3, 4, 5, 6]): Roadmap {
  return createRoadmap({
    title: "Course",
    playlistId: "PL_test",
    videos: Array.from({ length: count }, (_, i) => ({
      videoId: `v${i}`.padEnd(11, "x"),
      title: `Video ${i + 1}`,
      durationSec: 3600,
    })),
    plan: budgetPlan(60, { startDate: "2026-01-05", activeWeekdays: weekdays }),
    now: new Date("2026-01-05T09:00:00Z"),
  });
}

function done(roadmap: Roadmap, positions: number[], on: (p: number) => string): Roadmap {
  let next = roadmap;
  for (const position of positions) {
    const task = roadmap.tasks.find((t) => t.position === position)!;
    next = markTask(next, task.id, { status: "done", at: new Date(`${on(position)}T10:00:00`) });
  }
  return next;
}

describe("week dates", () => {
  test("startOfWeek defaults to Monday", () => {
    expect(startOfWeek("2026-01-08")).toBe("2026-01-05");
    expect(startOfWeek("2026-01-05")).toBe("2026-01-05");
    expect(startOfWeek("2026-01-11")).toBe("2026-01-05");
  });

  test("startOfWeek can start on Sunday", () => {
    expect(startOfWeek("2026-01-08", 0)).toBe("2026-01-04");
  });

  test("weekOf returns seven consecutive days", () => {
    expect(weekOf("2026-01-08")).toEqual([
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
      "2026-01-08",
      "2026-01-09",
      "2026-01-10",
      "2026-01-11",
    ]);
  });
});

describe("getWeek", () => {
  test("marks days with no scheduled work as off", () => {
    const roadmap = build(3, [1, 2, 3, 4, 5]);
    const week = getWeek([roadmap], "2026-01-07");
    const byDate = new Map(week.map((day) => [day.date, day.status]));
    expect(byDate.get("2026-01-10")).toBe("off");
    expect(byDate.get("2026-01-11")).toBe("off");
  });

  test("marks a fully finished day cleared", () => {
    const roadmap = done(build(5), [0], () => "2026-01-05");
    const week = getWeek([roadmap], "2026-01-07");
    expect(week.find((day) => day.date === "2026-01-05")!.status).toBe("cleared");
  });

  test("marks an unworked past day missed", () => {
    const week = getWeek([build(5)], "2026-01-07");
    expect(week.find((day) => day.date === "2026-01-06")!.status).toBe("missed");
  });

  test("marks a future scheduled day upcoming", () => {
    const week = getWeek([build(5)], "2026-01-05");
    expect(week.find((day) => day.date === "2026-01-08")!.status).toBe("upcoming");
  });

  test("marks a half-finished day partial", () => {
    const roadmap = done(build(6), [0], () => "2026-01-05");
    const week = getWeek(
      [{ ...roadmap, schedule: [{ date: "2026-01-05", taskIds: [roadmap.tasks[0]!.id, roadmap.tasks[1]!.id], plannedSec: 7200 }] }],
      "2026-01-07",
    );
    expect(week.find((day) => day.date === "2026-01-05")!.status).toBe("partial");
  });

  test("flags exactly one day as today", () => {
    const week = getWeek([build(5)], "2026-01-07");
    expect(week.filter((day) => day.isToday).map((day) => day.date)).toEqual(["2026-01-07"]);
  });

  test("aggregates work across roadmaps", () => {
    const week = getWeek([build(3), build(3)], "2026-01-05");
    const monday = week.find((day) => day.date === "2026-01-05")!;
    expect(monday.taskCount).toBe(2);
    expect(monday.plannedSec).toBe(7200);
  });

  test("always returns seven days", () => {
    expect(getWeek([build(3)], "2026-01-07")).toHaveLength(7);
    expect(getWeek([], "2026-01-07")).toHaveLength(7);
  });

  test("an empty roadmap list is all days off", () => {
    expect(getWeek([], "2026-01-07").every((day) => day.status === "off")).toBe(true);
  });

  test("an anchor shows a different week without moving today", () => {
    const week = getWeek([build(10)], "2026-01-14", { anchor: "2026-01-07" });
    expect(week[0]!.date).toBe("2026-01-05");
    expect(week.some((day) => day.isToday)).toBe(false);
  });

  test("past days keep their status when viewed from a later week", () => {
    const roadmap = done(build(5), [0], () => "2026-01-05");
    const week = getWeek([roadmap], "2026-01-20", { anchor: "2026-01-07" });
    const byDate = new Map(week.map((day) => [day.date, day.status]));
    expect(byDate.get("2026-01-05")).toBe("cleared");
    expect(byDate.get("2026-01-06")).toBe("missed");
  });
});

describe("getOverallStreak", () => {
  test("counts consecutive cleared days", () => {
    const roadmap = done(build(5), [0, 1, 2], (p) => `2026-01-0${5 + p}`);
    expect(getOverallStreak([roadmap], "2026-01-07")).toBe(3);
  });

  test("an unfinished today does not break it", () => {
    const roadmap = done(build(5), [0, 1], (p) => `2026-01-0${5 + p}`);
    expect(getOverallStreak([roadmap], "2026-01-07")).toBe(2);
  });

  test("a missed day ends it", () => {
    const roadmap = done(build(5), [0, 2], (p) => `2026-01-0${5 + p}`);
    expect(getOverallStreak([roadmap], "2026-01-07")).toBe(1);
  });

  test("days off do not break it", () => {
    const roadmap = build(3, [1, 2, 3, 4, 5]);
    const worked = done(roadmap, [0, 1], (p) => (p === 0 ? "2026-01-05" : "2026-01-06"));
    expect(getOverallStreak([worked], "2026-01-06")).toBe(2);
  });

  test("requires every roadmap to be clear that day", () => {
    const a = done(build(3), [0], () => "2026-01-05");
    const b = build(3);
    expect(getOverallStreak([a], "2026-01-05")).toBe(1);
    expect(getOverallStreak([a, b], "2026-01-05")).toBe(0);
  });

  test("is zero with nothing done", () => {
    expect(getOverallStreak([build(3)], "2026-01-06")).toBe(0);
    expect(getOverallStreak([], "2026-01-06")).toBe(0);
  });
});
