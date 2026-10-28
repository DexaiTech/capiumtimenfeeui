import { Plus, X } from 'lucide-react';
import { useId, useState } from 'react';

import { Button, Input, Select } from '@/components/ui';

import {
  describeReminderDay,
  normaliseDays,
  REMINDER_AFTER_MAX,
  REMINDER_BEFORE_MAX,
  REMINDER_STEPS_MAX,
} from '../../utils/reminderSchedule';

type When = 'before' | 'on' | 'after';

const WHEN_OPTIONS: ReadonlyArray<{ value: When; label: string }> = [
  { value: 'before', label: 'days before the due date' },
  { value: 'on', label: 'on the due date' },
  { value: 'after', label: 'days after the due date' },
];

export interface ReminderScheduleFieldProps {
  value: ReadonlyArray<number>;
  onChange: (days: number[]) => void;
  disabled?: boolean;
  error?: string;
}

/**
 * The days on which a client is reminded about an unpaid invoice, counted from its due date:
 * before it, on it, or after it. Each day is one chip; "Add a reminder" puts a new one in order.
 * The reminders stop when the invoice is paid.
 */
export function ReminderScheduleField({
  value,
  onChange,
  disabled = false,
  error,
}: ReminderScheduleFieldProps) {
  const headingId = useId();
  const [when, setWhen] = useState<When>('after');
  const [count, setCount] = useState('7');
  const [problem, setProblem] = useState<string | null>(null);
  const days = normaliseDays(value);

  const add = () => {
    let day = 0;
    if (when !== 'on') {
      const parsed = Number(count.trim());
      const max = when === 'before' ? REMINDER_BEFORE_MAX : REMINDER_AFTER_MAX;
      if (!/^\d{1,3}$/.test(count.trim()) || parsed < 1 || parsed > max) {
        setProblem(`Enter a number of days from 1 to ${String(max)}.`);
        return;
      }
      day = when === 'before' ? -parsed : parsed;
    }
    if (days.includes(day)) {
      setProblem(`${describeReminderDay(day)} is already in the list.`);
      return;
    }
    if (days.length >= REMINDER_STEPS_MAX) {
      setProblem(`Up to ${String(REMINDER_STEPS_MAX)} reminders.`);
      return;
    }
    setProblem(null);
    onChange(normaliseDays([...days, day]));
  };

  return (
    <div role="group" aria-labelledby={headingId} className="flex flex-col gap-2">
      <span id={headingId} className="text-xs font-medium text-text">
        Reminder days
      </span>
      {days.length > 0 ? (
        <ul aria-label="Reminder days" className="flex flex-wrap gap-2">
          {days.map((day) => (
            <li
              key={day}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-sunken py-1 pr-1 pl-3 text-xs font-medium text-text"
            >
              {describeReminderDay(day)}
              <button
                type="button"
                aria-label={`Remove: ${describeReminderDay(day)}`}
                disabled={disabled}
                onClick={() => onChange(days.filter((entry) => entry !== day))}
                className="inline-flex size-5 items-center justify-center rounded-full text-text-muted hover:bg-surface-hover hover:text-text disabled:opacity-50"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-muted">No reminder days yet.</p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        {when !== 'on' ? (
          <Input
            label="Number of days"
            hideLabel
            inputMode="numeric"
            autoComplete="off"
            placeholder="7"
            className="w-20"
            disabled={disabled}
            value={count}
            onChange={(event) => {
              setCount(event.target.value);
              setProblem(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                add();
              }
            }}
          />
        ) : null}
        <Select
          label="When"
          hideLabel
          options={WHEN_OPTIONS}
          className="w-56"
          disabled={disabled}
          value={when}
          onChange={(event) => {
            setWhen(event.target.value as When);
            setProblem(null);
          }}
        />
        <Button
          size="sm"
          disabled={disabled}
          onClick={add}
          leftIcon={<Plus aria-hidden="true" className="size-4" />}
        >
          Add a reminder
        </Button>
      </div>
      {(problem ?? error) ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {problem ?? error}
        </p>
      ) : (
        <p className="text-xs text-text-muted">
          Each day is counted from the invoice&apos;s due date. A client is reminded on each of
          these days until the invoice is paid: a friendly note before or on the due date, a
          reminder after it.
        </p>
      )}
    </div>
  );
}
