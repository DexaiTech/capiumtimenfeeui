import { Eye, Paperclip, TriangleAlert } from 'lucide-react';

import { Badge, Skeleton } from '@/components/ui';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { useClaim, useExpenseSettings } from '../api';
import type { ExpenseLine, Receipt } from '../types';
import { formatMiles } from '../utils/format';
import { ReceiptThumb } from './receipts/ReceiptThumb';

export interface ReviewLinesProps {
  claimId: string;
  currency: string;
  /** Opens a receipt in the viewer. */
  onPreview: (line: ExpenseLine, receipt: Receipt) => void;
}

/**
 * The lines of a submitted claim, laid out for a decision: what was spent, for whom, what is
 * recharged and the receipts (open one to look at it). A line above the practice's receipt
 * limit is marked, and one that has no receipt is flagged.
 */
export function ReviewLines({ claimId, currency, onPreview }: ReviewLinesProps) {
  const claim = useClaim(claimId);
  const settings = useExpenseSettings();

  if (claim.isPending) {
    return (
      <div
        role="status"
        aria-label="Loading the expenses of the claim"
        className="flex flex-col gap-2"
      >
        <Skeleton shape="rect" className="h-8 w-full" />
        <Skeleton shape="rect" className="h-8 w-full" />
      </div>
    );
  }
  if (claim.isError) {
    return (
      <p role="alert" className="text-sm text-text-muted">
        The expenses of this claim could not be loaded.
      </p>
    );
  }

  const money = (pence: number) => formatMoney(pence, currency);
  return (
    <div className="flex flex-col gap-2 overflow-x-auto">
      <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-xs">
        <caption className="sr-only">Expenses of the claim</caption>
        <thead>
          <tr className="text-left text-text-muted">
            <th scope="col" className="py-1.5 pr-3 font-medium">
              Date
            </th>
            <th scope="col" className="py-1.5 pr-3 font-medium">
              Expense
            </th>
            <th scope="col" className="py-1.5 pr-3 font-medium">
              Client
            </th>
            <th scope="col" className="py-1.5 pr-3 text-right font-medium">
              Gross
            </th>
            <th scope="col" className="py-1.5 pr-3 text-right font-medium">
              Recharge
            </th>
            <th scope="col" className="py-1.5 font-medium">
              Receipts
            </th>
          </tr>
        </thead>
        <tbody>
          {claim.data.lines.map((line) => {
            const missing = line.receipt_required && line.receipt_count === 0;
            return (
              <tr key={line.id} className="align-top">
                <td className="border-t border-row-border py-2 pr-3 whitespace-nowrap text-text">
                  {formatUkDate(line.incurred_on)}
                </td>
                <td className="border-t border-row-border py-2 pr-3">
                  <span className="block font-semibold text-text">{line.description}</span>
                  <span className="block text-text-muted">
                    {line.expense_type.name}
                    {line.miles !== null ? ` · ${formatMiles(line.miles)}` : ''}
                    {line.supplier ? ` · ${line.supplier}` : ''}
                  </span>
                </td>
                <td className="border-t border-row-border py-2 pr-3 text-text">
                  {line.client ? (
                    line.client.name
                  ) : (
                    <span className="text-text-muted">No client</span>
                  )}
                  {line.job ? (
                    <span className="block text-text-muted">
                      {line.job.number} · {line.job.name}
                    </span>
                  ) : null}
                </td>
                <td className="border-t border-row-border py-2 pr-3 text-right font-semibold whitespace-nowrap text-text tabular-nums">
                  {money(line.gross)}
                  {line.payer === 'practice' ? (
                    <span className="block text-2xs font-normal text-text-muted">
                      Practice paid
                    </span>
                  ) : null}
                </td>
                <td className="border-t border-row-border py-2 pr-3 text-right whitespace-nowrap text-text tabular-nums">
                  {line.is_billable ? (
                    money(line.recharge_amount)
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="border-t border-row-border py-2">
                  <div className="flex flex-col gap-1.5">
                    {line.receipt_required ? (
                      <Badge
                        tone={missing ? 'red' : 'grey'}
                        size="sm"
                        icon={
                          missing ? (
                            <TriangleAlert aria-hidden="true" className="size-3" />
                          ) : undefined
                        }
                      >
                        {missing
                          ? 'Receipt missing'
                          : settings.receiptThreshold === null
                            ? 'Above the receipt limit'
                            : `Above ${money(settings.receiptThreshold)}`}
                      </Badge>
                    ) : null}
                    {line.receipts.length === 0 ? (
                      <span className="text-text-muted">None</span>
                    ) : (
                      <ul
                        aria-label={`Receipts of ${line.description}`}
                        className="flex flex-col gap-1"
                      >
                        {line.receipts.map((receipt) => (
                          <li key={receipt.id}>
                            <button
                              type="button"
                              onClick={() => onPreview(line, receipt)}
                              aria-label={`View ${receipt.file_name}`}
                              className="inline-flex max-w-56 items-center gap-2 rounded-md px-1 py-0.5 text-left text-text hover:bg-surface-hover"
                            >
                              <ReceiptThumb lineId={line.id} receipt={receipt} className="size-8" />
                              <span className="truncate">{receipt.file_name}</span>
                              <Eye
                                aria-hidden="true"
                                className="size-3.5 shrink-0 text-text-muted"
                              />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="flex items-center gap-1.5 text-xs text-text-muted">
        <Paperclip aria-hidden="true" className="size-3.5" />
        {claim.data.lines.reduce((count, line) => count + line.receipt_count, 0)} receipts in all
      </p>
    </div>
  );
}
