import { WEEKDAYS } from '@/features/organizations';
import { cn } from '@/utils/cn';

export interface WorkingDaysFieldProps {
  /** ISO weekdays, 1 = Monday. */
  value: ReadonlyArray<number>;
  onChange: (days: number[]) => void;
  error?: string;
  className?: string;
}

/** The days of the week a person works, as seven labelled checkboxes. */
export function WorkingDaysField({ value, onChange, error, className }: WorkingDaysFieldProps) {
  const toggle = (day: number, on: boolean) => {
    const next = on ? [...value, day] : value.filter((entry) => entry !== day);
    onChange([...new Set(next)].sort((a, b) => a - b));
  };
  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <legend className="mb-1.5 text-sm font-medium text-text">Working days</legend>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAYS.map((day) => {
          const checked = value.includes(day.value);
          return (
            <label
              key={day.value}
              className={cn(
                'inline-flex h-11 min-w-12 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-medium md:h-9',
                'transition-colors duration-fast ease-standard focus-within:ring-2 focus-within:ring-primary',
                checked
                  ? 'border-primary bg-primary text-primary-fg'
                  : 'border-border bg-surface text-text hover:border-border-strong',
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={(event) => toggle(day.value, event.target.checked)}
              />
              <span aria-hidden="true">{day.short}</span>
              <span className="sr-only">{day.label}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
