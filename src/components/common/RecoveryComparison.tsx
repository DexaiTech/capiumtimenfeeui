import type { ReactNode } from 'react';

import { moneyToneClass } from '@/components/ui/moneyToneClass';
import type { Pence } from '@/types';
import { cn } from '@/utils/cn';
import { formatMoney } from '@/utils/money';
import { describeRecovery, describeShortfall, type RecoveryLine } from '@/utils/recovery';

export interface RecoveryComparisonProps {
  /** Names the panel, for example "Recovery of this invoice". */
  title: string;
  description?: ReactNode;
  /** What the invoice value is: "Invoice value", "This invoice (contract value)". */
  invoiceLabel: string;
  invoiceValue: Pence;
  /** A line under the invoice value: "£1,500.00 invoiced, £0.00 still to bill". */
  invoiceHint?: string;
  /** The bases it is compared with (`compareRecovery`, `recoveryLines`). */
  lines: ReadonlyArray<RecoveryLine>;
  currency: string;
  className?: string;
}

/**
 * An invoice value against what the work would have billed at the task rate, at the staff rates
 * and at cost plus: for each basis the value, the revenue left on the table (red) or the
 * over-recovery (green) and the share recovered.
 */
export function RecoveryComparison({
  title,
  description,
  invoiceLabel,
  invoiceValue,
  invoiceHint,
  lines,
  currency,
  className,
}: RecoveryComparisonProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-card',
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        {description ? <p className="text-xs text-text-muted">{description}</p> : null}
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-xs text-text-muted">{invoiceLabel}</dt>
          <dd className="text-base font-semibold tabular-nums text-text">
            {formatMoney(invoiceValue, currency)}
          </dd>
          {invoiceHint ? <dd className="text-xs text-text-subtle">{invoiceHint}</dd> : null}
        </div>
        {lines.map((line) => {
          const recovered = describeRecovery(line.recoveryBp);
          return (
            <div key={line.basis} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-text-muted" title={line.hint}>
                {line.label}
              </dt>
              <dd className="text-base font-semibold tabular-nums text-text">
                {formatMoney(line.potential, currency)}
              </dd>
              <dd
                className={cn(
                  'text-xs font-medium tabular-nums',
                  moneyToneClass('out', line.shortfall) || 'text-text-muted',
                )}
              >
                {describeShortfall(line.shortfall, currency)}
              </dd>
              {recovered ? <dd className="text-xs text-text-subtle">{recovered}</dd> : null}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
