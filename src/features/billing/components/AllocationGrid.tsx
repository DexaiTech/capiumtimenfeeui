import { Button, Input } from '@/components/ui';
import { formatMoney, penceToPoundsInput } from '@/utils/money';

import type { InvoiceSummary } from '../types';
import { dateCell } from '../utils/format';

export interface AllocationGridProps {
  invoices: ReadonlyArray<InvoiceSummary>;
  /** What is typed for each invoice, in pounds. */
  amounts: Readonly<Record<string, string>>;
  onChange: (invoiceId: string, text: string) => void;
  invalid: ReadonlySet<string>;
  currency: string;
}

/** The client's open invoices with an amount to pay on each (oldest first), and a "Full" shortcut. */
export function AllocationGrid({
  invoices,
  amounts,
  onChange,
  invalid,
  currency,
}: AllocationGridProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-separate border-spacing-0 text-xs font-medium">
        <caption className="sr-only">Open invoices to allocate the payment to</caption>
        <thead>
          <tr className="text-left text-text-muted">
            <th scope="col" className="h-9 px-3">
              Invoice
            </th>
            <th scope="col" className="h-9 px-3">
              Due
            </th>
            <th scope="col" className="h-9 px-3 text-right">
              Outstanding
            </th>
            <th scope="col" className="h-9 px-3 text-right">
              Amount to pay (£)
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td className="border-t border-row-border px-3 py-2 font-semibold text-text">
                {invoice.number ?? 'Invoice'}
              </td>
              <td className="border-t border-row-border px-3 py-2 whitespace-nowrap">
                {dateCell(invoice.due_date)}
              </td>
              <td className="border-t border-row-border px-3 py-2 text-right tabular-nums">
                {formatMoney(invoice.balance, currency)}
              </td>
              <td className="border-t border-row-border px-3 py-2">
                <div className="flex items-start justify-end gap-2">
                  <Input
                    label={`Amount to pay on ${invoice.number ?? 'the invoice'}`}
                    hideLabel
                    inputMode="decimal"
                    autoComplete="off"
                    value={amounts[invoice.id] ?? ''}
                    error={invalid.has(invoice.id) ? 'Up to the balance' : undefined}
                    onChange={(event) => onChange(invoice.id, event.target.value)}
                    className="w-28"
                  />
                  <Button
                    size="sm"
                    aria-label={`Pay ${invoice.number ?? 'the invoice'} in full`}
                    onClick={() => onChange(invoice.id, penceToPoundsInput(invoice.balance, currency))}
                  >
                    Full
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
