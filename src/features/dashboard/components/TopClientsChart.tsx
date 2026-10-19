import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router';

import { HorizontalBarList } from '@/components/charts';
import { buttonClasses } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatMoney } from '@/utils/money';

import type { TopClientsByWip } from '../types';
import { practicePath } from '../utils/format';
import { ChartWidget } from './ChartWidget';

export interface TopClientsChartProps {
  query: UseQueryResult<TopClientsByWip>;
  /** A link beside the refresh button (the overview's "View all"). */
  viewAll?: boolean;
  className?: string;
}

/** The clients with the most unbilled work, as ranked bars. */
export function TopClientsChart({ query, viewAll = false, className }: TopClientsChartProps) {
  const { organization } = useOrg();
  const all = viewAll ? practicePath(organization.slug, '/dashboard/top-clients-by-wip') : null;
  return (
    <ChartWidget title="Top Clients by WIP" query={query} className={className}>
      {(data, chart) => (
        <HorizontalBarList
          title="Top Clients by WIP"
          items={(data?.items ?? []).map((client) => ({
            key: client.client_id,
            label: client.client_name,
            value: client.amount,
            color: 'primary',
          }))}
          valueFormatter={formatMoney}
          loading={chart.loading}
          error={chart.error}
          onRetry={chart.onRetry}
          emptyTitle="No unbilled work"
          emptyDescription="Billable time and disbursements that have not been invoiced appear here."
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
