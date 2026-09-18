import type { DateKey } from '@ftr/core';

export function formatDay(date: DateKey): string {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(
    new Date(`${date}T00:00:00`),
  );
}
