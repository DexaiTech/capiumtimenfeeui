import { cn } from '@/utils/cn';

export interface SummaryItem {
  label: string;
  value: string;
  /** A short line under the value. */
  hint?: string;
  /** Bad news (overdue money): the value is red. */
  alert?: boolean;
}

export interface SummaryStripProps {
  /** Names the strip for assistive technology, for example "Invoice totals". */
  label: string;
  items: ReadonlyArray<SummaryItem>;
}

/** The totals above a tab's table: a few figures that do not depend on how many rows are loaded. */
export function SummaryStrip({ label, items }: SummaryStripProps) {
  return (
    <dl
      aria-label={label}
      className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]"
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-border bg-surface px-4 py-3 shadow-card"
        >
          <dt className="text-xs font-medium text-text-muted">{item.label}</dt>
          <dd
            className={cn(
              'text-lg font-semibold tabular-nums',
              item.alert ? 'text-danger' : 'text-text',
            )}
          >
            {item.value}
          </dd>
          {item.hint ? <dd className="text-xs text-text-muted">{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
