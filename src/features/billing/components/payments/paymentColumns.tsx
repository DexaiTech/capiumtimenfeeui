import { MoneyTone } from '@/components/ui/MoneyTone';
import type { DataTableColumn } from '@/components/ui';
import { ClientName } from '@/components/ui';
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
      cell: (payment) => (
        <span className="font-semibold text-text">{dateCell(payment.received_on)}</span>
      ),
    },
    {
      id: 'client',
      header: 'Client',
      sortable: true,
      sortValue: (payment) => payment.client?.name ?? '',
      cell: (payment) =>
        payment.client ? (
          <ClientName name={payment.client.name} code={payment.client.code} />
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'end',
      sortable: true,
      sortValue: (payment) => payment.amount,
      className: 'font-semibold tabular-nums',
      cell: (payment) => (
        <MoneyTone kind="in" value={payment.amount}>
          {money(payment.amount)}
        </MoneyTone>
      ),
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
      cell: (payment) => (
        <MoneyTone kind="in" value={payment.allocated_total}>
          {money(payment.allocated_total)}
        </MoneyTone>
      ),
    },
    {
      id: 'unallocated',
      header: 'On account',
      align: 'end',
      sortable: true,
      sortValue: (payment) => payment.unallocated,
      className: 'tabular-nums',
      cell: (payment) => (
        <MoneyTone kind="in" value={payment.unallocated}>
          {money(payment.unallocated)}
        </MoneyTone>
      ),
    },
    {
      id: 'state',
      header: 'Status',
      cell: (payment) => <PaymentStateBadge state={payment.state} />,
    },
  ];
}
