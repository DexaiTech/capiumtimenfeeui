import type { Pence } from '@/types/api';

import type { BillingBasis, ClientBillingSummary } from '../types';
import type { LineEdits, PlannedLine } from './prepare';

export const BASIS_LABELS: Record<BillingBasis, string> = {
  contract: 'Contract value',
  job: 'Job value',
  team: 'Team value',
};

export const BASIS_HINTS: Record<BillingBasis, string> = {
  contract:
    'Bill the work at the rates in force: those agreed in the client contract where there are any, the practice’s own rates otherwise, and a fixed fee as agreed.',
  job: 'Bill each job at the value set for that job (its fixed fee, or its fee budget), less what has been billed. Applies to lines grouped by job.',
  team: 'Bill the cost of the team members who did the work, using their cost rates.',
};

/** The amount each basis would bill for the chosen lines, as line edits (contract changes nothing). */
export function basisEdits(
  basis: BillingBasis,
  planned: ReadonlyArray<PlannedLine>,
  summary: ClientBillingSummary | undefined,
): LineEdits {
  if (basis === 'contract' || !summary) return {};
  const edits: Record<string, { net: Pence }> = {};
  for (const line of planned) {
    if (line.kind !== 'time' && line.kind !== 'fixed_fee') continue;
    if (basis === 'team') {
      const costs = summary.time_costs;
      if (!costs) continue;
      edits[line.key] = { net: line.itemIds.reduce((sum, id) => sum + (costs[id] ?? 0), 0) };
    } else if (line.key.startsWith('job:') || line.key.startsWith('fixed:')) {
      const job = summary.jobs.find((entry) => entry.job_id === line.jobId);
      const value = job?.breakdown.basis_values.job;
      if (value === null || value === undefined) continue;
      // The job's value less its disbursements: those are their own lines.
      edits[line.key] = { net: Math.max(value - (job?.breakdown.other_costs ?? 0), 0) };
    }
  }
  return edits;
}
