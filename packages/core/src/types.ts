import { z } from "zod";

export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const taskStatusSchema = z.enum(["todo", "done", "skipped"]);

export const taskSchema = z.object({
  id: z.string(),
  videoId: z.string(),
  playlistId: z.string(),
  position: z.number().int().nonnegative(),
  title: z.string(),
  durationSec: z.number().int().nonnegative(),
  status: taskStatusSchema,
  completedAt: z.string().optional(),
  autoCompleted: z.boolean().optional(),
});

export const planModeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("byDate"), endDate: dateKeySchema }),
  z.object({ kind: z.literal("byBudget"), minutesPerDay: z.number().positive() }),
]);

export const planConfigSchema = z.object({
  startDate: dateKeySchema,
  mode: planModeSchema,
  activeWeekdays: z.array(z.number().int().min(0).max(6)).min(1),
  skipDates: z.array(dateKeySchema),
});

export const dayPlanSchema = z.object({
  date: dateKeySchema,
  taskIds: z.array(z.string()),
  plannedSec: z.number().int().nonnegative(),
});

export const roadmapSchema = z.object({
  id: z.string(),
  title: z.string(),
  playlistId: z.string(),
  tasks: z.array(taskSchema),
  plan: planConfigSchema,
  schedule: z.array(dayPlanSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type Task = z.infer<typeof taskSchema>;
export type PlanMode = z.infer<typeof planModeSchema>;
export type PlanConfig = z.infer<typeof planConfigSchema>;
export type DayPlan = z.infer<typeof dayPlanSchema>;
export type Roadmap = z.infer<typeof roadmapSchema>;

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export function isComplete(task: Task): boolean {
  return task.status === "done" || task.status === "skipped";
}

export function totalSec(tasks: Task[]): number {
  return tasks.reduce((sum, task) => sum + task.durationSec, 0);
}
