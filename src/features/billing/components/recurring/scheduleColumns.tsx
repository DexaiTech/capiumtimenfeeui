import { TriangleAlert } from 'lucide-react';

import { Badge, type DataTableColumn, ClientName } from '@/components/ui';
import { formatMoney } from '@/utils/money';

import { SCHEDULE_FREQUENCY_LABELS } from '../../constants';
import type { ScheduleSummary } from '../../types';
import { dateCell, plural } from '../../utils/format';
import { ScheduleStatusBadge } from '../badges';

export interface ScheduleColumnOptions {
  currency: string;
  onOpen: (schedule: ScheduleSummary) => void;
}

/** The columns of the schedule list: name, client, frequency, runs, amount and status. */
export function scheduleColumns({
  currency,
  onOpen,
}: ScheduleColumnOptions): DataTableColumn<ScheduleSummary>[] {
  return [
    {
      id: 'name',
      header: 'Name',
      hideable: false,
      cell: (schedule) => (
        <button
          type="button"
          aria-label={`Open ${schedule.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpen(schedule);
          }}
          className="text-left font-semibold text-brand-text hover:underline"
        >
          {schedule.name}
        </button>
      ),
    },
    {
      id: 'client',
      header: 'Client',
      cell: (schedule) =>
        schedule.client ? (
          <ClientName name={schedule.client.name} code={schedule.client.code} />
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'frequency',
      header: 'Frequency',
      cell: (schedule) => SCHEDULE_FREQUENCY_LABELS[schedule.frequency],
    },
    {
      id: 'next',
      header: 'Next run',
      className: 'whitespace-nowrap',
      cell: (schedule) => dateCell(schedule.next_run_date),
    },
    {
      id: 'last',
      header: 'Last run',
      className: 'whitespace-nowrap',
      cell: (schedule) => dateCell(schedule.last_run_on),
    },
    {
      id: 'amount',
      header: 'Amount (net)',
      align: 'end',
      className: 'font-semibold tabular-nums',
      cell: (schedule) => formatMoney(schedule.net_estimate, currency),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (schedule) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <ScheduleStatusBadge status={schedule.status} />
          {schedule.failed_runs > 0 ? (
            <Badge
              tone="warning"
              size="sm"
              icon={<TriangleAlert aria-hidden="true" className="size-3" />}
            >
              {plural(schedule.failed_runs, 'failed run', 'failed runs')}
            </Badge>
          ) : null}
        </div>
      ),
    },
  ];
}
