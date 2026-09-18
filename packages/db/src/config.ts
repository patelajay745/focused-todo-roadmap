export const DEFAULT_DATABASE_URL = 'postgres://focused:focused@localhost:5005/focused';

export function databaseUrl(override?: string): string {
  return override ?? process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}
