import { describe, expect, test } from "bun:test";
import { getDayView, getPace, getProgress, getStreak } from "../src/progress";
import { createRoadmap, markTask } from "../src/roadmap";
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

function doneAt(roadmap: Roadmap, index: number, iso: string): Roadmap {
  return markTask(roadmap, roadmap.tasks[index]!.id, { status: "done", at: new Date(iso) });
}

describe("getPace", () => {
  test("reports on-track when today's work is finished", () => {
    const roadmap = doneAt(roadmapOf([60, 60, 60]), 0, "2026-01-05T10:00:00");
    expect(getPace(roadmap, "2026-01-05").status).toBe("on-track");
  });

  test("reports behind after a skipped day, counting only days that have ended", () => {
    const pace = getPace(roadmapOf([60, 60, 60]), "2026-01-06");
    expect(pace.status).toBe("behind");
    expect(pace.behindSec).toBe(60 * 60);
    expect(pace.daysBehind).toBe(1);
  });

  test("a roadmap starting today is not behind before you have watched anything", () => {
    const pace = getPace(roadmapOf([60, 60, 60]), "2026-01-05");
    expect(pace.status).toBe("on-track");
    expect(pace.behindSec).toBe(0);
    expect(pace.daysBehind).toBe(0);
  });

  test("today's unwatched videos never count as overdue", () => {
    const pace = getPace(roadmapOf([60, 60, 60]), "2026-01-07");
    expect(pace.daysBehind).toBe(2);
    expect(pace.behindSec).toBe(120 * 60);
  });

  test("two missed days read as two days behind", () => {
    const pace = getPace(roadmapOf([60, 60, 60, 60]), "2026-01-08");
    expect(pace.daysBehind).toBe(3);
  });

  test("reports ahead when you work past today's plan", () => {
    let roadmap = roadmapOf([60, 60, 60]);
    roadmap = doneAt(roadmap, 0, "2026-01-05T10:00:00");
    roadmap = doneAt(roadmap, 1, "2026-01-05T11:00:00");
    expect(getPace(roadmap, "2026-01-05").status).toBe("ahead");
  });

  test("reports done when everything is complete", () => {
    let roadmap = roadmapOf([60, 60]);
    roadmap = doneAt(roadmap, 0, "2026-01-05T10:00:00");
    roadmap = doneAt(roadmap, 1, "2026-01-06T10:00:00");
    expect(getPace(roadmap, "2026-01-06").status).toBe("done");
  });

  test("never reports being behind by more than the total work", () => {
    const pace = getPace(roadmapOf([60, 60]), "2030-01-01");
    expect(pace.behindSec).toBe(pace.totalSec);
  });

  test("tracks remaining time", () => {
    const roadmap = doneAt(roadmapOf([60, 30, 30]), 0, "2026-01-05T10:00:00");
    const pace = getPace(roadmap, "2026-01-05");
    expect(pace.doneSec).toBe(60 * 60);
    expect(pace.remainingSec).toBe(60 * 60);
  });
});

describe("getStreak", () => {
  test("counts consecutive cleared days", () => {
    let roadmap = roadmapOf([60, 60, 60]);
    roadmap = doneAt(roadmap, 0, "2026-01-05T10:00:00");
    roadmap = doneAt(roadmap, 1, "2026-01-06T10:00:00");
    roadmap = doneAt(roadmap, 2, "2026-01-07T10:00:00");
    expect(getStreak(roadmap, "2026-01-07")).toBe(3);
  });

  test("an unfinished today does not break a live streak", () => {
    let roadmap = roadmapOf([60, 60, 60]);
    roadmap = doneAt(roadmap, 0, "2026-01-05T10:00:00");
    roadmap = doneAt(roadmap, 1, "2026-01-06T10:00:00");
    expect(getStreak(roadmap, "2026-01-07")).toBe(2);
  });

  test("resets to zero after a missed day", () => {
    let roadmap = roadmapOf([60, 60, 60]);
    roadmap = doneAt(roadmap, 0, "2026-01-05T10:00:00");
    roadmap = doneAt(roadmap, 2, "2026-01-07T10:00:00");
    expect(getStreak(roadmap, "2026-01-07")).toBe(1);
  });

  test("is zero when nothing has been completed", () => {
    expect(getStreak(roadmapOf([60, 60]), "2026-01-06")).toBe(0);
  });

  test("ignores future days", () => {
    const roadmap = doneAt(roadmapOf([60, 60, 60]), 0, "2026-01-05T10:00:00");
    expect(getStreak(roadmap, "2026-01-05")).toBe(1);
  });
});

describe("getDayView", () => {
  test("lists the tasks scheduled for that day", () => {
    const view = getDayView(roadmapOf([20, 20, 20, 60]), "2026-01-05");
    expect(view.tasks).toHaveLength(3);
    expect(view.plannedSec).toBe(60 * 60);
    expect(view.isCleared).toBe(false);
  });

  test("marks a day cleared once every task is complete", () => {
    let roadmap = roadmapOf([30, 30, 60]);
    roadmap = doneAt(roadmap, 0, "2026-01-05T10:00:00");
    roadmap = doneAt(roadmap, 1, "2026-01-05T11:00:00");
    expect(getDayView(roadmap, "2026-01-05").isCleared).toBe(true);
  });

  test("shows work you finished early on the day you actually did it", () => {
    const roadmap = doneAt(roadmapOf([60, 60]), 1, "2026-01-05T20:00:00");
    const view = getDayView(roadmap, "2026-01-05");
    expect(view.tasks.map((t) => t.id)).toContain(roadmap.tasks[1]!.id);
  });

  test("returns an empty view for a day with nothing scheduled", () => {
    const view = getDayView(roadmapOf([60]), "2026-02-01");
    expect(view.tasks).toEqual([]);
    expect(view.isCleared).toBe(false);
  });
});

describe("getProgress", () => {
  test("reports day index and totals", () => {
    const roadmap = doneAt(roadmapOf([60, 60, 60, 60]), 0, "2026-01-05T10:00:00");
    const progress = getProgress(roadmap, "2026-01-06");
    expect(progress.dayIndex).toBe(2);
    expect(progress.totalDays).toBe(4);
    expect(progress.tasksDone).toBe(1);
    expect(progress.fraction).toBeCloseTo(0.25);
  });
});

describe("markTask", () => {
  test("clears completion metadata when reverted to todo", () => {
    let roadmap = doneAt(roadmapOf([60]), 0, "2026-01-05T10:00:00");
    roadmap = markTask(roadmap, roadmap.tasks[0]!.id, { status: "todo" });
    expect(roadmap.tasks[0]!.completedAt).toBeUndefined();
    expect(roadmap.tasks[0]!.status).toBe("todo");
  });

  test("records whether completion was automatic", () => {
    const base = roadmapOf([60, 60]);
    const auto = markTask(base, base.tasks[0]!.id, { status: "done", auto: true });
    const manual = markTask(base, base.tasks[1]!.id, { status: "done" });
    expect(auto.tasks[0]!.autoCompleted).toBe(true);
    expect(manual.tasks[1]!.autoCompleted).toBe(false);
  });

  test("returns the same roadmap when nothing changes", () => {
    const roadmap = roadmapOf([60]);
    expect(markTask(roadmap, "missing-id", { status: "done" })).toBe(roadmap);
    expect(markTask(roadmap, roadmap.tasks[0]!.id, { status: "todo" })).toBe(roadmap);
  });

  test("counts a skipped task as complete for pace purposes", () => {
    const base = roadmapOf([60, 60]);
    const skipped = markTask(base, base.tasks[0]!.id, {
      status: "skipped",
      at: new Date("2026-01-05T10:00:00"),
    });
    expect(getPace(skipped, "2026-01-05").status).toBe("on-track");
    expect(getDayView(skipped, "2026-01-05").isCleared).toBe(true);
  });
});
