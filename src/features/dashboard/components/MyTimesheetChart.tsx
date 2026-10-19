import type { UseQueryResult } from '@tanstack/react-query';

import { BarChart } from '@/components/charts';
import { formatMinutes } from '@/utils/minutes';

import type { MyTimesheet } from '../types';
import { weekdayAndDay } from '../utils/format';
import { ChartWidget } from './ChartWidget';

export interface MyTimesheetChartProps {
  query: UseQueryResult<MyTimesheet>;
  className?: string;
}

/** The days of the week against their targets: bars of the time logged, a bar of the target. */
export function MyTimesheetChart({ query, className }: MyTimesheetChartProps) {
  return (
    <ChartWidget title="My Timesheet" query={query} className={className}>
      {(data, chart) => (
        <BarChart
          title="My Timesheet"
          description={
            data
              ? `${formatMinutes(data.total_minutes)} logged of ${formatMinutes(data.target_minutes)} this week`
              : undefined
          }
          data={(data?.days ?? []).map((day) => ({
            day: day.date,
            logged: day.minutes,
            target: day.target_minutes,
          }))}
          xKey="day"
          xFormatter={(value) => weekdayAndDay(String(value))}
          series={[
            { key: 'logged', label: 'Logged', color: 'primary' },
            { key: 'target', label: 'Target', color: 'muted' },
          ]}
          yFormatter={formatMinutes}
          tableColumns={[
            { key: 'day', label: 'Day', align: 'start' },
            { key: 'logged', label: 'Logged', align: 'end' },
            { key: 'target', label: 'Target', align: 'end' },
          ]}
          loading={chart.loading}
          error={chart.error}
          onRetry={chart.onRetry}
          actions={chart.actions}
          emptyTitle="No timesheet this week"
          aspect={16 / 9}
        />
      )}
    </ChartWidget>
  );
}
