import type { Pence } from '@/types/api';
import { parsePounds } from '@/utils/money';

import type { AllocationInput, InvoiceSummary } from '../types';

export interface AllocationPlan {
  /** The non-zero allocations the amounts typed make. */
  allocations: AllocationInput[];
  total: Pence;
  /** Ids of the invoices whose amount is not a valid amount within the balance. */
  invalid: ReadonlySet<string>;
  /** More than the money there is to allocate. */
  exceeds: boolean;
}

/** What a grid of typed amounts allocates, and whether it can be sent. */
export function planAllocations(
  invoices: ReadonlyArray<Pick<InvoiceSummary, 'id' | 'balance'>>,
  amounts: Readonly<Record<string, string>>,
  available: Pence | null,
): AllocationPlan {
  const allocations: AllocationInput[] = [];
  const invalid = new Set<string>();
  let total = 0;
  for (const invoice of invoices) {
    const text = amounts[invoice.id]?.trim() ?? '';
    if (text === '') continue;
    const pence = parsePounds(text);
    if (pence === null || pence < 0 || pence > invoice.balance) {
      invalid.add(invoice.id);
      continue;
    }
    if (pence === 0) continue;
    allocations.push({ invoice_id: invoice.id, amount: pence });
    total += pence;
  }
  return { allocations, total, invalid, exceeds: available !== null && total > available };
}

/**
 * Pays the oldest invoice first, as the API's `auto_allocate` does (`invoices` come in that order):
 * each invoice up to its balance until the money runs out.
 */
export function autoAllocate(
  invoices: ReadonlyArray<Pick<InvoiceSummary, 'id' | 'balance'>>,
  amount: Pence,
): AllocationInput[] {
  const allocations: AllocationInput[] = [];
  let left = amount;
  for (const invoice of invoices) {
    if (left <= 0) break;
    const paid = Math.min(left, invoice.balance);
    if (paid > 0) allocations.push({ invoice_id: invoice.id, amount: paid });
    left -= paid;
  }
  return allocations;
}
