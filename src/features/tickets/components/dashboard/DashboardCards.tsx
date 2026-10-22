import {
  BarChart,
  DonutChart,
  HorizontalBarList,
  LineChart,
  formatShortDate,
} from '@/components/charts';

import { PRIORITY_META, STATUS_META, TAG_CHART_COLORS, TICKET_STATUSES } from '../../constants';
import type { TicketDashboard } from '../../types';
import { formatShare } from '../../utils/format';

export interface DashboardCardProps {
  /** Absent while the first load runs: the card shows its skeleton. */
  data: TicketDashboard | undefined;
  className?: string;
}

const EMPTY_TITLE = 'No tickets in this period';
const EMPTY_HINT = 'Choose a wider range, or raise a ticket.';

/** "Tickets by Status": a ring with the total in the middle, and the legend `Open 5 (1.9%)` beside it. */
export function StatusCard({ data }: DashboardCardProps) {
  return (
    <DonutChart
      title="Tickets by Status"
      data={(data?.by_status ?? []).map((entry) => ({
        key: entry.status,
        label: STATUS_META[entry.status].label,
        value: entry.count,
        color: STATUS_META[entry.status].chart,
        share: formatShare(entry.percent),
      }))}
      loading={!data}
      centreLabel={data ? { value: String(data.kpis.total.value), label: 'Total' } : undefined}
      legendPlacement="end"
      legendDetail={(value, share) => `${value} (${share})`}
      aspect={1}
      emptyTitle={EMPTY_TITLE}
      emptyDescription={EMPTY_HINT}
      className="h-full"
    />
  );
}

/** "Tickets by Priority": one bar per priority, the count above it, in the priority's colour. */
export function PriorityCard({ data }: DashboardCardProps) {
  const rows = (data?.by_priority ?? []).map((entry) => ({
    priority: PRIORITY_META[entry.priority].label,
    count: entry.count,
    color: PRIORITY_META[entry.priority].chart,
  }));
  const empty = data ? data.kpis.total.value === 0 : false;
  return (
    <BarChart
      title="Tickets by Priority"
      data={empty ? [] : rows}
      xKey="priority"
      series={[{ key: 'count', label: 'Tickets', color: 'primary' }]}
      colorKey="color"
      valueLabels
      legend={false}
      tableColumns={[
        { key: 'priority', label: 'Priority', align: 'start' },
        { key: 'count', label: 'Tickets', align: 'end' },
      ]}
      loading={!data}
      aspect={16 / 10}
      emptyTitle={EMPTY_TITLE}
      emptyDescription={EMPTY_HINT}
      className="h-full"
    />
  );
}

/** "Tickets by Tag": the seven most used tags and "Others", a pastel bar each in the tag's colour. */
export function TagCard({ data, className }: DashboardCardProps) {
  return (
    <HorizontalBarList
      title="Tickets by Tag"
      items={(data?.by_tag ?? []).map((entry) => ({
        key: entry.tag_id ?? 'others',
        label: entry.name,
        value: entry.count,
        color: entry.color ? TAG_CHART_COLORS[entry.color] : 'muted',
      }))}
      loading={!data}
      emptyTitle="No tags in this period"
      emptyDescription="Tag tickets to see which kinds come up most."
      className={className}
    />
  );
}

/** "Status Trend (Last 14 Days)": a line per status, rebuilt from the status history. */
export function TrendCard({ data }: DashboardCardProps) {
  const rows = (data?.trend ?? []).map((point) => ({
    date: point.date,
    ...Object.fromEntries(TICKET_STATUSES.map((status) => [status, point[status]])),
  }));
  const empty = data ? data.kpis.total.value === 0 : false;
  return (
    <LineChart
      title="Status Trend (Last 14 Days)"
      data={empty ? [] : rows}
      xKey="date"
      series={TICKET_STATUSES.map((status) => ({
        key: status,
        label: STATUS_META[status].label,
        color: STATUS_META[status].chart,
      }))}
      xFormatter={(value) => formatShortDate(value, 'en-GB')}
      tableColumns={[
        { key: 'date', label: 'Date', align: 'start' },
        ...TICKET_STATUSES.map((status) => ({
          key: status,
          label: STATUS_META[status].label,
          align: 'end' as const,
        })),
      ]}
      legend
      loading={!data}
      aspect={16 / 9}
      emptyTitle={EMPTY_TITLE}
      emptyDescription={EMPTY_HINT}
    />
  );
}

/** "Top Assignees (by Ticket Count)": a grey bar and the count per person, "Unassigned" included. */
export function AssigneesCard({ data }: DashboardCardProps) {
  return (
    <HorizontalBarList
      title="Top Assignees (by Ticket Count)"
      items={(data?.top_assignees ?? []).map((entry) => ({
        key: entry.user_id ?? 'unassigned',
        label: entry.full_name,
        value: entry.count,
      }))}
      loading={!data}
      emptyTitle={EMPTY_TITLE}
      emptyDescription={EMPTY_HINT}
    />
  );
}
