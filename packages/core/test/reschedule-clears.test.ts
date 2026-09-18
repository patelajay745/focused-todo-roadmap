import { describe, expect, test } from "bun:test";
import { getPace, getWeek } from "../src/progress";
import { getOverallStreak } from "../src/progress";
import { createRoadmap, markTask } from "../src/roadmap";
import { reschedule } from "../src/scheduler";
import type { Roadmap } from "../src/types";
import { budgetPlan } from "./helpers";

function build(count = 8): Roadmap {
  return createRoadmap({
    title: "Course",
    playlistId: "PL_test",
    videos: Array.from({ length: count }, (_, i) => ({
      videoId: `v${i}`.padEnd(11, "x"),
      title: `Video ${i + 1}`,
      durationSec: 3600,
    })),
    plan: budgetPlan(60),
    now: new Date("2026-01-05T09:00:00Z"),
  });
}

function withFirstDone(roadmap: Roadmap): Roadmap {
  return markTask(roadmap, roadmap.tasks[0]!.id, {
    status: "done",
    at: new Date("2026-01-05T20:00:00"),
  });
}

describe("rescheduling clears the behind state", () => {
  test("a neglected roadmap reports behind", () => {
    expect(getPace(withFirstDone(build()), "2026-01-09").status).toBe("behind");
  });

  test("catching up puts you back on track", () => {
    const roadmap = withFirstDone(build());
    const next = reschedule(roadmap, "2026-01-09", "catchUp");
    expect(getPace(next, "2026-01-09").status).toBe("on-track");
    expect(getPace(next, "2026-01-09").daysBehind).toBe(0);
  });

  test("pushing the deadline also puts you back on track", () => {
    const roadmap = withFirstDone(build());
    const next = reschedule(roadmap, "2026-01-09", "relax");
    expect(getPace(next, "2026-01-09").status).toBe("on-track");
  });

  test("the missed days stay visible in the week", () => {
    const roadmap = withFirstDone(build());
    const next = reschedule(roadmap, "2026-01-09", "catchUp");
    const week = getWeek([next], "2026-01-09", { anchor: "2026-01-05" });
    const byDate = new Map(week.map((day) => [day.date, day.status]));
    expect(byDate.get("2026-01-06")).toBe("missed");
    expect(byDate.get("2026-01-07")).toBe("missed");
  });

  test("rescheduling does not restore a broken streak", () => {
    const roadmap = withFirstDone(build());
    const next = reschedule(roadmap, "2026-01-09", "catchUp");
    expect(getOverallStreak([next], "2026-01-09")).toBe(0);
  });

  test("falling behind again after a reschedule reports behind again", () => {
    const roadmap = withFirstDone(build());
    const next = reschedule(roadmap, "2026-01-09", "catchUp");
    expect(getPace(next, "2026-01-14").status).toBe("behind");
  });

  test("work still owed from before today keeps counting as behind", () => {
    const roadmap = withFirstDone(build());
    expect(getPace(roadmap, "2026-01-09").daysBehind).toBeGreaterThan(0);
  });

  test("completed history is untouched by a reschedule", () => {
    const roadmap = withFirstDone(build());
    const next = reschedule(roadmap, "2026-01-09", "catchUp");
    expect(next.tasks[0]!.status).toBe("done");
    expect(next.tasks[0]!.completedAt).toBe(roadmap.tasks[0]!.completedAt);
  });
});
