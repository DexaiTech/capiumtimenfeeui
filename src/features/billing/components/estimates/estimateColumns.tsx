import type { DataTableColumn } from '@/components/ui';
import { ClientName } from '@/components/ui';
import { cn } from '@/utils/cn';
import { formatMoney } from '@/utils/money';

import type { EstimateSummary } from '../../types';
import { dateCell } from '../../utils/format';
import { EstimateStatusBadge } from '../badges';

export interface EstimateColumnOptions {
  currency: string;
  onOpen: (estimate: EstimateSummary) => void;
}

/** The columns of the estimate list: number, client, reference, dates, total and status. */
export function estimateColumns({
  currency,
  onOpen,
}: EstimateColumnOptions): DataTableColumn<EstimateSummary>[] {
  return [
    {
      id: 'number',
      header: 'Number',
      hideable: false,
      className: 'whitespace-nowrap',
      cell: (estimate) => (
        <button
          type="button"
          aria-label={`Open ${estimate.number ?? 'draft estimate'} of ${estimate.client?.name ?? 'client'}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpen(estimate);
          }}
          className={cn(
            'font-semibold hover:underline',
            estimate.number ? 'text-brand-text' : 'text-text-muted italic',
          )}
        >
          {estimate.number ?? 'Draft'}
        </button>
      ),
    },
    {
      id: 'client',
      header: 'Client',
      cell: (estimate) =>
        estimate.client ? (
          <ClientName name={estimate.client.name} code={estimate.client.code} />
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'reference',
      header: 'Reference',
      cell: (estimate) => estimate.reference ?? '—',
    },
    {
      id: 'issued',
      header: 'Issued',
      className: 'whitespace-nowrap',
      cell: (estimate) => dateCell(estimate.issue_date),
    },
    {
      id: 'expires',
      header: 'Expires',
      className: 'whitespace-nowrap',
      cell: (estimate) => dateCell(estimate.expiry_date),
    },
    {
      id: 'total',
      header: 'Total',
      align: 'end',
      className: 'font-semibold tabular-nums',
      cell: (estimate) => formatMoney(estimate.gross_total, currency),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (estimate) => <EstimateStatusBadge status={estimate.display_status} />,
    },
  ];
}
