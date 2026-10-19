import { CreditCard } from 'lucide-react';
import { useMemo } from 'react';

import { PageToolbar, SearchField, Select, type DataTableColumn } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { useUrlParams } from '@/hooks';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { useClientPayments, type PaymentFilters } from '../../api';
import { ToneBadge } from '../badges';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATE_LABELS } from '../constants';
import { DateRangeFilter } from '../records/DateRangeFilter';
import { RecordTable } from '../records/RecordTable';
import { SummaryStrip } from '../records/SummaryStrip';
import { isoDateParam, oneOf, useUrlSearch } from '../records/urlFilters';
import { PAYMENT_METHODS, PAYMENT_STATES, type ClientOverview, type PaymentRow } from '../types';

const STATES = [...PAYMENT_STATES, 'on_account'] as const;

const STATE_OPTIONS = [
  { value: '', label: 'All payments' },
  ...PAYMENT_STATES.filter((state) => state !== 'void').map((state) => ({
    value: state,
    label: PAYMENT_STATE_LABELS[state].label,
  })),
  { value: 'on_account', label: 'Money on account' },
  { value: 'void', label: PAYMENT_STATE_LABELS.void.label },
];

const METHOD_OPTIONS = [
  { value: '', label: 'Any method' },
  ...PAYMENT_METHODS.map((method) => ({ value: method, label: PAYMENT_METHOD_LABELS[method] })),
];

export interface PaymentsTabProps {
  clientId: string;
  clientName: string;
  overview: ClientOverview | undefined;
}

/** The money received from the client (`GET /payments?client_id=`, `payment.read`). */
export function PaymentsTab({ clientId, clientName, overview }: PaymentsTabProps) {
  const { organization } = useOrg();
  const { params, setParam } = useUrlParams();
  const { text, setText, searched } = useUrlSearch();
  const state = oneOf(params.get('state'), STATES);
  const method = oneOf(params.get('method'), PAYMENT_METHODS);
  const from = isoDateParam(params.get('from'));
  const to = isoDateParam(params.get('to'));
  const currency = organization.currency;

  const filters = useMemo<PaymentFilters>(
    () => ({ q: searched, state, method, from, to }),
    [searched, state, method, from, to],
  );
  const query = useClientPayments(clientId, filters);

  const money = (pence: number) => formatMoney(pence, currency);
  const columns: DataTableColumn<PaymentRow>[] = [
    {
      id: 'received',
      header: 'Received',
      sortable: true,
      sortValue: (payment) => payment.received_on,
      className: 'whitespace-nowrap',
      cell: (payment) => formatUkDate(payment.received_on),
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
      cell: (payment) => PAYMENT_METHOD_LABELS[payment.method],
    },
    { id: 'reference', header: 'Reference', cell: (payment) => payment.reference ?? '—' },
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
      cell: (payment) => <ToneBadge info={PAYMENT_STATE_LABELS[payment.state]} />,
    },
  ];

  const filtered = Boolean(searched || state || method || from || to);
  const payments = overview?.payments;

  return (
    <div className="flex flex-col gap-4">
      {payments ? (
        <SummaryStrip
          label="Payment totals"
          items={[
            {
              label: 'Received this year',
              value: money(payments.received_ytd),
              hint: `Since ${formatUkDate(overview?.ytd_from)}`,
            },
            { label: 'Payments this year', value: String(payments.count_ytd) },
            { label: 'Last payment', value: formatUkDate(payments.last_payment_on) || '—' },
          ]}
        />
      ) : null}
      <RecordTable
        caption={`Payments of ${clientName}`}
        columns={columns}
        rowKey={(payment) => payment.id}
        query={query}
        noun={['payment', 'payments']}
        filtered={filtered}
        onClearFilters={() => {
          setText('');
          setParam({ q: null, state: null, method: null, from: null, to: null });
        }}
        emptyIcon={<CreditCard className="size-6" />}
        emptyTitle="No payments yet"
        emptyDescription="Money received from this client will be listed here."
        errorTitle="Could not load the payments"
        toolbar={
          <PageToolbar
            search={
              <SearchField
                label="Search payments"
                placeholder="Search reference or notes"
                value={text}
                onChange={setText}
              />
            }
            actions={
              <>
                <Select
                  label="Status"
                  hideLabel
                  options={STATE_OPTIONS}
                  value={state}
                  onChange={(event) => setParam({ state: event.target.value })}
                  className="w-full sm:w-44"
                />
                <Select
                  label="Method"
                  hideLabel
                  options={METHOD_OPTIONS}
                  value={method}
                  onChange={(event) => setParam({ method: event.target.value })}
                  className="w-full sm:w-40"
                />
                <DateRangeFilter label="Date received" from={from} to={to} />
              </>
            }
          />
        }
      />
    </div>
  );
}
