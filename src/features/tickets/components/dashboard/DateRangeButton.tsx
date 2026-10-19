import { CalendarDays, ChevronDown } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button, DateField, Popover } from '@/components/ui';
import { formatDayMonthYear } from '@/utils/dates';

import { RANGE_PRESETS, rangeProblem, type DateSpan } from '../../utils/range';

export interface DateRangeButtonProps {
  /** The range the dashboard shows now (the API's own when none was chosen). */
  range: DateSpan;
  /** Today in the practice's time zone: what the presets count back from. */
  today: string;
  onApply: (range: DateSpan) => void;
}

function RangeForm({
  range,
  today,
  onApply,
  onCancel,
}: DateRangeButtonProps & { onCancel: () => void }) {
  const [from, setFrom] = useState<string | null>(range.from);
  const [to, setTo] = useState<string | null>(range.to);
  const problem = rangeProblem(from, to);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!problem && from && to) onApply({ from, to });
      }}
      className="flex flex-col gap-4 p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <DateField label="From" value={from} max={to} onChange={setFrom} />
        <DateField label="To" value={to} min={from} onChange={setTo} />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-text-muted">Quick ranges</p>
        <div className="flex flex-wrap gap-1.5">
          {RANGE_PRESETS.map((preset) => {
            const span = preset.span(today);
            const selected = span.from === from && span.to === to;
            return (
              <Button
                key={preset.id}
                size="sm"
                variant={selected ? 'brand-outline' : 'outline'}
                aria-pressed={selected}
                onClick={() => {
                  setFrom(span.from);
                  setTo(span.to);
                }}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>
      </div>
      {problem ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {problem}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={problem !== null}>
          Apply
        </Button>
      </div>
    </form>
  );
}

/**
 * The button at the top right of the dashboard: the range in view (`30-Sep-2026 · 18-Oct-2026`).
 * It opens a popover with two date fields and quick ranges; Apply sends the range to the page.
 */
export function DateRangeButton({ range, today, onApply }: DateRangeButtonProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  return (
    <>
      <Button
        ref={anchorRef}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        leftIcon={<CalendarDays aria-hidden="true" className="size-4" />}
        rightIcon={<ChevronDown aria-hidden="true" className="size-3.5" />}
      >
        {formatDayMonthYear(range.from)} · {formatDayMonthYear(range.to)}
      </Button>
      <Popover
        open={open}
        onClose={close}
        anchorRef={anchorRef}
        label="Choose the dates"
        align="end"
        className="w-[22rem]"
      >
        <RangeForm
          range={range}
          today={today}
          onApply={(next) => {
            onApply(next);
            close();
          }}
          onCancel={close}
        />
      </Popover>
    </>
  );
}
