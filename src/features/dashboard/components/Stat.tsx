import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

import type { CardComparison, CardUnit, DashboardPeriod } from '../types';
import { comparisonLabel, describeChange } from '../utils/format';

export interface StatGridProps {
  /** Accessible name of the group of figures. */
  label: string;
  children: ReactNode;
  className?: string;
}

/** A row of key figures of a page: each a label, a value and a small line under it. */
export function StatGrid({ label, children, className }: StatGridProps) {
  return (
    <dl aria-label={label} className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
      {children}
    </dl>
  );
}

export interface StatProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

export function Stat({ label, value, hint }: StatProps) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-surface-hover/50 px-3 py-2.5">
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className="text-lg font-semibold text-text tabular-nums">{value}</dd>
      {hint ? <p className="text-2xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

export interface ChangeHintProps {
  comparison: CardComparison;
  unit: CardUnit;
  period: DashboardPeriod;
  /** Which way is good news; neutral shows no colour. */
  better?: 'up' | 'down' | 'neutral';
}

/** "Up 36.8% since the start of the month": an arrow, a hidden word and the size of the move. */
export function ChangeHint({ comparison, unit, period, better = 'neutral' }: ChangeHintProps) {
  const change = describeChange(comparison, unit);
  const good =
    change.direction === 'flat' || better === 'neutral'
      ? null
      : (change.direction === 'up') === (better === 'up');
  const Icon =
    change.direction === 'up' ? ArrowUp : change.direction === 'down' ? ArrowDown : Minus;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium',
        good === null ? 'text-text-muted' : good ? 'text-success' : 'text-danger',
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {change.direction === 'up' ? <span className="sr-only">Up</span> : null}
      {change.direction === 'down' ? <span className="sr-only">Down</span> : null}
      {change.text} {comparisonLabel(comparison.basis, period)}
    </span>
  );
}
