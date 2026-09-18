import { SQL } from 'bun';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { databaseUrl } from './config';

const MIGRATIONS_DIR = join(import.meta.dir, '..', 'drizzle');

export async function migrate(override?: string): Promise<string[]> {
  const sql = new SQL(databaseUrl(override));
  await sql`CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;

  const applied = new Set(
    (await sql`SELECT name FROM _migrations`).map((row: { name: string }) => row.name),
  );

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;

    const statements = (await Bun.file(join(MIGRATIONS_DIR, file)).text())
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) await sql.unsafe(statement);
    await sql`INSERT INTO _migrations (name) VALUES (${file})`;
    ran.push(file);
  }

  await sql.end();
  return ran;
}

if (import.meta.main) {
  const ran = await migrate();
  console.log(ran.length > 0 ? `applied: ${ran.join(', ')}` : 'already up to date');
}
