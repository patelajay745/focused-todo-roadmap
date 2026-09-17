import { formatDuration, type DateKey, type WeekDay } from '@ftr/core';
import { CheckTick, ChevronLeft, ChevronRight, CrossCross } from 'pikaicons';

const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const TONE: Record<WeekDay['status'], string> = {
  cleared: 'border-accent/50 bg-accent/12 text-accent',
  partial: 'border-accent/30 bg-accent/6 text-accent',
  missed: 'border-warn/40 bg-warn/8 text-warn',
  upcoming: 'border-white/10 text-ink-muted',
  off: 'border-transparent text-ink-muted/35',
};

export function WeekStrip({
  days,
  selected,
  onSelect,
  onShiftWeek,
}: {
  days: WeekDay[];
  selected: DateKey;
  onSelect: (date: DateKey) => void;
  onShiftWeek: (offset: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => onShiftWeek(-1)}
          aria-label="Previous week"
          className="rounded-lg p-1 text-ink-muted transition hover:bg-white/5 hover:text-ink"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <span className="text-xs text-ink-muted">{rangeLabel(days)}</span>
        <button
          onClick={() => onShiftWeek(1)}
          aria-label="Next week"
          className="rounded-lg p-1 text-ink-muted transition hover:bg-white/5 hover:text-ink"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <ul className="grid grid-cols-7 gap-1.5">
        {days.map((day, index) => (
          <li key={day.date}>
            <button
              onClick={() => onSelect(day.date)}
              title={describe(day)}
              aria-current={day.date === selected ? 'date' : undefined}
              className={`flex w-full flex-col items-center gap-1 rounded-xl border px-1 py-2.5 transition hover:bg-white/5 ${
                TONE[day.status]
              } ${
                day.date === selected
                  ? 'ring-2 ring-accent/70 ring-offset-2 ring-offset-surface'
                  : ''
              }`}
            >
              <span className="text-xs text-ink-muted">{DAY_INITIALS[index]}</span>
              <span
                className={`text-base tabular-nums ${
                  day.isToday ? 'font-bold text-ink underline underline-offset-4' : 'font-medium text-ink'
                }`}
              >
                {Number(day.date.slice(-2))}
              </span>
              <Marker day={day} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Marker({ day }: { day: WeekDay }) {
  if (day.status === 'cleared') return <CheckTick className="h-3.5 w-3.5" aria-hidden />;
  if (day.status === 'missed') return <CrossCross className="h-3.5 w-3.5" aria-hidden />;
  if (day.status === 'off') return <span className="text-xs">·</span>;

  return (
    <span className="text-xs tabular-nums">{formatDuration(day.plannedSec - day.doneSec)}</span>
  );
}

function rangeLabel(days: WeekDay[]): string {
  const first = days[0]?.date;
  const last = days.at(-1)?.date;
  if (!first || !last) return '';

  const month = (date: string) =>
    new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(`${date}T00:00:00`));
  const day = (date: string) => Number(date.slice(-2));

  return month(first) === month(last)
    ? `${day(first)}–${day(last)} ${month(first)}`
    : `${day(first)} ${month(first)} – ${day(last)} ${month(last)}`;
}

function describe(day: WeekDay): string {
  if (day.status === 'off') return `${day.date} — no session`;
  const planned = formatDuration(day.plannedSec);
  if (day.status === 'cleared') return `${day.date} — done, ${planned}`;
  if (day.status === 'missed') return `${day.date} — missed, ${planned}`;
  if (day.status === 'partial') {
    return `${day.date} — ${formatDuration(day.doneSec)} of ${planned} done`;
  }
  return `${day.date} — ${planned} planned`;
}
