import type { Pence } from '@/types/api';

import type { WipItem } from '../types';
import type { FixedFeeFigures } from './prepare';

/** One line of the work to choose from: time, a disbursement or a fixed fee. */
export interface WorkRow {
  /** The item's id, or `fixed:<job id>` for a fixed fee. */
  key: string;
  kind: 'time' | 'disbursement' | 'fixed_fee';
  item: WipItem;
  /** The WIP items choosing the row chooses (a fixed fee: the job's unbilled time entries). */
  ids: string[];
  /** What choosing the row adds to the invoice's WIP. */
  value: Pence;
}

/** WIP that is shown but cannot be put on an invoice yet, and why. */
export interface BlockedItem {
  item: WipItem;
  reason: string;
}

export interface WorkRows {
  rows: WorkRow[];
  blocked: BlockedItem[];
}

const EXPENSE_REASON = 'Expense claim lines cannot be invoiced yet';
const FIXED_FEE_REASON = 'A fixed fee with no unbilled time cannot be invoiced yet';

/**
 * What the Prepare Invoice list offers from a client's WIP. The time of a job whose fixed fee is
 * recognised is billed through the fee row (it has no value of its own); expense lines and a fixed
 * fee without time entries are listed apart, as the API cannot bill them.
 */
export function workRowsOf(items: ReadonlyArray<WipItem>): WorkRows {
  const feeJobs = new Set<string>();
  for (const item of items) {
    if (item.kind === 'fixed_fee' && item.job) feeJobs.add(item.job.id);
  }

  const rows: WorkRow[] = [];
  const blocked: BlockedItem[] = [];
  for (const item of items) {
    if (item.kind === 'expense') {
      blocked.push({ item, reason: EXPENSE_REASON });
    } else if (item.kind === 'fixed_fee') {
      const ids = item.fixed_fee?.time_entry_ids ?? [];
      if (!item.job) continue;
      if (ids.length === 0) blocked.push({ item, reason: FIXED_FEE_REASON });
      else
        rows.push({ key: `fixed:${item.job.id}`, kind: 'fixed_fee', item, ids, value: item.value });
    } else if (item.kind === 'time' || item.kind === 'disbursement') {
      if (item.selectable === false) continue;
      if (item.kind === 'time' && item.job && feeJobs.has(item.job.id)) continue;
      rows.push({ key: item.id, kind: item.kind, item, ids: [item.id], value: item.value });
    }
  }
  return { rows, blocked };
}

/** The WIP items behind the rows chosen, in the order the client's WIP lists them. */
export function chosenItems(
  items: ReadonlyArray<WipItem>,
  rows: ReadonlyArray<WorkRow>,
  chosen: ReadonlySet<string>,
): WipItem[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (chosen.has(row.key)) for (const id of row.ids) ids.add(id);
  }
  return items.filter((item) => item.kind !== 'fixed_fee' && ids.has(item.id));
}

/** The unbilled part of each chosen fixed fee (fee less what live invoices bill) and the WIP it clears. */
export function fixedFeesOf(
  rows: ReadonlyArray<WorkRow>,
  chosen: ReadonlySet<string>,
): Map<string, FixedFeeFigures> {
  const figures = new Map<string, FixedFeeFigures>();
  for (const row of rows) {
    const info = row.item.fixed_fee;
    if (row.kind === 'fixed_fee' && chosen.has(row.key) && info && row.item.job) {
      figures.set(row.item.job.id, { net: Math.max(info.fee - info.billed, 0), wip: row.value });
    }
  }
  return figures;
}

/** The rows' total WIP value that is chosen. */
export function chosenValue(rows: ReadonlyArray<WorkRow>, chosen: ReadonlySet<string>): Pence {
  return rows.reduce((sum, row) => (chosen.has(row.key) ? sum + row.value : sum), 0);
}
