import { Ellipsis, Paperclip, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';

import {
  Badge,
  Button,
  DataTable,
  Dropdown,
  EmptyState,
  type DataTableColumn,
  type DropdownItem,
} from '@/components/ui';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import type { ExpenseClaimDetail, ExpenseLine } from '../types';
import { formatMiles } from '../utils/format';
import { BillingBadge } from './StatusBadge';

export interface LinesTableProps {
  claim: ExpenseClaimDetail;
  /** The currency of the practice. */
  currency: string;
  onAdd?: () => void;
  onEdit: (line: ExpenseLine) => void;
  /** A line of an approved claim: opens the correction (with its reason). */
  onCorrect: (line: ExpenseLine) => void;
  onDelete: (line: ExpenseLine) => void;
  onReceipts: (line: ExpenseLine) => void;
  /** Lines to point at (the ones a refused submission was about). */
  flagged?: ReadonlySet<string>;
}

/**
 * The lines of a claim as a real table: date, what and for whom, net, VAT and gross, what is
 * recharged, who paid, the receipts and, once approved, where billing stands. The row menu
 * edits or deletes a line while the claim is open, and corrects it once it is approved.
 */
export function LinesTable({
  claim,
  currency,
  onAdd,
  onEdit,
  onCorrect,
  onDelete,
  onReceipts,
  flagged,
}: LinesTableProps) {
  const { actions } = claim;
  const approved = claim.status === 'approved';
  const money = (pence: number) => formatMoney(pence, currency);

  const columns: DataTableColumn<ExpenseLine>[] = [
    {
      id: 'date',
      header: 'Date',
      className: 'w-28 whitespace-nowrap',
      cell: (line) => <span className="text-text">{formatUkDate(line.incurred_on)}</span>,
    },
    {
      id: 'expense',
      header: 'Expense',
      className: 'min-w-56 max-w-80',
      cell: (line) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-text" title={line.description}>
            {line.description}
          </span>
          <span className="truncate text-xs text-text-muted">
            {line.expense_type.name}
            {line.miles !== null ? ` · ${formatMiles(line.miles)}` : ''}
            {line.supplier ? ` · ${line.supplier}` : ''}
          </span>
        </div>
      ),
    },
    {
      id: 'client',
      header: 'Client and job',
      className: 'min-w-44 max-w-64',
      cell: (line) =>
        line.client ? (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-text" title={line.client.name}>
              {line.client.name}
            </span>
            {line.job ? (
              <span className="truncate text-xs text-text-muted">
                {line.job.number} · {line.job.name}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-text-muted">No client</span>
        ),
    },
    {
      id: 'net',
      header: 'Net',
      align: 'end',
      className: 'w-24 whitespace-nowrap',
      cell: (line) => <span className="tabular-nums">{money(line.net)}</span>,
    },
    {
      id: 'vat',
      header: 'VAT',
      align: 'end',
      className: 'w-24 whitespace-nowrap',
      cell: (line) => <span className="tabular-nums">{money(line.vat)}</span>,
    },
    {
      id: 'gross',
      header: 'Gross',
      align: 'end',
      className: 'w-28 whitespace-nowrap',
      cell: (line) => <span className="font-semibold tabular-nums">{money(line.gross)}</span>,
    },
    {
      id: 'recharge',
      header: 'Recharge',
      align: 'end',
      className: 'w-32 whitespace-nowrap',
      cell: (line) =>
        line.is_billable ? (
          <div className="flex flex-col items-end">
            <span className="tabular-nums">{money(line.recharge_amount)}</span>
            <span className="text-2xs text-text-muted">Billable</span>
          </div>
        ) : (
          <span className="text-text-muted">Not billable</span>
        ),
    },
    {
      id: 'payer',
      header: 'Paid by',
      className: 'w-28 whitespace-nowrap',
      cell: (line) => (
        <span className="text-text-muted">{line.payer === 'staff' ? 'Staff' : 'Practice'}</span>
      ),
    },
    {
      id: 'receipts',
      header: 'Receipts',
      className: 'w-32 whitespace-nowrap',
      cell: (line) => {
        const missing = line.receipt_required && line.receipt_count === 0;
        return (
          <button
            type="button"
            onClick={() => onReceipts(line)}
            aria-label={`Receipts for ${line.description} (${String(line.receipt_count)})`}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-text hover:bg-surface-hover"
          >
            <Paperclip aria-hidden="true" className="size-4 text-text-muted" />
            <span className="tabular-nums">{line.receipt_count}</span>
            {missing ? (
              <Badge tone="red" size="sm">
                Needed
              </Badge>
            ) : null}
          </button>
        );
      },
    },
    ...(approved
      ? [
          {
            id: 'billing',
            header: 'Billing',
            className: 'w-40 whitespace-nowrap',
            cell: (line: ExpenseLine) => <BillingBadge status={line.billing_status} />,
          },
        ]
      : []),
  ];

  const itemsFor = (line: ExpenseLine): DropdownItem[] => {
    const items: DropdownItem[] = [];
    if (actions.can_edit) {
      items.push({
        id: 'edit',
        label: 'Edit',
        icon: <Pencil aria-hidden="true" className="size-4" />,
        onSelect: () => onEdit(line),
      });
    }
    if (actions.can_correct && line.billing_status === 'unbilled') {
      items.push({
        id: 'correct',
        label: 'Correct',
        icon: <Pencil aria-hidden="true" className="size-4" />,
        onSelect: () => onCorrect(line),
      });
    }
    items.push({
      id: 'receipts',
      label: 'Receipts',
      icon: <Paperclip aria-hidden="true" className="size-4" />,
      onSelect: () => onReceipts(line),
    });
    if (actions.can_edit) {
      items.push(
        { id: 'separator', separator: true },
        {
          id: 'delete',
          label: 'Delete',
          tone: 'danger',
          icon: <Trash2 aria-hidden="true" className="size-4" />,
          onSelect: () => onDelete(line),
        },
      );
    }
    return items;
  };

  return (
    <DataTable
      caption="Expenses in this claim"
      columns={columns}
      rows={claim.lines}
      rowKey={(line) => line.id}
      rowActions={(line) => (
        <span className="inline-flex items-center gap-1">
          {flagged?.has(line.id) ? (
            <Badge tone="red" size="sm">
              Receipt needed
            </Badge>
          ) : null}
          <Dropdown
            label={`Actions for ${line.description}`}
            items={itemsFor(line)}
            trigger={<Ellipsis aria-hidden="true" className="size-5 text-text-muted" />}
          />
        </span>
      )}
      empty={
        <EmptyState
          icon={<Receipt className="size-6" />}
          title="No expenses in this claim yet"
          description={
            actions.can_edit
              ? 'Add each expense with its date, amount and receipt, then submit the claim.'
              : 'Nothing was added to this claim.'
          }
          action={
            actions.can_edit && onAdd ? (
              <Button
                variant="primary"
                onClick={onAdd}
                leftIcon={<Plus aria-hidden="true" className="size-4" />}
              >
                Add expense
              </Button>
            ) : undefined
          }
        />
      }
    />
  );
}
