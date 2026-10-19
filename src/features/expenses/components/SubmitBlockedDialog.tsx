import { Paperclip } from 'lucide-react';

import { Button, Modal } from '@/components/ui';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import type { ExpenseLine } from '../types';
import { pluralize } from '../utils/format';

export interface SubmitBlockedDialogProps {
  /** The lines the API refused the submission for (`RECEIPT_REQUIRED`). */
  lines: ReadonlyArray<ExpenseLine>;
  currency: string;
  /** The practice's receipt limit in pence, when known. */
  threshold: number | null;
  open: boolean;
  onClose: () => void;
  onAddReceipt: (line: ExpenseLine) => void;
}

/**
 * The claim was not submitted because some expenses are above the receipt limit and have none:
 * they are listed, each with a way to add the receipt.
 */
export function SubmitBlockedDialog({
  lines,
  currency,
  threshold,
  open,
  onClose,
  onAddReceipt,
}: SubmitBlockedDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Receipts are missing"
      description={
        threshold === null
          ? 'Expenses above the practice receipt limit need a receipt before the claim can be submitted.'
          : `Expenses above ${formatMoney(threshold, currency)} need a receipt before the claim can be submitted.`
      }
      footer={
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <p className="mb-3 text-sm text-text-muted">
        {pluralize(lines.length, 'expense')} still {lines.length === 1 ? 'needs' : 'need'} a
        receipt:
      </p>
      <ul
        aria-label="Expenses without a receipt"
        className="flex flex-col divide-y divide-row-border rounded-md border border-border"
      >
        {lines.map((line) => (
          <li key={line.id} className="flex items-center gap-3 px-3 py-2">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-text" title={line.description}>
                {line.description}
              </span>
              <span className="text-xs text-text-muted">
                {formatUkDate(line.incurred_on)} · {formatMoney(line.gross, currency)}
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => onAddReceipt(line)}
              leftIcon={<Paperclip aria-hidden="true" className="size-4" />}
              aria-label={`Add a receipt for ${line.description}`}
            >
              Add receipt
            </Button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
