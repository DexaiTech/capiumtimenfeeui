import { PageHeader } from '@/components/layout';
import { SegmentedControl, Table, type TableColumn } from '@/components/ui';
import { useDocumentTitle } from '@/hooks';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { useBillingTrend } from '../api';
import { BillingTrendChart } from '../components/BillingTrendChart';
import { ChangeHint, Stat, StatGrid } from '../components/Stat';
import { Widget } from '../components/Widget';
import { MONTH_CHOICES } from '../constants';
import { useMonthsParam } from '../hooks/useDashboardParams';
import type { BillingMonth } from '../types';
import { monthLabel } from '../utils/format';

const money = (pence: number) => <span className="tabular-nums">{formatMoney(pence)}</span>;

const COLUMNS: ReadonlyArray<TableColumn<BillingMonth>> = [
  { id: 'month', header: 'Month', card: 'title', cell: (row) => monthLabel(row.month) },
  {
    id: 'invoices',
    header: 'Invoices',
    align: 'end',
    cell: (row) => <span className="tabular-nums">{String(row.invoice_count)}</span>,
  },
  { id: 'billed', header: 'Billed', align: 'end', cell: (row) => money(row.billed) },
  {
    id: 'credits',
    header: 'Credit notes',
    align: 'end',
    cell: (row) => money(row.credit_notes),
  },
  { id: 'net', header: 'Net billed', align: 'end', cell: (row) => money(row.net_billed) },
  { id: 'receipts', header: 'Receipts', align: 'end', cell: (row) => money(row.receipts) },
];

/**
 * `/:orgSlug/dashboard/billing-trend`: what the practice billed, credited and received, month by
 * month, and this month so far against the same days last month.
 */
export default function DashboardBillingTrendPage() {
  useDocumentTitle('Billing Trend');
  const [months, setMonths] = useMonthsParam();
  const query = useBillingTrend(months);
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Billing Trend"
        description="What the practice billed, credited and received, month by month."
        className="mb-1"
        actions={
          <SegmentedControl
            label="Months shown"
            options={MONTH_CHOICES.map((choice) => ({
              value: String(choice),
              label: `${String(choice)} months`,
            }))}
            value={String(months)}
            onChange={(next) => setMonths(Number(next))}
          />
        }
      />
      <Widget title="This month so far" query={query} showRefresh={false}>
        {(data) => (
          <StatGrid label="This month so far">
            <Stat
              label="Billed"
              value={formatMoney(data.this_month.billed)}
              hint={
                <ChangeHint
                  period="this_month"
                  unit="money"
                  comparison={data.billed_comparison}
                  better="up"
                />
              }
            />
            <Stat label="Credit notes" value={formatMoney(data.this_month.credit_notes)} />
            <Stat label="Net billed" value={formatMoney(data.this_month.net_billed)} />
            <Stat label="Receipts" value={formatMoney(data.this_month.receipts)} />
          </StatGrid>
        )}
      </Widget>
      <BillingTrendChart query={query} />
      <Widget
        title="By month"
        description="Invoices by issue date, credit notes by issue date, payments by the date received."
        query={query}
        showRefresh={false}
        isEmpty={(data) => data.series.length === 0}
      >
        {(data) => (
          <>
            <Table
              caption="Billing by month"
              columns={COLUMNS}
              rows={[...data.series].reverse()}
              rowKey={(row) => row.month}
            />
            <p className="text-xs text-text-muted">
              This month so far: {formatUkDate(data.this_month.date_from)} to{' '}
              {formatUkDate(data.this_month.date_to)}, compared with{' '}
              {formatUkDate(data.last_month.date_from)} to {formatUkDate(data.last_month.date_to)}.
            </p>
          </>
        )}
      </Widget>
    </section>
  );
}
