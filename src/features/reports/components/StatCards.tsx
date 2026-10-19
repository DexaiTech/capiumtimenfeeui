import { Card } from '@/components/ui';
import { cn } from '@/utils/cn';

export interface Stat {
  label: string;
  value: string;
  hint?: string;
  /** Draws the figure in the danger colour (money that is overdue, a target missed). */
  danger?: boolean;
}

/** A row of headline figures: the label, the value and a line of context under it. */
export function StatCards({
  label,
  stats,
  className,
}: {
  /** Names the group of figures for assistive technology. */
  label: string;
  stats: ReadonlyArray<Stat>;
  className?: string;
}) {
  return (
    <dl aria-label={label} className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
      {stats.map((stat) => (
        <Card key={stat.label} padding="sm" className="flex flex-col gap-1">
          <dt className="text-xs text-text-muted">{stat.label}</dt>
          <dd
            className={cn(
              'text-xl font-semibold tabular-nums',
              stat.danger ? 'text-danger' : 'text-text',
            )}
          >
            {stat.value}
          </dd>
          {stat.hint ? <p className="text-2xs text-text-subtle">{stat.hint}</p> : null}
        </Card>
      ))}
    </dl>
  );
}
