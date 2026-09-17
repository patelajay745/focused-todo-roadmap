export type DateKey = string;

const MS_PER_DAY = 86_400_000;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toUtcMs(key: DateKey): number {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): DateKey {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function isValidDateKey(key: string): boolean {
  return DATE_KEY_PATTERN.test(key) && fromUtcMs(toUtcMs(key)) === key;
}

export function addDays(key: DateKey, days: number): DateKey {
  return fromUtcMs(toUtcMs(key) + days * MS_PER_DAY);
}

export function diffDays(from: DateKey, to: DateKey): number {
  return (toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY;
}

export function weekdayOf(key: DateKey): number {
  return new Date(toUtcMs(key)).getUTCDay();
}

export function maxDateKey(a: DateKey, b: DateKey): DateKey {
  return a >= b ? a : b;
}
