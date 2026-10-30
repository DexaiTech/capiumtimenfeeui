/**
 * The recovery analysis in words and figures (`docs/modules/reports.md`, "Recovery analysis"):
 * the bases an invoice value is compared with, the revenue left on the table on each and the
 * recovery. Shared by the client's Invoices & Recovery, the invoicing screen and the report.
 */
import type { BasisPoints, Pence, RecoveryFigures, RecoveryPotentials } from '@/types';

import { formatBasisPoints, formatMoney } from './money';

export type RecoveryBasis = 'task' | 'staff' | 'cost_plus';

/** One basis the invoice value is compared with. */
export interface RecoveryLine {
  basis: RecoveryBasis;
  label: string;
  /** How the basis is worked out, in a few words. */
  hint: string;
  /** What the work would bill on this basis. */
  potential: Pence;
  /** `potential − invoice`: left on the table when positive, over-recovered when negative. */
  shortfall: Pence;
  /** `invoice / potential` in basis points; null when the potential is 0. */
  recoveryBp: BasisPoints | null;
}

export const RECOVERY_LABELS: Record<RecoveryBasis, string> = {
  task: 'At the task rate',
  staff: 'At staff rates',
  cost_plus: 'Cost plus',
};

export const RECOVERY_HINTS: Record<RecoveryBasis, string> = {
  task: 'Hours × the rate of the job or service (the rates the time was priced at)',
  staff: 'Hours × each person’s own charge-out rate',
  cost_plus: 'What the team cost, plus the practice’s mark-up',
};

/** `part / whole` in basis points, rounded half away from zero as the API rounds; null for 0. */
export function recoveryBasisPoints(part: Pence, whole: Pence): BasisPoints | null {
  if (whole === 0) return null;
  const exact = (part * 10_000) / whole;
  return Math.sign(exact) * Math.round(Math.abs(exact));
}

function line(
  basis: RecoveryBasis,
  potential: Pence,
  invoice: Pence,
  markupBp: number,
): RecoveryLine {
  return {
    basis,
    label:
      basis === 'cost_plus'
        ? `${RECOVERY_LABELS.cost_plus} ${formatBasisPoints(markupBp)}`
        : RECOVERY_LABELS[basis],
    hint: RECOVERY_HINTS[basis],
    potential,
    shortfall: potential - invoice,
    recoveryBp: recoveryBasisPoints(invoice, potential),
  };
}

/**
 * The bases against an invoice value worked out on screen (the invoicing screen, where the value
 * depends on the basis the invoice is valued on). Cost plus is left out when cost is hidden.
 */
export function compareRecovery(
  potentials: RecoveryPotentials,
  invoice: Pence,
  markupBp: number,
): RecoveryLine[] {
  const lines = [
    line('task', potentials.task_value, invoice, markupBp),
    line('staff', potentials.staff_value, invoice, markupBp),
  ];
  if (potentials.cost_plus_value !== null) {
    lines.push(line('cost_plus', potentials.cost_plus_value, invoice, markupBp));
  }
  return lines;
}

/** The bases of figures the API worked out (the report, the client's Invoices & Recovery). */
export function recoveryLines(figures: RecoveryFigures, markupBp: number): RecoveryLine[] {
  const lines: RecoveryLine[] = [
    {
      ...line('task', figures.task_value, figures.invoice_value, markupBp),
      shortfall: figures.task_shortfall,
      recoveryBp: figures.task_recovery_bp,
    },
    {
      ...line('staff', figures.staff_value, figures.invoice_value, markupBp),
      shortfall: figures.staff_shortfall,
      recoveryBp: figures.staff_recovery_bp,
    },
  ];
  if (figures.cost_plus_value !== null) {
    lines.push({
      ...line('cost_plus', figures.cost_plus_value, figures.invoice_value, markupBp),
      shortfall: figures.cost_plus_shortfall ?? figures.cost_plus_value - figures.invoice_value,
      recoveryBp: figures.cost_plus_recovery_bp,
    });
  }
  return lines;
}

/** "£500.00 left on the table", "£100.00 over" or "Matches the invoice". */
export function describeShortfall(shortfall: Pence, currency: string): string {
  if (shortfall > 0) return `${formatMoney(shortfall, currency)} left on the table`;
  if (shortfall < 0) return `${formatMoney(-shortfall, currency)} over`;
  return 'Matches the invoice';
}

/** "75% recovered", or nothing to say when there is no potential to recover. */
export function describeRecovery(bp: BasisPoints | null): string | null {
  return bp === null ? null : `${formatBasisPoints(bp)} recovered`;
}
