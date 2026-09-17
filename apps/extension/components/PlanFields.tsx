import { ALL_WEEKDAYS, addDays, type PlanConfig } from '@ftr/core';
import { CrossCross } from 'pikaicons';
import { useState } from 'react';
import { Button, Field, Input } from './ui';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export type PlanDraft = {
  startDate: string;
  modeKind: 'byBudget' | 'byDate';
  minutesPerDay: number;
  endDate: string;
  weekdays: number[];
  daysOff: string[];
};

export function newPlanDraft(today: string): PlanDraft {
  return {
    startDate: today,
    modeKind: 'byBudget',
    minutesPerDay: 60,
    endDate: addDays(today, 30),
    weekdays: ALL_WEEKDAYS,
    daysOff: [],
  };
}

export function draftFromPlan(plan: PlanConfig): PlanDraft {
  return {
    startDate: plan.startDate,
    modeKind: plan.mode.kind,
    minutesPerDay: plan.mode.kind === 'byBudget' ? plan.mode.minutesPerDay : 60,
    endDate: plan.mode.kind === 'byDate' ? plan.mode.endDate : addDays(plan.startDate, 30),
    weekdays: plan.activeWeekdays,
    daysOff: plan.skipDates,
  };
}

export function planFromDraft(draft: PlanDraft): PlanConfig {
  return {
    startDate: draft.startDate,
    mode:
      draft.modeKind === 'byBudget'
        ? { kind: 'byBudget', minutesPerDay: draft.minutesPerDay }
        : { kind: 'byDate', endDate: draft.endDate },
    activeWeekdays: draft.weekdays,
    skipDates: draft.daysOff,
  };
}

export function describeDaysOff(activeWeekdays: number[]): string {
  const off = ALL_WEEKDAYS.filter((day) => !activeWeekdays.includes(day)).map(
    (day) => WEEKDAY_NAMES[day]!,
  );

  if (off.length === 0) return 'Studying every day — no weekly day off.';
  if (off.length === 7) return 'Every day is off, so nothing can be scheduled.';

  const list = off.length === 1 ? off[0]! : `${off.slice(0, -1).join(', ')} and ${off.at(-1)!}`;
  return `Off every ${list}. This applies to this playlist only.`;
}

export function PlanFields({
  draft,
  onChange,
}: {
  draft: PlanDraft;
  onChange: (next: PlanDraft) => void;
}) {
  const [dayOffDraft, setDayOffDraft] = useState('');

  function patch(changes: Partial<PlanDraft>) {
    onChange({ ...draft, ...changes });
  }

  function toggleWeekday(day: number) {
    patch({
      weekdays: draft.weekdays.includes(day)
        ? draft.weekdays.filter((d) => d !== day)
        : [...draft.weekdays, day].sort(),
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date">
          <Input
            type="date"
            value={draft.startDate}
            onChange={(event) => patch({ startDate: event.target.value })}
          />
        </Field>

        <Field label="Pace">
          <div className="flex gap-2">
            <Button
              variant={draft.modeKind === 'byBudget' ? 'primary' : 'ghost'}
              onClick={() => patch({ modeKind: 'byBudget' })}
              className="flex-1"
            >
              Per day
            </Button>
            <Button
              variant={draft.modeKind === 'byDate' ? 'primary' : 'ghost'}
              onClick={() => patch({ modeKind: 'byDate' })}
              className="flex-1"
            >
              By date
            </Button>
          </div>
        </Field>
      </div>

      {draft.modeKind === 'byBudget' ? (
        <Field label="Minutes per day">
          <Input
            type="number"
            min={5}
            step={5}
            value={draft.minutesPerDay}
            onChange={(event) => patch({ minutesPerDay: Math.max(5, Number(event.target.value)) })}
          />
        </Field>
      ) : (
        <Field label="Finish by">
          <Input
            type="date"
            value={draft.endDate}
            onChange={(event) => patch({ endDate: event.target.value })}
          />
        </Field>
      )}

      <Field label="Study days" hint={describeDaysOff(draft.weekdays)}>
        <div className="flex gap-1.5">
          {WEEKDAY_LABELS.map((label, day) => (
            <button
              key={day}
              onClick={() => toggleWeekday(day)}
              aria-pressed={draft.weekdays.includes(day)}
              aria-label={WEEKDAY_NAMES[day]}
              className={`h-9 w-9 rounded-lg text-sm transition ${
                draft.weekdays.includes(day)
                  ? 'bg-accent text-surface font-medium'
                  : 'border border-white/10 text-ink-muted hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Days off" hint="Specific dates to skip — travel, exams, anything.">
        <div className="flex gap-2">
          <Input
            type="date"
            value={dayOffDraft}
            onChange={(event) => setDayOffDraft(event.target.value)}
          />
          <Button
            variant="ghost"
            disabled={!dayOffDraft || draft.daysOff.includes(dayOffDraft)}
            onClick={() => {
              patch({ daysOff: [...draft.daysOff, dayOffDraft].sort() });
              setDayOffDraft('');
            }}
          >
            Add
          </Button>
        </div>
        {draft.daysOff.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {draft.daysOff.map((date) => (
              <li key={date}>
                <button
                  onClick={() => patch({ daysOff: draft.daysOff.filter((d) => d !== date) })}
                  aria-label={`Remove day off ${date}`}
                  className="flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-xs text-ink-muted hover:border-warn/40 hover:text-warn"
                >
                  {date}
                  <CrossCross className="h-3 w-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Field>
    </>
  );
}
