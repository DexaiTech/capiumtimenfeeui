import { Clock, Copy, Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Dropdown,
  EmptyState,
  Skeleton,
  useToast,
  type DataTableColumn,
  type DropdownItem,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatMinutes } from '@/utils/minutes';
import { formatMoney } from '@/utils/money';

import { useDay, useDeleteEntry } from '../../api';
import type { TimeEntry } from '../../types';
import { dialogError } from '../../utils/errors';
import { describeVariance, refLabel } from '../../utils/format';
import { formatLongDay } from '../../utils/weeks';
import { BillableBadge, SheetStatusBadge } from '../badges';
import { EntryPanel } from '../EntryPanel';
import { LoadError } from '../PageShell';
import { CopyEntryDialog } from './CopyEntryDialog';

export interface DayViewProps {
  date: string;
  /** The person may record time (`time.log`). */
  canRecord: boolean;
  onAddEntry: (date: string) => void;
}

/** One day: its entries with their rates and values, the day's target and what is left of it. */
export function DayView({ date, canRecord, onAddEntry }: DayViewProps) {
  const { organization } = useOrg();
  const currency = organization.currency;
  const { toast } = useToast();
  const day = useDay('me', date);
  const remove = useDeleteEntry();
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [copying, setCopying] = useState<TimeEntry | null>(null);
  const [deleting, setDeleting] = useState<TimeEntry | null>(null);
  const [deleteError, setDeleteError] = useState<{ message: string; requestId?: string } | null>(
    null,
  );

  if (day.isError && !day.data) {
    return (
      <LoadError
        title="Could not load the day"
        error={day.error}
        onRetry={() => void day.refetch()}
        retrying={day.isRefetching}
      />
    );
  }

  const data = day.data;
  const variance = describeVariance(data?.variance_minutes ?? 0);

  const columns: DataTableColumn<TimeEntry>[] = [
    {
      id: 'what',
      header: 'Client and job',
      hideable: false,
      cell: (entry) => (
        <div className="flex flex-col">
          <span className="font-semibold text-text uppercase">
            {entry.client_name ?? 'No client'}
          </span>
          <span className="text-text-muted">
            {refLabel({ code: entry.job_number, name: entry.job_name }) || 'No job'}
            {entry.task_name ? ` · ${entry.task_name}` : ''}
          </span>
        </div>
      ),
    },
    {
      id: 'activity',
      header: 'Activity',
      cell: (entry) => (
        <div className="flex flex-col">
          <span>{entry.activity_name ?? '—'}</span>
          {entry.service_name ? (
            <span className="text-text-muted">{entry.service_name}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'description',
      header: 'Description',
      cell: (entry) => (
        <span className="block max-w-64 truncate" title={entry.description ?? undefined}>
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
      header: 'Rate and value',
      align: 'end',
      className: 'whitespace-nowrap tabular-nums',
      cell: (entry) => (
        <div className="flex flex-col items-end">
          <span>{formatMoney(entry.charge_value, currency)}</span>
          <span className="text-text-muted">{formatMoney(entry.charge_rate, currency)} / h</span>
        </div>
      ),
    },
    {
      id: 'billable',
      header: 'Billable',
      cell: (entry) => <BillableBadge billable={entry.is_billable} />,
    },
  ];

  const actionsOf = (entry: TimeEntry): DropdownItem[] => {
    const editable = canRecord && !entry.is_locked;
    return [
      {
        id: 'edit',
        label: editable ? 'Edit entry' : 'View entry',
        icon: <Pencil className="size-4" aria-hidden="true" />,
        onSelect: () => setEditing(entry),
      },
      ...(canRecord
        ? [
            {
              id: 'copy',
              label: 'Copy to another day',
              icon: <Copy className="size-4" aria-hidden="true" />,
              onSelect: () => setCopying(entry),
            },
          ]
        : []),
      ...(editable
        ? [
            { id: 'sep', separator: true as const },
            {
              id: 'delete',
              label: 'Delete entry',
              tone: 'danger' as const,
              icon: <Trash2 className="size-4" aria-hidden="true" />,
              onSelect: () => {
                setDeleteError(null);
                setDeleting(entry);
              },
            },
          ]
        : []),
    ];
  };

  return (
    <div className="flex flex-col gap-3">
      <EntryPanel open={editing !== null} entry={editing} onClose={() => setEditing(null)} />
      <Card padding="sm" className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-text">{formatLongDay(date)}</h2>
          {data ? (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <SheetStatusBadge status={data.timesheet_status} />
              {!data.is_working_day ? <span>Day off</span> : null}
            </div>
          ) : (
            <Skeleton className="h-4 w-24" shape="rect" />
          )}
        </div>
        {data ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-5">
            <div>
              <dt className="text-text-muted">Logged</dt>
              <dd className="font-semibold text-text tabular-nums">
                {formatMinutes(data.total_minutes)}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Target</dt>
              <dd className="font-semibold text-text tabular-nums">
                {data.target_minutes > 0 ? formatMinutes(data.target_minutes) : 'Day off'}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Remaining</dt>
              <dd className="font-semibold text-text tabular-nums">
                {formatMinutes(data.remaining_minutes)}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Over or under</dt>
              <dd className="font-semibold text-text tabular-nums">{variance.text}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Billable</dt>
              <dd className="font-semibold text-text tabular-nums">
                {formatMinutes(data.billable_minutes)}
              </dd>
            </div>
          </dl>
        ) : null}
      </Card>

      <DataTable
        caption={`Time recorded on ${formatLongDay(date)}`}
        columns={columns}
        rows={data?.entries ?? []}
        rowKey={(entry) => entry.id}
        loading={day.isPending}
        rowActions={(entry) => (
          <Dropdown
            label={`Actions for ${refLabel({ code: entry.job_number, name: entry.job_name }) || entry.client_name || 'the entry'}, ${formatMinutes(entry.minutes)}`}
            trigger={<Ellipsis className="size-4" aria-hidden="true" />}
            items={actionsOf(entry)}
          />
        )}
        empty={
          <EmptyState
            icon={<Clock className="size-6" />}
            title="No time recorded on this day"
            description={
              canRecord
                ? 'Record time for the day, or start the timer.'
                : 'Nothing was recorded on this day.'
            }
            action={
              canRecord ? (
                <Button variant="brand-outline" onClick={() => onAddEntry(date)}>
                  Add entry
                </Button>
              ) : undefined
            }
          />
        }
      />

      <CopyEntryDialog open={copying !== null} entry={copying} onClose={() => setCopying(null)} />
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
            onError: (error) => setDeleteError(dialogError(error)),
          });
        }}
        title="Delete this time entry?"
        confirmLabel="Delete entry"
        loading={remove.isPending}
        error={deleteError}
      >
        <p>
          {deleting
            ? `${formatMinutes(deleting.minutes)} on ${formatLongDay(deleting.entry_date)}`
            : ''}{' '}
          will be removed from your timesheet.
        </p>
      </ConfirmDialog>
    </div>
  );
}
