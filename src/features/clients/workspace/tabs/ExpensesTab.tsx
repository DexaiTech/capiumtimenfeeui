import { MoneyTone } from '@/components/ui/MoneyTone';
import { Receipt } from 'lucide-react';
import { useMemo } from 'react';

import { Badge, PageToolbar, Select, type DataTableColumn } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useUrlParams } from '@/hooks';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { useClientExpenses, type ExpenseFilters, type ExpenseRow } from '../../api';
import { ToneBadge } from '../badges';
import { BILLING_STATUS_LABELS } from '../constants';
import { DateRangeFilter } from '../records/DateRangeFilter';
import { RecordTable } from '../records/RecordTable';
import { SummaryStrip } from '../records/SummaryStrip';
import { isoDateParam, oneOf } from '../records/urlFilters';
import { BILLING_STATUSES, type ClientOverview } from '../types';

const BILLABLE = ['true', 'false'] as const;

const BILLABLE_OPTIONS = [
  { value: '', label: 'Billable or not' },
  { value: 'true', label: 'Billable' },
  { value: 'false', label: 'Non-billable' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...BILLING_STATUSES.map((status) => ({
    value: status,
    label: BILLING_STATUS_LABELS[status].label,
  })),
];

export interface ExpensesTabProps {
  clientId: string;
  clientName: string;
  overview: ClientOverview | undefined;
}

/**
 * What was spent on the client's behalf: disbursements today (`GET /disbursements?client_id=`),
 * expense claims once they exist. `api/expenses.ts` is the one place that knows the source; this
 * tab shows `ExpenseRow`s. With `wip.read` every line is listed, otherwise the caller's own.
 */
export function ExpensesTab({ clientId, clientName, overview }: ExpensesTabProps) {
  const { organization, can } = useOrg();
  const { params, setParam } = useUrlParams();
  const from = isoDateParam(params.get('from'));
  const to = isoDateParam(params.get('to'));
  const billable = oneOf(params.get('billable'), BILLABLE);
  const billingStatus = oneOf(params.get('status'), BILLING_STATUSES);

  const filters = useMemo<ExpenseFilters>(
    () => ({ from, to, billable, billing_status: billingStatus }),
    [from, to, billable, billingStatus],
  );
  const query = useClientExpenses(clientId, filters);
  const currency = organization.currency;
  const own = !can(P.wipRead);

  const columns: DataTableColumn<ExpenseRow>[] = [
    {
      id: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (expense) => expense.date,
      className: 'whitespace-nowrap',
      cell: (expense) => formatUkDate(expense.date),
    },
    {
      id: 'description',
      header: 'Description',
      cell: (expense) => (
        <span className="block max-w-72 truncate" title={expense.description}>
          {expense.description}
        </span>
      ),
    },
    { id: 'supplier', header: 'Supplier', cell: (expense) => expense.supplier ?? '—' },
    {
      id: 'amount',
      header: 'Amount',
      align: 'end',
      sortable: true,
      sortValue: (expense) => expense.amount,
      className: 'whitespace-nowrap tabular-nums',
      cell: (expense) => (
        <MoneyTone kind="out" value={expense.amount}>
          {formatMoney(expense.amount, currency)}
        </MoneyTone>
      ),
    },
    {
      id: 'billable',
      header: 'Billable',
      cell: (expense) => (
        <Badge tone={expense.billable ? 'green' : 'grey'} size="sm">
          {expense.billable ? 'Billable' : 'Non-billable'}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (expense) => <ToneBadge info={BILLING_STATUS_LABELS[expense.status]} />,
    },
  ];

  const filtered = Boolean(from || to || billable || billingStatus);
  const expenses = overview?.expenses;

  return (
    <div className="flex flex-col gap-4">
      {expenses ? (
        <SummaryStrip
          label="Expense totals"
          items={[
            { label: own ? 'Your expenses' : 'Expenses', value: String(expenses.count) },
            { label: 'Net', value: formatMoney(expenses.net, currency), hint: 'Before VAT' },
            { label: 'Gross', value: formatMoney(expenses.gross, currency), hint: 'With VAT' },
          ]}
        />
      ) : null}
      <RecordTable
        caption={`Expenses of ${clientName}`}
        columns={columns}
        rowKey={(expense) => `${expense.kind}-${expense.id}`}
        query={query}
        noun={['expense', 'expenses']}
        filtered={filtered}
        onClearFilters={() => setParam({ from: null, to: null, billable: null, status: null })}
        emptyIcon={<Receipt className="size-6" />}
        emptyTitle="No expenses yet"
        emptyDescription="Costs paid on this client's behalf will be listed here."
        errorTitle="Could not load the expenses"
        toolbar={
          <PageToolbar
            start={<h2 className="px-2 text-sm font-semibold text-text">Expenses</h2>}
            actions={
              <>
                <DateRangeFilter label="Date" from={from} to={to} />
                <Select
                  label="Billable"
                  hideLabel
                  options={BILLABLE_OPTIONS}
                  value={billable}
                  onChange={(event) => setParam({ billable: event.target.value })}
                  className="w-full sm:w-40"
                />
                <Select
                  label="Status"
                  hideLabel
                  options={STATUS_OPTIONS}
                  value={billingStatus}
                  onChange={(event) => setParam({ status: event.target.value })}
                  className="w-full sm:w-40"
                />
              </>
            }
          />
        }
      />
    </div>
  );
}
