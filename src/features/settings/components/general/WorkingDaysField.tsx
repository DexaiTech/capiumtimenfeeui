import { useId } from 'react';

import { WEEKDAYS } from '@/features/organizations';
import { cn } from '@/utils/cn';

export interface WorkingDaysFieldProps {
  value: number[];
  onChange: (days: number[]) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
}

/** The working days of the week as pressable buttons, Monday first. */
export function WorkingDaysField({
  value,
  onChange,
  onBlur,
  error,
  disabled,
}: WorkingDaysFieldProps) {
  const labelId = useId();
  const errorId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-sm font-medium text-text">
        Working days
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={error ? errorId : undefined}
        className="grid grid-cols-7 gap-1 sm:flex sm:flex-wrap sm:gap-2"
      >
        {WEEKDAYS.map((day) => {
          const pressed = value.includes(day.value);
          return (
            <button
              key={day.value}
              type="button"
              aria-pressed={pressed}
              aria-label={day.label}
              disabled={disabled}
              onClick={() =>
                onChange(
                  pressed
                    ? value.filter((entry) => entry !== day.value)
                    : [...value, day.value].sort((a, b) => a - b),
                )
              }
              onBlur={onBlur}
              className={cn(
                'flex h-11 items-center justify-center rounded-md border text-sm font-medium sm:w-14 md:h-9',
                'transition-colors duration-fast ease-standard disabled:opacity-60',
                pressed
                  ? 'border-brand bg-brand-soft text-brand-text'
                  : 'border-border bg-surface text-text-muted hover:border-border-strong hover:text-text',
              )}
            >
              {day.short}
            </button>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
