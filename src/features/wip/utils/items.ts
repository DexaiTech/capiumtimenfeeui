import type { SelectableKind, TransferItemRef, WipComponent, WipItem, WipItemRef } from '../types';

/** One key for an item in a selection: the kinds do not share an id space. */
export const itemKey = (item: Pick<WipItem, 'kind' | 'id'>): string => `${item.kind}:${item.id}`;

const TAKEABLE: ReadonlyArray<string> = ['time', 'disbursement', 'expense'];

/** Whether a write-off or a transfer may take the item by its id (fixed fees and adjustments no). */
export const isTakeable = (item: WipItem): boolean =>
  item.selectable === true && TAKEABLE.includes(item.kind);

/** The reference a write-off takes: exactly one of the three ids. */
export function writeOffRef(item: WipItem): WipItemRef {
  if (item.kind === 'time') return { time_entry_id: item.id };
  if (item.kind === 'disbursement') return { disbursement_id: item.id };
  return { expense_id: item.id };
}

export const transferRef = (item: WipItem): TransferItemRef => ({
  kind: item.kind as SelectableKind,
  id: item.id,
});

/** Which WIP the item counts in: disbursements count in Expense WIP. */
export function componentOf(item: WipItem): WipComponent | null {
  if (item.component) return item.component;
  if (item.kind === 'time') return 'time';
  if (item.kind === 'fixed_fee') return 'fixed_fee';
  return item.kind === 'adjustment' ? null : 'expense';
}

/** Why these items cannot be written off together; null when they can. */
export function writeOffProblem(items: ReadonlyArray<WipItem>): string | null {
  if (items.length === 0) return 'Select the items to write off.';
  const clients = new Set(items.map((item) => item.client?.id ?? ''));
  if (clients.size > 1 || clients.has(''))
    return 'Select the items of one client to write them off.';
  return null;
}

/** Why these items cannot be transferred together; null when they can. */
export function transferProblem(items: ReadonlyArray<WipItem>): string | null {
  if (items.length === 0) return 'Select the items to transfer.';
  const jobs = new Set(items.map((item) => item.job?.id ?? ''));
  if (jobs.size > 1 || jobs.has('')) return 'Select the items of one job to transfer them.';
  const components = new Set(items.map(componentOf));
  if (components.size > 1) return 'Select one kind of WIP to transfer: time, or expenses.';
  return null;
}
