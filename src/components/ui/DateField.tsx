import { useId, type Ref } from 'react';

import { cn } from '@/utils/cn';
import { todayHere } from '@/utils/dates';

import { Button } from './Button';
import { datePresets } from './dateRangePresets';
import { Input, type InputProps } from './Input';

export interface DateFieldProps extends Omit<
  InputProps,
  'value' | 'onChange' | 'type' | 'min' | 'max'
> {
  /** A calendar date as `YYYY-MM-DD`, or null. */
  value: string | null;
  onChange: (value: string | null) => void;
  min?: string | null;
  max?: string | null;
  ref?: Ref<HTMLInputElement>;
}

/** A labelled native date input. The platform picker is the most usable one on touch devices. */
export function DateField({ value, onChange, min, max, ...rest }: DateFieldProps) {
  return (
    <Input
      {...rest}
      type="date"
      value={value ?? ''}
      min={min ?? undefined}
      max={max ?? undefined}
      onChange={(event) => onChange(event.target.value || null)}
    />
  );
}

export interface DateRange {
  from: string | null;
  to: string | null;
}

export interface DateRangeFieldProps {
  /** Name of the range, for example "Due date". */
  label: string;
  value: DateRange;
  onChange: (value: DateRange) => void;
  fromLabel?: string;
  toLabel?: string;
  /** Hides the visible legend; the two inputs keep their accessible names. */
  hideLabel?: boolean;
  /** Short visible text before the inputs (for example "Due") when the legend is hidden. */
  prefix?: string;
  /**
   * Today (`YYYY-MM-DD`, in the practice's zone): when given, buttons fill the range with
   * this week, last week, this month or last month in one click.
   */
  presetsFrom?: string;
  /** The practice's first day of the week, 1 (Monday) to 7 (Sunday); Monday when left out. */
  weekStartsOn?: number;
  /**
   * An empty end of the range shows today, so "up to today" is what the person sees. It is only
   * shown: nothing is filtered until a date is picked, which for dates in the past is the same
   * result. Turn it off for dates that look ahead (due dates).
   */
  endsToday?: boolean;
  error?: string;
  className?: string;
}

/** Two date inputs for an inclusive range. Each end limits the other. */
export function DateRangeField({
  label,
  value,
  onChange,
  fromLabel = 'from',
  toLabel = 'to',
  hideLabel = false,
  prefix,
  presetsFrom,
  weekStartsOn,
  endsToday = true,
  error,
  className,
}: DateRangeFieldProps) {
  const errorId = useId();
  const today = todayHere();
  const shownTo = value.to ?? (endsToday && (!value.from || value.from <= today) ? today : null);
  return (
    <fieldset className={cn('flex max-w-full min-w-0 flex-col gap-1.5', className)}>
      <legend className={cn('mb-1.5 text-sm font-medium text-text', hideLabel && 'sr-only')}>
        {label}
      </legend>
      <div className="flex min-w-0 items-center gap-2">
        {prefix ? (
          <span aria-hidden="true" className="hidden shrink-0 text-sm text-text-muted sm:inline">
            {prefix}
          </span>
        ) : null}
        <DateField
          label={`${label} ${fromLabel}`}
          hideLabel
          value={value.from}
          max={value.to}
          onChange={(from) => onChange({ ...value, from })}
          aria-describedby={error ? errorId : undefined}
          className="min-w-0 flex-1"
        />
        <span aria-hidden="true" className="text-sm text-text-subtle">
          –
        </span>
        <DateField
          label={`${label} ${toLabel}`}
          hideLabel
          value={shownTo}
          min={value.from}
          onChange={(to) => onChange({ ...value, to })}
          aria-describedby={error ? errorId : undefined}
          className="min-w-0 flex-1"
        />
      </div>
      {presetsFrom ? (
        <div role="group" aria-label={`${label}, quick ranges`} className="flex flex-wrap gap-1.5">
          {datePresets(presetsFrom, weekStartsOn).map((preset) => (
            <Button
              key={preset.label}
              size="sm"
              variant="ghost"
              onClick={() => onChange({ from: preset.from, to: preset.to })}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
