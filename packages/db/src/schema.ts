import type { DayPlan, PlanConfig, Task } from '@ftr/core';
import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const roadmaps = pgTable(
  'roadmaps',
  {
    id: text('id').primaryKey(),
    deviceId: text('device_id').notNull(),
    title: text('title').notNull(),
    playlistId: text('playlist_id').notNull(),
    tasks: jsonb('tasks').$type<Task[]>().notNull(),
    plan: jsonb('plan').$type<PlanConfig>().notNull(),
    schedule: jsonb('schedule').$type<DayPlan[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('roadmaps_device_idx').on(table.deviceId)],
);

export const completions = pgTable(
  'completions',
  {
    id: text('id').primaryKey(),
    deviceId: text('device_id').notNull(),
    roadmapId: text('roadmap_id').notNull(),
    taskId: text('task_id').notNull(),
    videoId: text('video_id').notNull(),
    title: text('title').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
    auto: text('auto').notNull(),
  },
  (table) => [
    index('completions_device_idx').on(table.deviceId),
    index('completions_roadmap_idx').on(table.roadmapId),
  ],
);

export type RoadmapRow = typeof roadmaps.$inferSelect;
export type NewRoadmapRow = typeof roadmaps.$inferInsert;
export type CompletionRow = typeof completions.$inferSelect;
