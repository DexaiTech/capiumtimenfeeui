/**
 * The recovery analysis in words and figures (`docs/modules/reports.md`, "Recovery analysis"):
 * the bases an invoice value is compared with, the revenue left on the table on each and the
 * recovery. Shared by the client's Invoices & Recovery, the invoicing screen and the report.
 */
import type {
  BasisPoints,
  Pence,
  RecoveryFigures,
  RecoveryPotentials,
  RecoveryRate,
} from '@/types';

import { formatMinutes } from './minutes';
import { formatBasisPoints, formatMoney } from './money';

export type RecoveryBasis = 'recovery' | 'staff' | 'cost_plus';

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

/** The three rates of the recovery rate, as the settings and the screens name them. */
export const RECOVERY_RATE_LABELS: Record<RecoveryRate, string> = {
  client_job: 'Client job-specific rate',
  task: 'Task-specific rate',
  staff: 'Staff charge-out rate',
};

export const RECOVERY_RATE_HINTS: Record<RecoveryRate, string> = {
  client_job: 'The rate agreed with the client for the job (the client’s Jobs tab, client rates)',
  task: 'The rate set against the task (service)',
  staff: 'The rate set against the staff member (else their grade’s, else the practice default)',
};

/** The three rates, in the default order: client job-specific, task, staff charge-out. */
export const RECOVERY_RATES = [
  'client_job',
  'task',
  'staff',
] as const satisfies ReadonlyArray<RecoveryRate>;

export const RECOVERY_LABELS: Record<RecoveryBasis, string> = {
  recovery: 'Potential recovery',
  staff: 'At staff rates',
  cost_plus: 'Cost plus',
};

/** "Client job-specific rate, then task-specific rate, then staff charge-out rate". */
export function rateOrderText(order: ReadonlyArray<RecoveryRate>): string {
  return order
    .map((rate, index) =>
      index === 0 ? RECOVERY_RATE_LABELS[rate] : RECOVERY_RATE_LABELS[rate].toLowerCase(),
    )
    .join(', then ');
}

/** Which rate gave the recovery rate, in hours: "10:00 at client job rates, 10:00 at task rates". */
export function rateMix(potentials: RecoveryPotentials): string {
  const parts: string[] = [];
  if (potentials.client_job_minutes > 0) {
    parts.push(`${formatMinutes(potentials.client_job_minutes)} at client job rates`);
  }
  if (potentials.task_minutes > 0) {
    parts.push(`${formatMinutes(potentials.task_minutes)} at task rates`);
  }
  if (potentials.staff_rate_minutes > 0) {
    parts.push(`${formatMinutes(potentials.staff_rate_minutes)} at staff rates`);
  }
  return parts.join(', ');
}

/** "Cost plus 50%", or "Cost plus" when the jobs and clients have different mark-ups. */
export function costPlusLabel(markupBp: BasisPoints | null): string {
  return markupBp === null
    ? RECOVERY_LABELS.cost_plus
    : `${RECOVERY_LABELS.cost_plus} ${formatBasisPoints(markupBp)}`;
}

/** `part / whole` in basis points, rounded half away from zero as the API rounds; null for 0. */
export function recoveryBasisPoints(part: Pence, whole: Pence): BasisPoints | null {
  if (whole === 0) return null;
  const exact = (part * 10_000) / whole;
  return Math.sign(exact) * Math.round(Math.abs(exact));
}

const HINTS: Record<RecoveryBasis, string> = {
  recovery:
    'Hours × the first rate found: client job-specific, task or staff (the practice’s order)',
  staff: 'Hours × each person’s own charge-out rate',
  cost_plus: 'What the team cost, plus the job’s, client’s or practice’s mark-up',
};

function line(
  basis: RecoveryBasis,
  potential: Pence,
  invoice: Pence,
  markupBp: BasisPoints | null,
): RecoveryLine {
  return {
    basis,
    label: basis === 'cost_plus' ? costPlusLabel(markupBp) : RECOVERY_LABELS[basis],
    hint: HINTS[basis],
    potential,
    shortfall: potential - invoice,
    recoveryBp: recoveryBasisPoints(invoice, potential),
  };
}

/**
 * The bases against an invoice value worked out on screen (the invoicing screen, where the value
 * depends on the basis the invoice is valued on). Cost plus is left out when cost is hidden.
 */
export function compareRecovery(potentials: RecoveryPotentials, invoice: Pence): RecoveryLine[] {
  const markup = potentials.markup_bp;
  const lines = [
    line('recovery', potentials.recovery_value, invoice, markup),
    line('staff', potentials.staff_value, invoice, markup),
  ];
  if (potentials.cost_plus_value !== null) {
    lines.push(line('cost_plus', potentials.cost_plus_value, invoice, markup));
  }
  return lines;
}

/** The bases of figures the API worked out (the report, the client's Invoices & Recovery). */
export function recoveryLines(figures: RecoveryFigures): RecoveryLine[] {
  const markup = figures.markup_bp;
  const lines: RecoveryLine[] = [
    {
      ...line('recovery', figures.recovery_value, figures.invoice_value, markup),
      shortfall: figures.recovery_shortfall,
      recoveryBp: figures.recovery_bp,
    },
    {
      ...line('staff', figures.staff_value, figures.invoice_value, markup),
      shortfall: figures.staff_shortfall,
      recoveryBp: figures.staff_recovery_bp,
    },
  ];
  if (figures.cost_plus_value !== null) {
    lines.push({
      ...line('cost_plus', figures.cost_plus_value, figures.invoice_value, markup),
      shortfall: figures.cost_plus_shortfall ?? figures.cost_plus_value - figures.invoice_value,
      recoveryBp: figures.cost_plus_recovery_bp,
    });
  }
  return lines;
}

/** "£1,500.00 invoiced, £300.00 credited, £0.00 on drafts", leaving out what is 0. */
export function invoiceParts(figures: RecoveryFigures, currency: string): string {
  const parts = [`${formatMoney(figures.invoiced_value, currency)} invoiced`];
  if (figures.credited_value > 0) {
    parts.push(`${formatMoney(figures.credited_value, currency)} credited`);
  }
  if (figures.draft_value > 0) {
    parts.push(`${formatMoney(figures.draft_value, currency)} on drafts`);
  }
  return parts.join(', ');
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
