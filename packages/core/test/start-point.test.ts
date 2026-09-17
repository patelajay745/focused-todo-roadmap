import { describe, expect, test } from "bun:test";
import { createRoadmap, markTask, startPositionOf, withStartPoint } from "../src/roadmap";
import { applyPlan } from "../src/scheduler";
import type { Roadmap } from "../src/types";
import { budgetPlan } from "./helpers";

function build(count = 6, startIndex?: number): Roadmap {
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

const statuses = (roadmap: Roadmap) => roadmap.tasks.map((task) => task.status);

describe("withStartPoint", () => {
  test("moving the start point forward skips earlier videos", () => {
    expect(statuses(withStartPoint(build(5), 2))).toEqual([
      "skipped",
      "skipped",
      "todo",
      "todo",
      "todo",
    ]);
  });

  test("moving the start point back restores skipped videos", () => {
    const roadmap = build(5, 3);
    expect(statuses(withStartPoint(roadmap, 1))).toEqual([
      "skipped",
      "todo",
      "todo",
      "todo",
      "todo",
    ]);
  });

  test("never un-watches a completed video", () => {
    let roadmap = build(5);
    roadmap = markTask(roadmap, roadmap.tasks[0]!.id, { status: "done" });
    roadmap = markTask(roadmap, roadmap.tasks[1]!.id, { status: "done" });

    const moved = withStartPoint(roadmap, 3);
    expect(statuses(moved)).toEqual(["done", "done", "skipped", "todo", "todo"]);
  });

  test("keeps completedAt on videos it leaves alone", () => {
    let roadmap = build(3);
    roadmap = markTask(roadmap, roadmap.tasks[0]!.id, {
      status: "done",
      at: new Date("2026-01-05T10:00:00Z"),
    });
    const moved = withStartPoint(roadmap, 2);
    expect(moved.tasks[0]!.completedAt).toBe(roadmap.tasks[0]!.completedAt);
  });

  test("start point of zero plans everything", () => {
    expect(statuses(withStartPoint(build(4, 2), 0))).toEqual(["todo", "todo", "todo", "todo"]);
  });

  test("start point past the end skips everything unwatched", () => {
    expect(statuses(withStartPoint(build(3), 99))).toEqual(["skipped", "skipped", "skipped"]);
  });

  test("is idempotent", () => {
    const once = withStartPoint(build(5), 2);
    expect(statuses(withStartPoint(once, 2))).toEqual(statuses(once));
  });

  test("replanning after a move schedules exactly the unskipped videos", () => {
    const moved = withStartPoint(build(6), 2);
    const replanned = applyPlan(moved, moved.plan, "2026-01-05");
    const scheduled = replanned.schedule.flatMap((day) => day.taskIds);
    expect(new Set(scheduled).size).toBe(4);
    for (const id of scheduled) {
      expect(replanned.tasks.find((task) => task.id === id)!.status).toBe("todo");
    }
  });
});

describe("startPositionOf", () => {
  test("reports the first unskipped video", () => {
    expect(startPositionOf(build(5))).toBe(0);
    expect(startPositionOf(build(5, 3))).toBe(3);
  });

  test("round-trips through withStartPoint", () => {
    expect(startPositionOf(withStartPoint(build(6), 4))).toBe(4);
  });

  test("reports the length when everything is skipped", () => {
    expect(startPositionOf(withStartPoint(build(3), 99))).toBe(3);
  });
});
