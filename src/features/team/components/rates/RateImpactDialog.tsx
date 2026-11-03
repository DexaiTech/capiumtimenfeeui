import { ConfirmDialog, type ConfirmDialogError } from '@/components/ui';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import type { RateImpact } from '../../types';
import { formatPeriod, formatRate, plural } from '../../utils/format';
import { formatDelta, skipSummary } from '../../utils/rerate';

export interface RateImpactDialogProps {
  /** What saving would do (`POST /rates/impact`); null keeps the dialog closed. */
  impact: RateImpact | null;
  /** "Ada Smith's new cost rate of £50.00/h" */
  subject: string;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
  error: ConfirmDialogError | null;
}

/**
 * Asks before a rate is saved that changes the rates around it or the price of recorded time:
 * which rates end where, the new rate's period, and the unbilled time that will be re-priced.
 */
export function RateImpactDialog({
  impact,
  subject,
  onConfirm,
  onClose,
  loading,
  error,
}: RateImpactDialogProps) {
  if (!impact) return null;
  const { ends, stops_at: stopsAt, reprice, skipped } = impact;
  const leftAlone = skipSummary(skipped);
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={onConfirm}
      title="Change the rates?"
      confirmLabel="Change rates"
      tone="default"
      loading={loading}
      error={error}
    >
      <p>
        {subject} will apply{' '}
        <strong className="font-medium text-text">
          {formatPeriod(impact.effective_from, impact.effective_to)}
        </strong>
        .
      </p>
      {ends || stopsAt ? (
        <ul aria-label="Rates that change" className="list-disc pl-5">
          {ends ? (
            <li>
              The {formatRate(ends.rate)} rate from {formatUkDate(ends.effective_from)} ends on{' '}
              {formatUkDate(ends.new_effective_to)}.
            </li>
          ) : null}
          {stopsAt ? (
            <li>
              The {formatRate(stopsAt.rate)} rate from {formatUkDate(stopsAt.effective_from)} stays
              as it is, so the new rate ends the day before it.
            </li>
          ) : null}
        </ul>
      ) : null}
      {reprice.entries_to_change > 0 ? (
        <p>
          <strong className="font-medium text-text">
            {plural(reprice.entries_to_change, 'unbilled entry', 'unbilled entries')}
          </strong>{' '}
          in this period will be re-priced. The charge-out value goes from{' '}
          {formatMoney(reprice.charge_value_before)} to {formatMoney(reprice.charge_value_after)} (
          {formatDelta(reprice.charge_value_delta)})
          {reprice.cost_value_delta !== null
            ? `; the cost value changes by ${formatDelta(reprice.cost_value_delta)}`
            : ''}
          .
        </p>
      ) : (
        <p>No unbilled time in this period changes price.</p>
      )}
      {leftAlone ? <p>Left alone: {leftAlone}.</p> : null}
      <p>The change is recorded in the rate history and the audit log.</p>
    </ConfirmDialog>
  );
}
