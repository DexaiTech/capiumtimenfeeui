import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button, DateField } from '@/components/ui';

export interface PeriodNavigatorProps {
  /** What is shown now: "12/10/2026 – 18/10/2026", "October 2026", "Monday 12/10/2026". */
  label: string;
  /** "week", "day" or "month": names the buttons ("Previous week"). */
  unit: 'day' | 'week' | 'month';
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  /** The text of the button that returns to now ("This week"). */
  todayLabel: string;
  /** Any day of the period shown: the date field jumps to another one. */
  date: string;
  onDateChange: (date: string) => void;
}

/** Previous and next, back to now, and a date to jump to: the period switch of a timesheet page. */
export function PeriodNavigator({
  label,
  unit,
  onPrevious,
  onNext,
  onToday,
  todayLabel,
  date,
  onDateChange,
}: PeriodNavigatorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" aria-label={`Previous ${unit}`} onClick={onPrevious}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <p
          aria-live="polite"
          className="min-w-44 px-2 text-center text-sm font-semibold text-text tabular-nums"
        >
          {label}
        </p>
        <Button variant="outline" size="icon" aria-label={`Next ${unit}`} onClick={onNext}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <Button variant="outline" size="sm" onClick={onToday}>
        {todayLabel}
      </Button>
      <DateField
        label="Go to date"
        hideLabel
        value={date}
        onChange={(next) => {
          if (next) onDateChange(next);
        }}
        className="w-40"
      />
    </div>
  );
}
