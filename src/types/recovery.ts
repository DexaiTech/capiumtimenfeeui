/**
 * The recovery analysis (`app/schemas/recovery.py`, `docs/modules/reports.md` "Recovery analysis"):
 * what the billable work was invoiced at against what it would have billed at the recovery rate
 * (the practice's order of the client job-specific, task and staff rates), at each person's own
 * charge-out rate and at cost plus the mark-up (the job's, else the client's, else the
 * practice's). Only work on an invoice (issued or draft) or written off is compared; work not
 * invoiced yet is WIP. Money is pence, durations whole minutes, percentages basis points (`null`
 * when the denominator is 0). Cost figures are `null` without `rate.read`.
 */
import type { BasisPoints, Pence } from './api';

/** The three rates the recovery rate is looked for in, in the practice's order. */
export type RecoveryRate = 'client_job' | 'task' | 'staff';

/** What the work would bill on each basis (the invoicing screen: the work ready to bill). */
export interface RecoveryPotentials {
  /** Billable minutes compared (on an invoice or written off; ready to bill on the invoicing screen). */
  minutes: number;
  /** At the recovery rate: the first of the client job, task and staff rates, in the practice's order. */
  recovery_value: Pence;
  /** Minutes the recovery rate came from each rate for. */
  client_job_minutes: number;
  task_minutes: number;
  staff_rate_minutes: number;
  /** At each person's own charge-out rate on the day. */
  staff_value: Pence;
  /** What the time cost; null without `rate.read`. */
  cost_value: Pence | null;
  /** The cost plus the mark-up; null without `rate.read`. */
  cost_plus_value: Pence | null;
  /** The mark-up of the work when it has one only, else null (job and client mark-ups differ). */
  markup_bp: BasisPoints | null;
}

/** The potentials against the invoice value (the report and the client's Invoices & Recovery). */
export interface RecoveryFigures extends RecoveryPotentials {
  /** What issued invoices billed for the time. */
  invoiced_value: Pence;
  /** The credit notes allocated to those invoices (they reduce the invoice value). */
  credited_value: Pence;
  /** What draft invoices bill for the time. */
  draft_value: Pence;
  /** `invoiced_value − credited_value + draft_value`. */
  invoice_value: Pence;
  /** `recovery_value − invoice_value`: left on the table when positive, over when negative. */
  recovery_shortfall: Pence;
  recovery_bp: BasisPoints | null;
  staff_shortfall: Pence;
  staff_recovery_bp: BasisPoints | null;
  cost_plus_shortfall: Pence | null;
  cost_plus_recovery_bp: BasisPoints | null;
  /** `invoice_value − cost_value`; null without `rate.read`. */
  margin_value: Pence | null;
  margin_bp: BasisPoints | null;
  /** Billable time not invoiced yet (WIP): not compared, no invoice value. */
  wip_minutes: number;
  wip_value: Pence;
}

/** What the work cost the practice (each person's cost rate), against the invoice value. */
export interface CostToBusinessFigures {
  minutes: number;
  billable_minutes: number;
  non_billable_minutes: number;
  cost_value: Pence;
  invoiced_cost: Pence;
  wip_cost: Pence;
  non_billable_cost: Pence;
  cost_per_hour: Pence | null;
  invoice_value: Pence;
  margin_value: Pence;
  margin_bp: BasisPoints | null;
}
