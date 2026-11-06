import { BadgeCheck, Check, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  PageToolbar,
  Pagination,
  Table,
  Textarea,
  buttonClasses,
  useToast,
  type TableColumn,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useAuth } from '@/features/auth';
import { ApprovalOffNotice, useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';
import { formatUkDate, formatUkDateTime } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';

import {
  flattenPages,
  useApprovals,
  useApproveTimesheet,
  useBulkApprove,
  useOvertime,
  useReturnTimesheet,
} from '../api';
import { SheetEntries } from '../components/approvals/SheetEntries';
import { ZeroRateWarning, type UnpricedTime } from '../components/approvals/ZeroRateWarning';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { ReasonDialog } from '../components/ReasonDialog';
import type { Timesheet } from '../types';
import { dialogError } from '../utils/errors';
import { formatShare } from '../utils/format';
import { formatWeekRange } from '../utils/weeks';

const ROW_CHECKBOX = 'size-4 cursor-pointer rounded-sm accent-primary align-middle';

/** The unpriced billable time of these sheets, added up per person. */
function unpricedByPerson(sheets: ReadonlyArray<Timesheet>): UnpricedTime[] {
  const people = new Map<string, UnpricedTime>();
  for (const sheet of sheets) {
    people.set(sheet.user_id, {
      key: sheet.user_id,
      name: sheet.user_name,
      minutes: (people.get(sheet.user_id)?.minutes ?? 0) + sheet.zero_rate_minutes,
      staffId: sheet.user_id,
    });
  }
  return [...people.values()];
}

function Page() {
  const { organization, can } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const queue = useApprovals();
  const approve = useApproveTimesheet();
  const giveBack = useReturnTimesheet();
  const bulk = useBulkApprove();
  // Overtime waiting for a decision, marked on each sheet it falls in (APT81).
  const pendingOvertime = useOvertime(
    { status: 'pending' },
    { enabled: organization.overtime_enabled },
  );

  const rows = flattenPages(queue.data);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [approving, setApproving] = useState<Timesheet | null>(null);
  const [note, setNote] = useState('');
  const [returning, setReturning] = useState<Timesheet | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);

  /** Nobody decides on their own timesheet unless they may change the practice. */
  const own = (sheet: Timesheet) =>
    sheet.user_id === user?.id && !can(PERMISSIONS.organizationUpdate);
  const selectable = rows.filter((sheet) => !own(sheet));
  const chosen = selectable.filter((sheet) => selected.has(sheet.id));
  const allChosen = selectable.length > 0 && chosen.length === selectable.length;

  const overtimePending = (sheet: Timesheet) =>
    (pendingOvertime.data ?? []).filter(
      (item) =>
        item.user.id === sheet.user_id &&
        item.entry_date >= sheet.week_start &&
        item.entry_date <= sheet.week_end,
    ).length;

  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  const forget = (ids: ReadonlyArray<string>) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });

  const columns: TableColumn<Timesheet>[] = [
    {
      id: 'select',
      header: 'Select',
      className: 'w-10',
      card: 'hidden',
      cell: (sheet) => (
        <input
          type="checkbox"
          className={ROW_CHECKBOX}
          aria-label={`Select the timesheet of ${sheet.user_name ?? 'this person'} for the week of ${formatUkDate(sheet.week_start)}`}
          checked={selected.has(sheet.id)}
          disabled={own(sheet)}
          onChange={(event) => toggle(sheet.id, event.target.checked)}
        />
      ),
    },
    {
      id: 'person',
      header: 'Person',
      card: 'title',
      cell: (sheet) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-text uppercase">
            {sheet.user_name ?? 'Unknown person'}
          </span>
          {sheet.zero_rate_minutes > 0 ? (
            <Badge size="sm" tone="warning">
              No rate
            </Badge>
          ) : null}
          {overtimePending(sheet) > 0 ? (
            <Badge size="sm" tone="warning">
              {overtimePending(sheet)} overtime pending
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: 'week',
      header: 'Week',
      className: 'whitespace-nowrap',
      cell: (sheet) => formatWeekRange(sheet.week_start),
    },
    {
      id: 'hours',
      header: 'Hours',
      align: 'end',
      className: 'whitespace-nowrap tabular-nums',
      cell: (sheet) => <span className="font-semibold">{formatMinutes(sheet.total_minutes)}</span>,
    },
    {
      id: 'billable',
      header: 'Billable',
      align: 'end',
      className: 'whitespace-nowrap tabular-nums',
      cell: (sheet) => formatShare(sheet.billable_minutes, sheet.total_minutes),
    },
    {
      id: 'submitted',
      header: 'Submitted on',
      className: 'whitespace-nowrap',
      cell: (sheet) =>
        sheet.submitted_at ? formatUkDateTime(sheet.submitted_at, organization.timezone) : '—',
    },
  ];

  const decide = (sheet: Timesheet) => (
    <div className="flex items-center justify-end gap-2">
      <Button
        size="sm"
        variant="brand-outline"
        leftIcon={<Check className="size-4" aria-hidden="true" />}
        disabled={own(sheet)}
        title={own(sheet) ? 'You cannot approve your own timesheet' : undefined}
        aria-label={`Approve the timesheet of ${sheet.user_name ?? 'this person'}, week of ${formatUkDate(sheet.week_start)}`}
        onClick={() => {
          setRefusal(null);
          setNote('');
          setApproving(sheet);
        }}
      >
        Approve
      </Button>
      <Button
        size="sm"
        leftIcon={<Undo2 className="size-4" aria-hidden="true" />}
        disabled={own(sheet)}
        title={own(sheet) ? 'You cannot return your own timesheet' : undefined}
        aria-label={`Return the timesheet of ${sheet.user_name ?? 'this person'}, week of ${formatUkDate(sheet.week_start)}`}
        onClick={() => setReturning(sheet)}
      >
        Return
      </Button>
    </div>
  );

  if (queue.isError && !queue.data) {
    return (
      <LoadError
        title="Could not load the approvals"
        error={queue.error}
        onRetry={() => void queue.refetch()}
        retrying={queue.isRefetching}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ApprovalOffNotice area="timesheet" />
      <PageToolbar
        start={
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 px-2 text-xs font-medium text-text md:min-h-8">
            <input
              type="checkbox"
              className={ROW_CHECKBOX}
              checked={allChosen}
              disabled={selectable.length === 0}
              onChange={(event) =>
                setSelected(
                  event.target.checked ? new Set(selectable.map((sheet) => sheet.id)) : new Set(),
                )
              }
            />
            Select all ({selectable.length})
          </label>
        }
        actions={
          can(PERMISSIONS.timeManageAll) || can(PERMISSIONS.timesheetApprove) ? (
            <Link
              to={`${routes.org.module(organization.slug, 'time', 'entries')}?timesheet=approved&billing=unbilled`}
              className={buttonClasses({ variant: 'outline', size: 'sm' })}
            >
              Correct approved time
            </Link>
          ) : null
        }
        primaryAction={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<BadgeCheck className="size-4" aria-hidden="true" />}
            disabled={chosen.length === 0}
            onClick={() => {
              setRefusal(null);
              setBulkOpen(true);
            }}
          >
            Approve selected ({chosen.length})
          </Button>
        }
      />

      <Table
        caption="Timesheets waiting for approval"
        columns={columns}
        rows={rows}
        rowKey={(sheet) => sheet.id}
        loading={queue.isPending}
        rowActions={decide}
        expansion={{
          label: (sheet) =>
            `Entries of ${sheet.user_name ?? 'this person'}, week of ${formatUkDate(sheet.week_start)}`,
          render: (sheet) => (
            <SheetEntries
              timesheetId={sheet.id}
              person={sheet.user_name ?? 'this person'}
              overtime={
                organization.overtime_enabled
                  ? {
                      userId: sheet.user_id,
                      from: sheet.week_start,
                      to: sheet.week_end,
                      canDecide: !own(sheet),
                    }
                  : undefined
              }
            />
          ),
        }}
        empty={
          <EmptyState
            icon={<BadgeCheck className="size-6" />}
            title="No timesheets are waiting"
            description="Timesheets submitted by the people you manage appear here, oldest week first."
          />
        }
      />
      {rows.length > 0 ? (
        <Card padding="sm">
          <Pagination
            hasMore={queue.hasNextPage}
            onLoadMore={() => void queue.fetchNextPage()}
            loading={queue.isFetchingNextPage}
            count={rows.length}
            itemLabel={['timesheet', 'timesheets']}
          />
        </Card>
      ) : null}

      <ConfirmDialog
        open={approving !== null}
        onClose={() => setApproving(null)}
        onConfirm={() => {
          if (!approving) return;
          const sheet = approving;
          approve.mutate(
            { timesheetId: sheet.id, ...(note.trim() ? { note: note.trim() } : {}) },
            {
              onSuccess: () => {
                toast({
                  tone: 'success',
                  title: 'Timesheet approved',
                  description: `${sheet.user_name ?? 'The timesheet'} · ${formatMinutes(sheet.total_minutes)}`,
                });
                forget([sheet.id]);
                setApproving(null);
              },
              onError: (error) => setRefusal(dialogError(error)),
            },
          );
        }}
        title="Approve this timesheet?"
        confirmLabel={approving?.zero_rate_minutes ? 'Approve anyway' : 'Approve timesheet'}
        tone="default"
        loading={approve.isPending}
        error={refusal}
      >
        <p>
          {approving
            ? `${approving.user_name ?? 'This person'}, ${formatWeekRange(approving.week_start)}, ${formatMinutes(approving.total_minutes)} in all.`
            : ''}{' '}
          Their time is locked once it is approved.
        </p>
        {approving ? <ZeroRateWarning people={unpricedByPerson([approving])} /> : null}
        <Textarea
          label="Note (optional)"
          rows={2}
          value={note}
          maxLength={2000}
          onChange={(event) => setNote(event.target.value)}
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onConfirm={() =>
          bulk.mutate(
            chosen.map((sheet) => sheet.id),
            {
              onSuccess: (approved) => {
                toast({
                  tone: 'success',
                  title: `${approved.length} ${approved.length === 1 ? 'timesheet' : 'timesheets'} approved`,
                });
                forget(approved.map((sheet) => sheet.id));
                setBulkOpen(false);
              },
              onError: (error) => setRefusal(dialogError(error)),
            },
          )
        }
        title={`Approve ${chosen.length} ${chosen.length === 1 ? 'timesheet' : 'timesheets'}?`}
        confirmLabel={
          chosen.some((sheet) => sheet.zero_rate_minutes > 0)
            ? 'Approve anyway'
            : 'Approve timesheets'
        }
        tone="default"
        loading={bulk.isPending}
        error={refusal}
      >
        <ul className="list-disc pl-5">
          {chosen.slice(0, 6).map((sheet) => (
            <li key={sheet.id}>
              {sheet.user_name ?? 'Unknown person'}, {formatWeekRange(sheet.week_start)},{' '}
              {formatMinutes(sheet.total_minutes)}
            </li>
          ))}
          {chosen.length > 6 ? <li>and {chosen.length - 6} more</li> : null}
        </ul>
        <p>All of them are approved together, or none if one of them cannot be.</p>
        <ZeroRateWarning people={unpricedByPerson(chosen)} />
      </ConfirmDialog>

      <ReasonDialog
        open={returning !== null}
        onClose={() => setReturning(null)}
        title="Return this timesheet"
        description={
          returning
            ? `${returning.user_name ?? 'This person'}, ${formatWeekRange(returning.week_start)}`
            : undefined
        }
        label="Reason"
        hint="Required. The person is told why and can change the time and submit it again."
        requiredMessage="Enter a reason for returning the timesheet"
        submitLabel="Return timesheet"
        onSubmit={async (reason) => {
          if (!returning) return;
          const sheet = returning;
          await giveBack.mutateAsync({ timesheetId: sheet.id, note: reason });
          toast({
            tone: 'success',
            title: 'Timesheet returned',
            description: `${sheet.user_name ?? 'The person'} can see why and submit it again.`,
          });
          forget([sheet.id]);
        }}
      />
    </div>
  );
}

/**
 * Timesheet Approvals: the submitted timesheets of the people the caller manages (everyone's
 * with `time.read_all`), oldest week first. Look at the entries, approve one or many, or return
 * one with a required reason.
 */
export default function TimesheetApprovalsPage() {
  useDocumentTitle('Timesheet Approvals');
  const { can } = useOrg();
  return (
    <PageShell
      title="Timesheet Approvals"
      description="Approve or return the timesheets people have submitted."
    >
      {can(PERMISSIONS.timesheetApprove) ? <Page /> : <NoAccess what="approving timesheets" />}
    </PageShell>
  );
}
