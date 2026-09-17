import { describe, expect, test } from "bun:test";
import { getPace } from "../src/progress";
import { previewReschedule, reschedule, scheduleEndDate } from "../src/scheduler";
import { createRoadmap } from "../src/roadmap";
import type { Roadmap } from "../src/types";
import { budgetPlan } from "./helpers";

function roadmapOf(minutes: number[], minutesPerDay = 60): Roadmap {
  return createRoadmap({
    title: "LLD",
    playlistId: "PL_test",
    videos: minutes.map((m, i) => ({
      videoId: `vid${i}`.padEnd(11, "x"),
      title: `Video ${i + 1}`,
      durationSec: m * 60,
    })),
    plan: budgetPlan(minutesPerDay),
    now: new Date("2026-01-05T09:00:00Z"),
  });
}

function markDone(roadmap: Roadmap, count: number): Roadmap {
  return {
    ...roadmap,
    tasks: roadmap.tasks.map((t, i) =>
      i < count ? { ...t, status: "done" as const, completedAt: "2026-01-05T10:00:00Z" } : t,
    ),
  };
}

describe("reschedule", () => {
  test("preserves days before today verbatim", () => {
    const roadmap = markDone(roadmapOf([60, 60, 60, 60]), 1);
    const next = reschedule(roadmap, "2026-01-07", "relax");
    expect(next.schedule.filter((d) => d.date < "2026-01-07")).toEqual(
      roadmap.schedule.filter((d) => d.date < "2026-01-07"),
    );
  });

  test("only re-packs todo tasks", () => {
    const roadmap = markDone(roadmapOf([60, 60, 60, 60]), 2);
    const next = reschedule(roadmap, "2026-01-07", "relax");
    const rescheduledIds = next.schedule
      .filter((d) => d.date >= "2026-01-07")
      .flatMap((d) => d.taskIds);
    expect(rescheduledIds).toEqual([roadmap.tasks[2]!.id, roadmap.tasks[3]!.id]);
  });

  test("every unfinished task lands somewhere from today onward", () => {
    const roadmap = markDone(roadmapOf([30, 30, 30, 30, 30]), 2);
    const next = reschedule(roadmap, "2026-01-07", "catchUp");
    const future = new Set(
      next.schedule.filter((d) => d.date >= "2026-01-07").flatMap((d) => d.taskIds),
    );
    for (const todo of next.tasks.filter((t) => t.status === "todo")) {
      expect(future.has(todo.id)).toBe(true);
    }
    expect(next.tasks).toHaveLength(5);
  });

  test("a missed day keeps its record without inflating how far behind you are", () => {
    const roadmap = markDone(roadmapOf([30, 30, 30, 30, 30]), 2);
    const next = reschedule(roadmap, "2026-01-07", "catchUp");
    const missed = next.schedule.find((d) => d.date === "2026-01-06");
    expect(missed?.taskIds).not.toHaveLength(0);
    expect(getPace(next, "2026-01-07").behindSec).toBeLessThanOrEqual(
      getPace(next, "2026-01-07").totalSec,
    );
  });

  test("catchUp keeps the original end date", () => {
    const roadmap = roadmapOf([60, 60, 60, 60]);
    const originalEnd = scheduleEndDate(roadmap.schedule);
    const next = reschedule(roadmap, "2026-01-07", "catchUp");
    expect(scheduleEndDate(next.schedule)).toBe(originalEnd!);
  });

  test("catchUp raises the daily budget when you fall behind", () => {
    const roadmap = roadmapOf([60, 60, 60, 60]);
    const next = reschedule(roadmap, "2026-01-07", "catchUp");
    expect(next.plan.mode.kind).toBe("byDate");
    const perDay = next.schedule.filter((d) => d.date >= "2026-01-07");
    expect(perDay.length).toBeLessThan(4);
  });

  test("relax keeps the budget and pushes the end date out", () => {
    const roadmap = roadmapOf([60, 60, 60, 60]);
    const originalEnd = scheduleEndDate(roadmap.schedule)!;
    const next = reschedule(roadmap, "2026-01-07", "relax");
    expect(next.plan.mode).toEqual({ kind: "byBudget", minutesPerDay: 60 });
    expect(scheduleEndDate(next.schedule)! > originalEnd).toBe(true);
  });

  test("a fully completed roadmap keeps only its history", () => {
    const roadmap = markDone(roadmapOf([60, 60]), 2);
    const next = reschedule(roadmap, "2026-01-07", "catchUp");
    expect(next.schedule.every((d) => d.date < "2026-01-07")).toBe(true);
  });

  test("starts on the next active day when today is inactive", () => {
    const roadmap = createRoadmap({
      title: "LLD",
      playlistId: "PL_test",
      videos: [{ videoId: "vid0xxxxxxx", title: "V", durationSec: 3600 }],
      plan: budgetPlan(60, { activeWeekdays: [1, 2, 3, 4, 5] }),
      now: new Date("2026-01-05T09:00:00Z"),
    });
    const next = reschedule(roadmap, "2026-01-10", "relax");
    expect(next.schedule.at(-1)!.date).toBe("2026-01-12");
  });
});

describe("previewReschedule", () => {
  test("offers both catchUp and relax", () => {
    const preview = previewReschedule(roadmapOf([60, 60, 60, 60]), "2026-01-07");
    expect(preview.map((p) => p.mode)).toEqual(["catchUp", "relax"]);
  });

  test("catchUp costs more minutes per day but finishes no later", () => {
    const preview = previewReschedule(roadmapOf([60, 60, 60, 60]), "2026-01-07");
    const [catchUp, relax] = preview as [(typeof preview)[0], (typeof preview)[0]];
    expect(catchUp.minutesPerDay).toBeGreaterThan(relax.minutesPerDay);
    expect(catchUp.endDate <= relax.endDate).toBe(true);
  });

  test("offers nothing when there is no work left", () => {
    expect(previewReschedule(markDone(roadmapOf([60, 60]), 2), "2026-01-07")).toEqual([]);
  });
});
