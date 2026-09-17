import { describe, expect, test } from "bun:test";
import { getPace, getProgress } from "../src/progress";
import { createRoadmap, markTask } from "../src/roadmap";
import type { Roadmap } from "../src/types";
import { budgetPlan } from "./helpers";

function build(count: number, startIndex?: number): Roadmap {
  return createRoadmap({
    title: "Course",
    playlistId: "PL_test",
    videos: Array.from({ length: count }, (_, i) => ({
      videoId: `v${i}`.padEnd(11, "x"),
      title: `Video ${i + 1}`,
      durationSec: 3600,
    })),
    plan: budgetPlan(60),
    startIndex,
    now: new Date("2026-01-05T09:00:00Z"),
  });
}

describe("skipped videos are outside the plan", () => {
  test("a roadmap that starts partway in begins at zero percent", () => {
    expect(getProgress(build(6, 3), "2026-01-05").fraction).toBe(0);
  });

  test("skipped videos are not counted as watched time", () => {
    expect(getPace(build(6, 3), "2026-01-05").doneSec).toBe(0);
  });

  test("skipping the first videos does not make you look ahead", () => {
    expect(getPace(build(6, 3), "2026-01-06").status).toBe("behind");
  });

  test("totals cover only the videos actually planned", () => {
    const pace = getPace(build(6, 3), "2026-01-05");
    expect(pace.totalSec).toBe(3 * 3600);
    expect(pace.remainingSec).toBe(3 * 3600);
  });

  test("task counts exclude skipped videos", () => {
    const progress = getProgress(build(6, 3), "2026-01-05");
    expect(progress.tasksTotal).toBe(3);
    expect(progress.tasksDone).toBe(0);
  });

  test("watching planned videos still advances progress", () => {
    let roadmap = build(6, 3);
    const first = roadmap.tasks.find((task) => task.status === "todo")!;
    roadmap = markTask(roadmap, first.id, { status: "done", at: new Date("2026-01-05T10:00:00") });

    const progress = getProgress(roadmap, "2026-01-05");
    expect(progress.tasksDone).toBe(1);
    expect(progress.fraction).toBeCloseTo(1 / 3);
    expect(getPace(roadmap, "2026-01-05").status).toBe("on-track");
  });

  test("a roadmap with nothing skipped is unaffected", () => {
    const roadmap = build(4);
    expect(getProgress(roadmap, "2026-01-05").tasksTotal).toBe(4);
    expect(getPace(roadmap, "2026-01-05").totalSec).toBe(4 * 3600);
  });

  test("finishing every planned video reports done", () => {
    let roadmap = build(5, 2);
    for (const task of roadmap.tasks.filter((t) => t.status === "todo")) {
      roadmap = markTask(roadmap, task.id, { status: "done", at: new Date("2026-01-08T10:00:00") });
    }
    expect(getPace(roadmap, "2026-01-08").status).toBe("done");
    expect(getProgress(roadmap, "2026-01-08").fraction).toBe(1);
  });
});
