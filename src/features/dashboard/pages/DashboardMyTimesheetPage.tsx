import { Timer } from 'lucide-react';
import { Link } from 'react-router';

import { PageHeader } from '@/components/layout';
import {
  Badge,
  ProgressBar,
  Table,
  buttonClasses,
  type BadgeTone,
  type TableColumn,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';
import { formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';

import { useMyTimesheet } from '../api';
import { MyTimesheetChart } from '../components/MyTimesheetChart';
import { Stat, StatGrid } from '../components/Stat';
import { Widget } from '../components/Widget';
import type { MyTimesheet, MyTimesheetEntry, TimesheetStatus } from '../types';
import { formatBp, pluralize, practicePath } from '../utils/format';

const STATUS: Record<TimesheetStatus, { label: string; tone: BadgeTone }> = {
  open: { label: 'Open', tone: 'grey' },
  submitted: { label: 'Submitted', tone: 'blue' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Returned', tone: 'red' },
};

function TimerNote({ timer }: { timer: NonNullable<MyTimesheet['timer']> }) {
  const what = [timer.client_name, [timer.job_number, timer.job_name].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(' - ');
  return (
    <p className="flex items-start gap-2 rounded-md bg-badge-violet-soft px-3 py-2 text-sm text-text">
      <Timer className="mt-0.5 size-4 shrink-0 text-badge-violet" aria-hidden="true" />
      <span>
        Timer {timer.is_running ? 'running' : 'paused'}:{' '}
        <strong className="font-semibold tabular-nums">
          {formatMinutes(Math.floor(timer.elapsed_seconds / 60))}
        </strong>
        {what ? ` on ${what}` : ''}
        {timer.description ? ` (${timer.description})` : ''}
      </span>
    </p>
  );
}

function Glance({ data }: { data: MyTimesheet }) {
  const { organization } = useOrg();
  const status = STATUS[data.timesheet_status];
  const timesheet = practicePath(organization.slug, '/time');
  const onTrack = data.total_minutes >= data.target_to_date_minutes;
  return (
    <div className="flex flex-col gap-4">
      {data.timesheet_status === 'rejected' ? (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-md border border-danger/40 bg-danger-soft px-3 py-2.5 text-sm text-text"
        >
          <p className="font-medium">Your timesheet was returned</p>
          {data.decision_note ? <p className="text-text-muted">{data.decision_note}</p> : null}
          {timesheet ? (
            <Link to={timesheet} className="w-fit font-medium text-brand-text underline">
              Correct and resubmit it
            </Link>
          ) : null}
        </div>
      ) : null}
      <StatGrid label="This week" className="lg:grid-cols-2">
        <Stat
          label="Logged"
          value={formatMinutes(data.total_minutes)}
          hint={`of ${formatMinutes(data.target_minutes)} this week`}
        />
        <Stat
          label="Today"
          value={formatMinutes(data.today_minutes)}
          hint={`of ${formatMinutes(data.today_target_minutes)} today`}
        />
        <Stat
          label="Chargeable"
          value={data.utilisation_bp === null ? '-' : formatBp(data.utilisation_bp)}
          hint={`target ${formatBp(data.chargeable_target_bp)}`}
        />
        <Stat label="Timesheet" value={<Badge tone={status.tone}>{status.label}</Badge>} />
      </StatGrid>
      <ProgressBar
        label="Week target"
        value={data.total_minutes}
        max={Math.max(data.target_minutes, 1)}
        tone={onTrack ? 'success' : 'warning'}
        valueText={`${formatMinutes(data.total_minutes)} of ${formatMinutes(data.target_minutes)}`}
      />
      {data.missing_days.length > 0 ? (
        <p className="text-sm text-text-muted">
          {pluralize(data.missing_days.length, 'working day')} with no time so far:{' '}
          {data.missing_days.map(formatUkDate).join(', ')}.
        </p>
      ) : null}
      {data.timer ? <TimerNote timer={data.timer} /> : null}
    </div>
  );
}

const COLUMNS: ReadonlyArray<TableColumn<MyTimesheetEntry>> = [
  { id: 'date', header: 'Date', card: 'title', cell: (entry) => formatUkDate(entry.entry_date) },
  {
    id: 'work',
    header: 'Client and job',
    cell: (entry) =>
      [entry.client_name, [entry.job_number, entry.job_name].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(' - ') || 'Internal',
  },
  { id: 'description', header: 'Description', cell: (entry) => entry.description ?? '' },
  {
    id: 'hours',
    header: 'Time',
    align: 'end',
    cell: (entry) => <span className="tabular-nums">{formatMinutes(entry.minutes)}</span>,
  },
  {
    id: 'billable',
    header: 'Billable',
    cell: (entry) => (
      <Badge tone={entry.is_billable ? 'green' : 'grey'}>
        {entry.is_billable ? 'Billable' : 'Non-billable'}
      </Badge>
    ),
  },
];

/**
 * `/:orgSlug/dashboard/my-timesheet`: this week against the target, day by day, the state of
 * the timesheet, the running timer and the latest entries, with a way into My Timesheet.
 */
export default function DashboardMyTimesheetPage() {
  const { organization } = useOrg();
  useDocumentTitle('My Timesheet');
  const query = useMyTimesheet();
  const open = practicePath(organization.slug, '/time');
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="My Timesheet"
        description="This week against your target: day by day, with your latest entries."
        className="mb-1"
        actions={
          open ? (
            <Link to={open} className={buttonClasses({ variant: 'primary' })}>
              Open My Timesheet
            </Link>
          ) : null
        }
      />
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <MyTimesheetChart query={query} />
        <Widget title="This week" query={query} showRefresh={false}>
          {(data) => <Glance data={data} />}
        </Widget>
      </div>
      <Widget
        title="Entries this week"
        description="The latest 50, newest first."
        query={query}
        showRefresh={false}
        isEmpty={(data) => data.entry_count === 0}
        emptyTitle="No time logged this week"
        emptyDescription="Time you record in My Timesheet appears here."
      >
        {(data) => (
          <>
            <Table
              caption="Entries this week"
              columns={COLUMNS}
              rows={data.entries}
              rowKey={(entry) => entry.id}
            />
            {data.entry_count > data.entries.length ? (
              <p className="text-xs text-text-muted">
                Showing {String(data.entries.length)} of {String(data.entry_count)} entries.
              </p>
            ) : null}
          </>
        )}
      </Widget>
    </section>
  );
}
