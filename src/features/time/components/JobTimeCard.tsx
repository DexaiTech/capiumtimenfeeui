import { Clock, Pencil, Trash2, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Pagination,
  RowActions,
  useToast,
  type DataTableColumn,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/features/auth';
import { useOrg } from '@/features/organizations';
import { formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';
import { formatMoney } from '@/utils/money';

import {
  flattenPages,
  useDeleteEntry,
  useReopenTimesheet,
  useStaffDirectory,
  useTimeEntryList,
} from '../api';
import type { TimeEntry, TimeEntryFilters } from '../types';
import { dialogError } from '../utils/errors';
import { SheetStatusBadge, BillingStatusBadge } from './badges';
import { EntryPanel } from './EntryPanel';
import { LoadError } from './PageShell';

type Refusal = { message: string; requestId?: string } | null;

/** Why a locked entry cannot be deleted, and what to do about it. */
function lockedReason(entry: TimeEntry, canRevoke: boolean): string {
  if (entry.billing_status !== 'unbilled') return 'billed time is locked';
  if (entry.timesheet_status === 'approved') {
    return canRevoke ? 'revoke approval first' : 'approved time is locked';
  }
  return 'the timesheet is submitted';
}

/**
 * The time recorded on one job (`GET /time-entries?job_id=`): everyone's with `time.read_all`,
 * otherwise the caller's own. A person deletes or edits unbilled time on an open or returned
 * timesheet; approved time is first released with "Revoke approval" (`timesheet.approve`), which
 * reopens that person's week.
 */
export function JobTimeCard({ jobId, jobNumber }: { jobId: string; jobNumber: string }) {
  const { organization, can } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const canReadAll = can(PERMISSIONS.timeReadAll);
  const allowed = can(PERMISSIONS.timeLog) || canReadAll;
  const filters = useMemo<TimeEntryFilters>(
    () => ({ user_id: canReadAll ? 'all' : 'me', job_id: jobId }),
    [canReadAll, jobId],
  );
  const list = useTimeEntryList(filters, { enabled: allowed });
  const staff = useStaffDirectory({ enabled: canReadAll && can(PERMISSIONS.memberRead) });
  const remove = useDeleteEntry();
  const reopen = useReopenTimesheet();
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [deleting, setDeleting] = useState<TimeEntry | null>(null);
  const [revoking, setRevoking] = useState<TimeEntry | null>(null);
  const [refusal, setRefusal] = useState<Refusal>(null);

  if (!allowed) return null;

  const currency = organization.currency;
  const names = new Map((staff.data ?? []).map((member) => [member.id, member.full_name]));
  const personName = (userId: string) =>
    userId === user?.id ? 'You' : (names.get(userId) ?? 'Another person');

  const mayWrite = (entry: TimeEntry) =>
    entry.user_id === user?.id ? can(PERMISSIONS.timeLog) : can(PERMISSIONS.timeManageAll);
  // Nobody decides on their own timesheet unless they hold `organization.update`.
  const canRevoke = (entry: TimeEntry) =>
    entry.timesheet_status === 'approved' &&
    entry.billing_status === 'unbilled' &&
    can(PERMISSIONS.timesheetApprove) &&
    (entry.user_id !== user?.id || can(PERMISSIONS.organizationUpdate));

  const actionsOf = (entry: TimeEntry): DropdownItem[] => {
    const writable = mayWrite(entry);
    const revocable = canRevoke(entry);
    const actions: DropdownItem[] = [];
    if (writable && !entry.is_locked) {
      actions.push({
        id: 'edit',
        label: 'Edit entry',
        icon: <Pencil className="size-4" aria-hidden="true" />,
        onSelect: () => setEditing(entry),
      });
    }
    if (revocable) {
      actions.push({
        id: 'revoke',
        label: 'Revoke approval',
        icon: <Undo2 className="size-4" aria-hidden="true" />,
        onSelect: () => {
          setRefusal(null);
          setRevoking(entry);
        },
      });
    }
    if (writable) {
      actions.push({
        id: 'delete',
        label: entry.is_locked
          ? `Delete entry (${lockedReason(entry, revocable)})`
          : 'Delete entry',
        tone: 'danger',
        icon: <Trash2 className="size-4" aria-hidden="true" />,
        disabled: entry.is_locked,
        onSelect: () => {
          setRefusal(null);
          setDeleting(entry);
        },
      });
    }
    return actions;
  };

  const columns: DataTableColumn<TimeEntry>[] = [
    {
      id: 'date',
      header: 'Date',
      className: 'whitespace-nowrap',
      cell: (entry) => formatUkDate(entry.entry_date),
    },
    ...(canReadAll
      ? [
          {
            id: 'person',
            header: 'Person',
            cell: (entry: TimeEntry) => personName(entry.user_id),
          } satisfies DataTableColumn<TimeEntry>,
        ]
      : []),
    {
      id: 'activity',
      header: 'Activity',
      cell: (entry) => (
        <div className="flex flex-col">
          <span>{entry.activity_name ?? '—'}</span>
          {entry.task_name ? <span className="text-text-muted">{entry.task_name}</span> : null}
        </div>
      ),
    },
    {
      id: 'description',
      header: 'Description',
      cell: (entry) => (
        <span className="block max-w-56 truncate" title={entry.description ?? undefined}>
          {entry.description ?? '—'}
        </span>
      ),
    },
    {
      id: 'time',
      header: 'Time',
      align: 'end',
      className: 'whitespace-nowrap tabular-nums',
      cell: (entry) => <span className="font-semibold">{formatMinutes(entry.minutes)}</span>,
    },
    {
      id: 'value',
      header: 'Value',
      align: 'end',
      className: 'whitespace-nowrap tabular-nums',
      cell: (entry) => formatMoney(entry.charge_value, currency),
    },
    {
      id: 'timesheet',
      header: 'Timesheet',
      cell: (entry) => <SheetStatusBadge status={entry.timesheet_status} />,
    },
    {
      id: 'billing',
      header: 'Billed',
      cell: (entry) => <BillingStatusBadge status={entry.billing_status} />,
    },
  ];

  const rows = flattenPages(list.data);
  const describe = (entry: TimeEntry) =>
    `${formatMinutes(entry.minutes)} on ${formatUkDate(entry.entry_date)}`;

  return (
    <Card padding="none">
      <CardHeader
        title="Time"
        description={
          canReadAll ? 'The time recorded on this job.' : 'The time you recorded on this job.'
        }
      />
      {list.isError && !list.data ? (
        <div className="p-4">
          <LoadError
            title="Could not load the time"
            error={list.error}
            onRetry={() => void list.refetch()}
            retrying={list.isRefetching}
          />
        </div>
      ) : (
        <DataTable
          caption={`Time on ${jobNumber}`}
          columns={columns}
          rows={rows}
          rowKey={(entry) => entry.id}
          loading={list.isPending}
          rowActions={(entry) => (
            <RowActions
              label={`Actions for the entry of ${describe(entry)}`}
              items={actionsOf(entry)}
            />
          )}
          empty={
            <EmptyState
              icon={<Clock className="size-6" />}
              title="No time recorded on this job"
              description="Time recorded against the job is listed here."
            />
          }
          footer={
            rows.length > 0 ? (
              <div className="border-t border-row-border px-4 py-2">
                <Pagination
                  hasMore={list.hasNextPage}
                  onLoadMore={() => void list.fetchNextPage()}
                  loading={list.isFetchingNextPage}
                  count={rows.length}
                  itemLabel={['entry', 'entries']}
                />
              </div>
            ) : null
          }
        />
      )}

      <EntryPanel open={editing !== null} entry={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast({ tone: 'success', title: 'Time entry deleted' });
              setDeleting(null);
            },
            onError: (error) => setRefusal(dialogError(error)),
          });
        }}
        title="Delete this time entry?"
        confirmLabel="Delete entry"
        loading={remove.isPending}
        error={refusal}
      >
        <p>{deleting ? `${describe(deleting)} will be removed for good.` : ''}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={() => {
          if (!revoking) return;
          reopen.mutate(revoking.timesheet_id, {
            onSuccess: () => {
              toast({
                tone: 'success',
                title: 'Approval revoked',
                description: 'The time can now be edited or deleted.',
              });
              setRevoking(null);
            },
            onError: (error) => setRefusal(dialogError(error)),
          });
        }}
        title="Revoke approval of this week?"
        confirmLabel="Revoke approval"
        tone="default"
        loading={reopen.isPending}
        error={refusal}
      >
        <p>
          {revoking ? `${personName(revoking.user_id)}, ${describe(revoking)}. ` : ''}
          The whole week goes back to open, so its time can be edited or deleted and the week
          submitted again. It cannot be revoked once any of its time is billed.
        </p>
      </ConfirmDialog>
    </Card>
  );
}
