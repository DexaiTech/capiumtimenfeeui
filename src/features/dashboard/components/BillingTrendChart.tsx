import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router';

import { BarChart, type SeriesDef } from '@/components/charts';
import { buttonClasses } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatMoney } from '@/utils/money';

import type { BillingTrend } from '../types';
import { monthLabel, practicePath } from '../utils/format';
import { ChartWidget } from './ChartWidget';

const SERIES: SeriesDef[] = [
  { key: 'billed', label: 'Billed', color: 'primary' },
  { key: 'credit_notes', label: 'Credit notes', color: 'warning' },
  { key: 'receipts', label: 'Receipts', color: 'success' },
];

export interface BillingTrendChartProps {
  query: UseQueryResult<BillingTrend>;
  viewAll?: boolean;
  className?: string;
}

/** Billed, credited and received per month: grouped bars. */
export function BillingTrendChart({ query, viewAll = false, className }: BillingTrendChartProps) {
  const { organization } = useOrg();
  const all = viewAll ? practicePath(organization.slug, '/dashboard/billing-trend') : null;
  return (
    <ChartWidget title="Billing Trend" query={query} className={className}>
      {(data, chart) => {
        const quiet = data?.series.every(
          (month) => month.billed === 0 && month.credit_notes === 0 && month.receipts === 0,
        );
        return (
          <BarChart
            title="Billing Trend"
            description="Net of invoices issued, net of credit notes and payments received, by month"
            data={
              quiet
                ? []
                : (data?.series ?? []).map((month) => ({
                    month: month.month,
                    billed: month.billed,
                    credit_notes: month.credit_notes,
                    receipts: month.receipts,
                  }))
            }
            xKey="month"
            xFormatter={(value) => monthLabel(String(value))}
            series={SERIES}
            yFormatter={(value) => formatMoney(value, organization.currency)}
            tableColumns={[
              { key: 'month', label: 'Month', align: 'start' },
              { key: 'billed', label: 'Billed', align: 'end' },
              { key: 'credit_notes', label: 'Credit notes', align: 'end' },
              { key: 'receipts', label: 'Receipts', align: 'end' },
            ]}
            loading={chart.loading}
            error={chart.error}
            onRetry={chart.onRetry}
            emptyTitle="Nothing billed in these months"
            emptyDescription="Issue an invoice or record a payment to see the trend."
            actions={
              <div className="flex items-center gap-1">
                {all ? (
                  <Link to={all} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
                    View all
                  </Link>
                ) : null}
                {chart.actions}
              </div>
            }
            aspect={16 / 9}
          />
        );
      }}
    </ChartWidget>
  );
}
