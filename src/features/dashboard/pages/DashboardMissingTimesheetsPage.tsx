import { ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/layout';
import {
  Badge,
  Button,
  ConfirmDialog,
  Table,
  useToast,
  type BadgeTone,
  type TableColumn,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';
import { addDays, formatUkDate, formatUkDateTime } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';

import { useMissingTimesheets, useSendTimesheetReminders } from '../api';
import { Widget } from '../components/Widget';
import { useWeekParam } from '../hooks/useDashboardParams';
import type { MissingTimesheet, MissingTimesheetsWidget } from '../types';
import { describeFailure } from '../utils/errors';
import { dateRange, pluralize } from '../utils/format';

const STATUS: Record<MissingTimesheet['status'], { label: string; tone: BadgeTone }> = {
  none: { label: 'No timesheet', tone: 'red' },
  open: { label: 'Not submitted', tone: 'amber' },
  rejected: { label: 'Returned', tone: 'orange' },
};

const SCOPE_TEXT = {
  practice: 'Everyone in the practice who is expected to record time.',
  team: 'You and the people you manage.',
} as const;

function WeekNav({
  data,
  onChange,
}: {
  data: MissingTimesheetsWidget;
  onChange: (week: string | null) => void;
}) {
  const atLast = data.week_start >= data.last_completed_week_start;
  return (
    <div role="group" aria-label="Week" className="flex items-center gap-1">
      <Button
        size="icon"
        variant="outline"
        aria-label="Previous week"
        onClick={() => onChange(addDays(data.week_start, -7))}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Button>
      <span className="min-w-44 text-center text-sm font-medium text-text tabular-nums">
        {dateRange(data.week_start, data.week_end)}
      </span>
      <Button
        size="icon"
        variant="outline"
        aria-label="Next week"
        disabled={atLast}
        onClick={() => {
          const next = addDays(data.week_start, 7);
          onChange(next >= data.last_completed_week_start ? null : next);
        }}
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

/**
 * `/:orgSlug/dashboard/missing-timesheets`: the staff whose timesheet for a week is not
 * submitted (the last completed week unless another is chosen), with what they logged, the days
 * with no time and when they were last reminded; reminders go out from here when permitted.
 */
export default function DashboardMissingTimesheetsPage() {
  const { organization } = useOrg();
  const { toast } = useToast();
  useDocumentTitle('Missing Timesheets');
  const [week, setWeek] = useWeekParam();
  const query = useMissingTimesheets(week);
  const reminders = useSendTimesheetReminders();
  const [confirming, setConfirming] = useState(false);
  const data = query.data;
  const reachable = data
    ? data.rows.filter((row) => row.has_login && row.last_reminded_at === null).length
    : 0;
  const failure = reminders.error ? describeFailure(reminders.error, 'Could not send the reminders') : null;

  const columns: ReadonlyArray<TableColumn<MissingTimesheet>> = [
    {
      id: 'person',
      header: 'Person',
      card: 'title',
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-text">{row.name}</span>
          {row.has_login ? null : (
            <Badge size="sm" tone="grey">
              No login
            </Badge>
          )}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Timesheet',
      cell: (row) => <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>,
    },
    {
      id: 'logged',
      header: 'Logged / expected',
      align: 'end',
      cell: (row) => (
        <span className="tabular-nums">
          {formatMinutes(row.logged_minutes)} / {formatMinutes(row.expected_minutes)}
        </span>
      ),
    },
    {
      id: 'days',
      header: 'Days with no time',
      cell: (row) =>
        row.missing_days.length === 0
          ? 'None'
          : `${pluralize(row.missing_days.length, 'day')}: ${row.missing_days.map(formatUkDate).join(', ')}`,
    },
    {
      id: 'reminded',
      header: 'Last reminded',
      cell: (row) =>
        row.last_reminded_at ? formatUkDateTime(row.last_reminded_at, organization.timezone) : 'Never',
    },
  ];

  const send = () => {
    if (!data) return;
    reminders.mutate(data.week_start, {
      onSuccess: (result) => {
        setConfirming(false);
        const parts = [
          `${pluralize(result.reminded, 'person', 'people')} reminded`,
          `${String(result.already_reminded)} already reminded`,
          `${String(result.unreachable)} without a login`,
        ];
        if (result.approvers_reminded > 0) {
          parts.push(`${pluralize(result.approvers_reminded, 'approver')} reminded`);
        }
        toast({
          tone: result.disabled.length > 0 ? 'warning' : 'success',
          title: 'Reminders sent',
          description:
            result.disabled.length > 0
              ? `${parts.join(', ')}. Switched off in the notification settings: ${result.disabled.join(', ')}.`
              : `${parts.join(', ')}.`,
        });
      },
    });
  };

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Missing Timesheets"
        description="Staff whose timesheet for a week has not been submitted."
        className="mb-1"
        actions={
          <>
            {data ? <WeekNav data={data} onChange={setWeek} /> : null}
            {data?.can_remind && data.count > 0 ? (
              <Button
                variant="primary"
                leftIcon={<Send className="size-4" aria-hidden="true" />}
                onClick={() => {
                  reminders.reset();
                  setConfirming(true);
                }}
              >
                Send reminders
              </Button>
            ) : null}
          </>
        }
      />
      <Widget
        title="Timesheets not submitted"
        query={query}
        isEmpty={(result) => result.count === 0}
        emptyTitle="Everyone has submitted"
        emptyDescription="Every expected timesheet for this week is in."
      >
        {(result) => (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-muted">
              {pluralize(result.count, 'timesheet')} missing for{' '}
              {dateRange(result.week_start, result.week_end)}.{' '}
              {result.scope ? SCOPE_TEXT[result.scope] : null}
            </p>
            <Table
              caption="Missing timesheets"
              columns={columns}
              rows={result.rows}
              rowKey={(row) => row.user_id}
            />
          </div>
        )}
      </Widget>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={send}
        tone="default"
        title="Send timesheet reminders"
        confirmLabel="Send reminders"
        loading={reminders.isPending}
        error={failure ? { message: failure.description } : null}
      >
        <p>
          {pluralize(reachable, 'person', 'people')} will be sent a reminder to submit their
          timesheet for the week of {data ? formatUkDate(data.week_start) : ''}. People without a
          login, and people already reminded about this week, are skipped.
        </p>
      </ConfirmDialog>
    </section>
  );
}
