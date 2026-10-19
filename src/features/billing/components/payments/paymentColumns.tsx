import type { DataTableColumn } from '@/components/ui';
import { formatMoney } from '@/utils/money';

import { PAYMENT_METHOD_LABELS } from '../../constants';
import type { Payment } from '../../types';
import { dateCell } from '../../utils/format';
import { PaymentStateBadge } from '../badges';

/** The columns of the payment list: date, client, amount, method, reference, allocation and status. */
export function paymentColumns(currency: string): DataTableColumn<Payment>[] {
  const money = (pence: number) => formatMoney(pence, currency);
  return [
    {
      id: 'received',
      header: 'Received',
      sortable: true,
      hideable: false,
      sortValue: (payment) => payment.received_on,
      className: 'whitespace-nowrap',
      cell: (payment) => <span className="font-semibold text-text">{dateCell(payment.received_on)}</span>,
    },
    {
      id: 'client',
      header: 'Client',
      sortable: true,
      sortValue: (payment) => payment.client?.name ?? '',
      cell: (payment) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-text">{payment.client?.name ?? '—'}</span>
          {payment.client ? (
            <span className="text-xs text-text-muted">{payment.client.code}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'end',
      sortable: true,
      sortValue: (payment) => payment.amount,
      className: 'font-semibold tabular-nums',
      cell: (payment) => money(payment.amount),
    },
    {
      id: 'method',
      header: 'Method',
      sortable: true,
      sortValue: (payment) => payment.method,
      cell: (payment) => PAYMENT_METHOD_LABELS[payment.method] ?? payment.method,
    },
    {
      id: 'reference',
      header: 'Reference',
      cell: (payment) => (
        <span className="block max-w-48 truncate" title={payment.reference ?? undefined}>
          {payment.reference ?? '—'}
        </span>
      ),
    },
    {
      id: 'allocated',
      header: 'Allocated',
      align: 'end',
      className: 'tabular-nums',
      cell: (payment) => money(payment.allocated_total),
    },
    {
      id: 'unallocated',
      header: 'On account',
      align: 'end',
      sortable: true,
      sortValue: (payment) => payment.unallocated,
      className: 'tabular-nums',
      cell: (payment) => money(payment.unallocated),
    },
    {
      id: 'state',
      header: 'Status',
      cell: (payment) => <PaymentStateBadge state={payment.state} />,
    },
  ];
}
