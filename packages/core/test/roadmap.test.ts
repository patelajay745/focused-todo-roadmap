import { describe, expect, test } from "bun:test";
import { getDayView } from "../src/progress";
import { createRoadmap } from "../src/roadmap";
import { isActiveDay } from "../src/scheduler";
import type { PlanConfig } from "../src/types";
import { budgetPlan } from "./helpers";

function videos(count: number, minutes = 30) {
  return Array.from({ length: count }, (_, i) => ({
    videoId: `vid${i}`.padEnd(11, "x"),
    title: `Video ${i + 1}`,
    durationSec: minutes * 60,
  }));
}

function build(
  count: number,
  startIndex?: number,
  plan: PlanConfig = budgetPlan(60),
  minutes = 30,
) {
  return createRoadmap({
    title: "Course",
    playlistId: "PL_test",
    videos: videos(count, minutes),
    plan,
    startIndex,
    now: new Date("2026-01-05T09:00:00Z"),
  });
}

const ONE_PER_DAY = 60;

describe("createRoadmap — startIndex", () => {
  test("defaults to scheduling every video", () => {
    const roadmap = build(5);
    expect(roadmap.tasks.every((t) => t.status === "todo")).toBe(true);
    expect(roadmap.schedule.flatMap((d) => d.taskIds)).toHaveLength(5);
  });

  test("marks earlier videos skipped and leaves them unscheduled", () => {
    const roadmap = build(5, 2);
    expect(roadmap.tasks.map((t) => t.status)).toEqual([
      "skipped",
      "skipped",
      "todo",
      "todo",
      "todo",
    ]);
    expect(roadmap.schedule.flatMap((d) => d.taskIds)).toHaveLength(3);
  });

  test("keeps original playlist positions so numbering survives", () => {
    const roadmap = build(5, 2);
    expect(roadmap.tasks.map((t) => t.position)).toEqual([0, 1, 2, 3, 4]);
    expect(roadmap.tasks[2]!.title).toBe("Video 3");
  });

  test("skipped videos never appear in a day view", () => {
    const roadmap = build(5, 2);
    for (const day of roadmap.schedule) {
      const view = getDayView(roadmap, day.date);
      expect(view.tasks.every((t) => t.status === "todo")).toBe(true);
    }
  });

  test("skipped videos carry no completedAt", () => {
    const roadmap = build(5, 2);
    const skipped = roadmap.tasks.filter((t) => t.status === "skipped");
    expect(skipped).toHaveLength(2);
    expect(skipped.every((t) => t.completedAt === undefined)).toBe(true);
  });

  test("the first scheduled task is the chosen start video", () => {
    const roadmap = build(6, 3);
    const firstScheduled = roadmap.schedule[0]!.taskIds[0];
    expect(roadmap.tasks.find((t) => t.id === firstScheduled)!.title).toBe("Video 4");
  });

  test("clamps a start index past the end", () => {
    const roadmap = build(3, 99);
    expect(roadmap.tasks.every((t) => t.status === "skipped")).toBe(true);
    expect(roadmap.schedule).toEqual([]);
  });

  test("clamps a negative start index", () => {
    expect(build(3, -5).tasks.every((t) => t.status === "todo")).toBe(true);
  });
});

describe("createRoadmap — days off", () => {
  test("never schedules a skipped weekday", () => {
    const plan = budgetPlan(60, { activeWeekdays: [1, 2, 3, 4, 5, 0] });
    const roadmap = build(6, 0, plan, ONE_PER_DAY);
    expect(roadmap.schedule.length).toBeGreaterThan(5);
    for (const day of roadmap.schedule) {
      expect(new Date(day.date).getUTCDay()).not.toBe(6);
    }
  });

  test("never schedules an explicit day off", () => {
    const plan = budgetPlan(60, { skipDates: ["2026-01-06", "2026-01-08"] });
    const roadmap = build(4, 0, plan, ONE_PER_DAY);
    expect(roadmap.schedule.map((d) => d.date)).toEqual([
      "2026-01-05",
      "2026-01-07",
      "2026-01-09",
      "2026-01-10",
    ]);
  });

  test("combines weekday and explicit days off", () => {
    const plan = budgetPlan(60, {
      activeWeekdays: [1, 2, 3, 4, 5],
      skipDates: ["2026-01-06"],
    });
    const roadmap = build(3, 0, plan, ONE_PER_DAY);
    expect(roadmap.schedule.map((d) => d.date)).toEqual([
      "2026-01-05",
      "2026-01-07",
      "2026-01-08",
    ]);
    for (const day of roadmap.schedule) expect(isActiveDay(day.date, plan)).toBe(true);
  });
});
