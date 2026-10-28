import { Plus } from 'lucide-react';

import {
  Button,
  DataTable,
  EmptyState,
  PageToolbar,
  type DataTableColumn,
  type DropdownItem,
  RowActions,
} from '@/components/ui';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import { LINE_KIND_LABELS } from '../../constants';
import type { InvoiceDetail, InvoiceLine } from '../../types';
import { plural } from '../../utils/format';

export interface InvoiceLinesCardProps {
  invoice: InvoiceDetail;
  /** A draft the caller may change: lines can be added, edited and removed. */
  editable: boolean;
  onAdd: () => void;
  onEdit: (line: InvoiceLine) => void;
  onRemove: (line: InvoiceLine) => void;
}

/** The lines of an invoice with their VAT and, under the table, the totals by VAT rate. */
export function InvoiceLinesCard({
  invoice,
  editable,
  onAdd,
  onEdit,
  onRemove,
}: InvoiceLinesCardProps) {
  const money = (pence: number) => formatMoney(pence, invoice.currency);

  const columns: DataTableColumn<InvoiceLine>[] = [
    {
      id: 'description',
      header: 'Description',
      hideable: false,
      cell: (line) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold text-text">{line.description}</span>
          <span className="text-xs text-text-muted">
            {LINE_KIND_LABELS[line.kind] ?? line.kind}
            {line.wip
              ? ` · billed from ${plural(line.wip.item_count, 'WIP item', 'WIP items')}`
              : ''}
          </span>
        </div>
      ),
    },
    {
      id: 'quantity',
      header: 'Qty',
      align: 'end',
      className: 'tabular-nums',
      cell: (line) => line.quantity,
    },
    {
      id: 'unit',
      header: 'Unit price',
      align: 'end',
      className: 'tabular-nums',
      cell: (line) => money(line.unit_amount),
    },
    {
      id: 'net',
      header: 'Net',
      align: 'end',
      className: 'tabular-nums',
      cell: (line) => money(line.net_amount),
    },
    {
      id: 'vat',
      header: 'VAT',
      align: 'end',
      className: 'tabular-nums',
      cell: (line) => (
        <div className="flex flex-col">
          <span>{money(line.vat_amount)}</span>
          <span className="text-xs text-text-muted">{formatBasisPoints(line.vat_rate_bp)}</span>
        </div>
      ),
    },
    {
      id: 'gross',
      header: 'Total',
      align: 'end',
      className: 'font-semibold tabular-nums',
      cell: (line) => money(line.gross_amount),
    },
  ];

  const actionsFor = (line: InvoiceLine): DropdownItem[] => [
    { id: 'edit', label: 'Edit line', onSelect: () => onEdit(line) },
    { id: 'separator', separator: true },
    { id: 'remove', label: 'Remove line', tone: 'danger', onSelect: () => onRemove(line) },
  ];

  return (
    <DataTable
      caption="Invoice lines"
      columns={columns}
      rows={invoice.lines}
      rowKey={(line) => line.id}
      toolbar={
        <PageToolbar
          start={<h2 className="px-2 text-sm font-semibold text-text">Lines</h2>}
          primaryAction={
            editable ? (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus aria-hidden="true" className="size-4" />}
                onClick={onAdd}
              >
                Add line
              </Button>
            ) : undefined
          }
        />
      }
      rowActions={
        editable
          ? (line) => (
              <RowActions label={`Actions for ${line.description}`} items={actionsFor(line)} />
            )
          : undefined
      }
      empty={
        <EmptyState
          title="No lines yet"
          description={
            editable
              ? 'Add a line to bill a fee, or remove this draft.'
              : 'This invoice has no lines.'
          }
        />
      }
      footer={
        <dl className="ml-auto flex max-w-sm flex-col gap-1.5 border-t border-row-border px-4 py-3 text-sm">
          <div className="flex justify-between gap-6">
            <dt className="text-text-muted">Net total</dt>
            <dd className="tabular-nums">{money(invoice.net_total)}</dd>
          </div>
          {invoice.vat_summary.map((row) => (
            <div key={row.vat_rate_bp} className="flex justify-between gap-6">
              <dt className="text-text-muted">
                VAT at {formatBasisPoints(row.vat_rate_bp)} on {money(row.net)}
              </dt>
              <dd className="tabular-nums">{money(row.vat)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-6 font-semibold text-text">
            <dt>Total</dt>
            <dd className="tabular-nums">{money(invoice.gross_total)}</dd>
          </div>
        </dl>
      }
    />
  );
}
