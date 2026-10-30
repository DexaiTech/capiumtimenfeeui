import { Clock } from 'lucide-react';
import { useMemo } from 'react';

import {
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  Pagination,
  RowActions,
  type DataTableColumn,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/features/auth';
import { useOrg } from '@/features/organizations';
import { formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';
import { formatMoney } from '@/utils/money';

import { flattenPages, useStaffDirectory, useTimeEntryList } from '../api';
import type { TimeEntry, TimeEntryFilters } from '../types';
import { describeEntry } from '../utils/format';
import { SheetStatusBadge, BillingStatusBadge } from './badges';
import { useEntryActions } from './EntryActions';
import { LoadError } from './PageShell';

export interface JobTimeCardProps {
  jobId: string;
  jobNumber: string;
  /** Only this person's time (the budget's "time by person" opens it; needs `time.read_all`). */
  person?: { id: string; name: string } | null;
  /** Back to everyone's time. */
  onShowEveryone?: () => void;
}

/**
 * The time recorded on one job (`GET /time-entries?job_id=`): everyone's with `time.read_all`,
 * otherwise the caller's own, or one person's. A person edits or deletes unbilled time on an open
 * or returned timesheet outside a locked period; locked time opens read-only and its delete says
 * why. Approved time is first released with "Revoke approval" (`timesheet.approve`), which reopens
 * that person's week (see `useEntryActions`).
 */
export function JobTimeCard({ jobId, jobNumber, person, onShowEveryone }: JobTimeCardProps) {
  const { organization, can } = useOrg();
  const { user } = useAuth();
  const canReadAll = can(PERMISSIONS.timeReadAll);
  const allowed = can(PERMISSIONS.timeLog) || canReadAll;
  const personId = canReadAll ? person?.id : undefined;
  const filters = useMemo<TimeEntryFilters>(
    () => ({ user_id: personId ?? (canReadAll ? 'all' : 'me'), job_id: jobId }),
    [canReadAll, personId, jobId],
  );
  const list = useTimeEntryList(filters, { enabled: allowed });
  const staff = useStaffDirectory({ enabled: canReadAll && can(PERMISSIONS.memberRead) });
  const names = new Map((staff.data ?? []).map((member) => [member.id, member.full_name]));
  const personName = (userId: string) =>
    userId === user?.id ? 'You' : (names.get(userId) ?? 'Another person');
  const entryActions = useEntryActions({ personName });

  if (!allowed) return null;

  const currency = organization.currency;

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

  return (
    <Card padding="none">
      <CardHeader
        title="Time"
        description={
          personId && person
            ? `The time ${person.id === user?.id ? 'you' : person.name} recorded on this job.`
            : canReadAll
              ? 'The time recorded on this job.'
              : 'The time you recorded on this job.'
        }
        actions={
          personId && onShowEveryone ? (
            <Button size="sm" onClick={onShowEveryone}>
              Show everyone
            </Button>
          ) : undefined
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
              label={`Actions for the entry of ${describeEntry(entry)}`}
              items={entryActions.actionsOf(entry)}
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

      {entryActions.dialogs}
    </Card>
  );
}
