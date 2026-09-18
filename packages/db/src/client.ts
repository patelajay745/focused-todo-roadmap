import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { databaseUrl } from './config';
import * as schema from './schema';

export function createDb(override?: string) {
  return drizzle({ client: new SQL(databaseUrl(override)), schema });
}

export type Database = ReturnType<typeof createDb>;
