/**
 * The recovery analysis (`app/schemas/recovery.py`, `docs/modules/reports.md` "Recovery analysis"):
 * what the billable work was invoiced at against what it would have billed at the task rate, at
 * each person's own charge-out rate and at cost plus the practice's markup. Money is pence,
 * durations whole minutes, percentages basis points (`null` when the denominator is 0). Cost
 * figures are `null` without `rate.read`.
 */
import type { BasisPoints, Pence } from './api';

/** What the time would bill on each basis (the invoicing screen: the work ready to bill). */
export interface RecoveryPotentials {
  /** Billable minutes. */
  minutes: number;
  /** At the rates the time was priced at (the job's or service's rate, else the person's). */
  task_value: Pence;
  /** At each person's own charge-out rate on the day. */
  staff_value: Pence;
  /** What the time cost; null without `rate.read`. */
  cost_value: Pence | null;
  /** The cost plus the practice's markup; null without `rate.read`. */
  cost_plus_value: Pence | null;
}

/** The potentials against the invoice value (the report and the client's Invoices & Recovery). */
export interface RecoveryFigures extends RecoveryPotentials {
  /** What issued invoices billed for the time. */
  invoiced_value: Pence;
  /** What a draft bills, else what the job's terms will (fixed fee still to bill, time value). */
  to_bill_value: Pence;
  /** `invoiced_value + to_bill_value`. */
  invoice_value: Pence;
  /** `task_value − invoice_value`: left on the table when positive, over when negative. */
  task_shortfall: Pence;
  task_recovery_bp: BasisPoints | null;
  staff_shortfall: Pence;
  staff_recovery_bp: BasisPoints | null;
  cost_plus_shortfall: Pence | null;
  cost_plus_recovery_bp: BasisPoints | null;
  /** `invoice_value − cost_value`; null without `rate.read`. */
  margin_value: Pence | null;
  margin_bp: BasisPoints | null;
}
