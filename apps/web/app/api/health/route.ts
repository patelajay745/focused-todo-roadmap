import { createDb } from '@ftr/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await createDb().execute(sql`select 1`);
    return Response.json({ ok: true, database: 'up' });
  } catch (cause) {
    return Response.json(
      { ok: false, database: 'down', error: cause instanceof Error ? cause.message : 'unknown' },
      { status: 503 },
    );
  }
}
