import { Badge, type DataTableColumn } from '@/components/ui';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import { WIP_KIND_LABELS } from '../../constants';
import type { WorkRow } from '../../utils/workRows';
import { dateCell } from '../../utils/format';

/** What a row says about the work: the entry's description, or how far a fixed fee is billed. */
function detailOf(row: WorkRow, currency: string): string {
  const { item } = row;
  if (row.kind === 'fixed_fee' && item.fixed_fee) {
    const info = item.fixed_fee;
    const progress =
      info.progress_bp === null ? '' : `, ${formatBasisPoints(info.progress_bp)} done`;
    return `Fee ${formatMoney(info.fee, currency)}, ${formatMoney(info.billed, currency)} billed so far${progress}`;
  }
  if (row.kind === 'disbursement') {
    return [item.description, item.supplier].filter(Boolean).join(' · ');
  }
  return item.description ?? '';
}

export function workColumns(currency: string): DataTableColumn<WorkRow>[] {
  return [
    {
      id: 'date',
      header: 'Date',
      hideable: false,
      className: 'whitespace-nowrap',
      cell: (row) => <span className="text-text">{dateCell(row.item.date)}</span>,
    },
    {
      id: 'kind',
      header: 'Type',
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.kind === 'time' && row.item.job?.billing_basis === 'fixed' ? (
          // Billing time on a fixed-fee job bills the job's fee, not the time.
          <span title="Billing this time bills the job's fixed fee">
            <Badge tone="violet" size="sm">
              Fixed-fee time
            </Badge>
          </span>
        ) : (
          <Badge tone={WIP_KIND_LABELS[row.kind].tone} size="sm">
            {WIP_KIND_LABELS[row.kind].label}
          </Badge>
        ),
    },
    {
      id: 'work',
      header: 'Work',
      className: 'min-w-56 max-w-96',
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-text" title={row.item.job?.name ?? undefined}>
            {row.item.job?.name ?? 'No job'}
          </span>
          <span className="truncate text-xs text-text-muted" title={detailOf(row, currency)}>
            {detailOf(row, currency)}
          </span>
        </div>
      ),
    },
    {
      id: 'person',
      header: 'Who',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <span className="text-text">
          {row.kind === 'time' ? (row.item.person?.full_name ?? '—') : '—'}
        </span>
      ),
    },
    {
      id: 'hours',
      header: 'Hours',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <span className="tabular-nums text-text">
          {row.kind === 'time' ? (row.item.hours ?? '—') : '—'}
        </span>
      ),
    },
    {
      id: 'value',
      header: 'WIP value',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <span className="font-medium tabular-nums text-text">
          {formatMoney(row.value, currency)}
        </span>
      ),
    },
  ];
}
