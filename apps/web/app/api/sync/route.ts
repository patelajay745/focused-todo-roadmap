import { roadmapSchema, type Roadmap } from '@ftr/core';
import { completions, createDb, roadmaps } from '@ftr/db';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { deviceIdFrom } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const pushBody = z.object({ roadmaps: z.array(roadmapSchema) });

export async function GET(request: Request) {
  const deviceId = deviceIdFrom(request);
  if (!deviceId) return Response.json({ error: 'Missing device id' }, { status: 401 });

  const rows = await createDb().select().from(roadmaps).where(eq(roadmaps.deviceId, deviceId));

  return Response.json({
    roadmaps: rows.map((row) => ({
      id: row.id,
      title: row.title,
      playlistId: row.playlistId,
      tasks: row.tasks,
      plan: row.plan,
      schedule: row.schedule,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const deviceId = deviceIdFrom(request);
  if (!deviceId) return Response.json({ error: 'Missing device id' }, { status: 401 });

  const parsed = pushBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid payload' }, { status: 400 });

  const db = createDb();
  for (const roadmap of parsed.data.roadmaps) {
    await upsertRoadmap(db, deviceId, roadmap);
  }

  return Response.json({ ok: true, synced: parsed.data.roadmaps.length });
}

async function upsertRoadmap(
  db: ReturnType<typeof createDb>,
  deviceId: string,
  roadmap: Roadmap,
): Promise<void> {
  const row = {
    id: roadmap.id,
    deviceId,
    title: roadmap.title,
    playlistId: roadmap.playlistId,
    tasks: roadmap.tasks,
    plan: roadmap.plan,
    schedule: roadmap.schedule,
    createdAt: new Date(roadmap.createdAt),
    updatedAt: new Date(roadmap.updatedAt),
    syncedAt: new Date(),
  };

  await db
    .insert(roadmaps)
    .values(row)
    .onConflictDoUpdate({ target: roadmaps.id, set: row });

  for (const task of roadmap.tasks) {
    if (task.status !== 'done' || !task.completedAt) continue;

    await db
      .insert(completions)
      .values({
        id: `${roadmap.id}:${task.id}`,
        deviceId,
        roadmapId: roadmap.id,
        taskId: task.id,
        videoId: task.videoId,
        title: task.title,
        completedAt: new Date(task.completedAt),
        auto: task.autoCompleted ? 'auto' : 'manual',
      })
      .onConflictDoNothing();
  }

  const liveTaskIds = new Set(
    roadmap.tasks.filter((task) => task.status === 'done').map((task) => task.id),
  );
  const stored = await db
    .select({ id: completions.id, taskId: completions.taskId })
    .from(completions)
    .where(and(eq(completions.deviceId, deviceId), eq(completions.roadmapId, roadmap.id)));

  for (const row of stored) {
    if (!liveTaskIds.has(row.taskId)) {
      await db.delete(completions).where(eq(completions.id, row.id));
    }
  }
}
