import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router';

import { DonutChart } from '@/components/charts';
import { buttonClasses } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatMoney } from '@/utils/money';

import { BUCKET_META } from '../constants';
import type { DebtorAgeing } from '../types';
import { formatBp, practicePath } from '../utils/format';
import { ChartWidget } from './ChartWidget';

export interface DebtorAgeingChartProps {
  query: UseQueryResult<DebtorAgeing>;
  viewAll?: boolean;
  className?: string;
}

/** What is owed, by how late it is: a ring with the total in the middle and a legend by bucket. */
export function DebtorAgeingChart({ query, viewAll = false, className }: DebtorAgeingChartProps) {
  const { organization } = useOrg();
  const all = viewAll ? practicePath(organization.slug, '/dashboard/debtor-ageing') : null;
  return (
    <ChartWidget title="Debtor Ageing" query={query} className={className}>
      {(data, chart) => (
        <DonutChart
          title="Debtor Ageing"
          description="Outstanding balance of issued invoices by days past the due date"
          data={(data?.buckets ?? []).map((bucket) => ({
            key: bucket.key,
            label: BUCKET_META[bucket.key].label,
            value: bucket.amount,
            color: BUCKET_META[bucket.key].color,
            share: formatBp(bucket.share_bp ?? 0),
          }))}
          valueFormatter={formatMoney}
          centreLabel={data ? { value: formatMoney(data.total), label: 'Owed' } : undefined}
          legendPlacement="end"
          legendDetail={(value, share) => `${value} (${share})`}
          loading={chart.loading}
          error={chart.error}
          onRetry={chart.onRetry}
          emptyTitle="No money is owed"
          emptyDescription="Issued invoices with a balance appear here."
          aspect={1}
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
        />
      )}
    </ChartWidget>
  );
}
