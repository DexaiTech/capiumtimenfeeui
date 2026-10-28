import { FileMinus, SearchX, Undo2 } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  ConfirmDialog,
  DataTable,
  DateRangeField,
  EmptyState,
  PageToolbar,
  Pagination,
  useToast,
  type DataTableColumn,
  RowActions,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { ClientPicker, JobPicker } from '@/features/team';
import { useUrlParams } from '@/hooks';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { flattenPages, useMemberNames, useReverseWriteOff, useWriteOffs } from '../api';
import type { WriteOff, WriteOffFilters } from '../types';
import { dialogError } from '../utils/errors';
import { isoDate } from '../utils/format';
import { FilterPopover } from './FilterPopover';
import { LoadError } from './PageShell';

function writeOffColumns(
  currency: string,
  nameOf: (userId: string | null | undefined) => string | null,
): DataTableColumn<WriteOff>[] {
  return [
    {
      id: 'date',
      header: 'Written off on',
      className: 'whitespace-nowrap',
      cell: (row) => <span className="text-text">{formatUkDate(row.written_off_on)}</span>,
    },
    {
      id: 'client',
      header: 'Client',
      className: 'min-w-40 max-w-64',
      cell: (row) => (
        <span className="block truncate text-text" title={row.client?.name}>
          {row.client?.name ?? '—'}
        </span>
      ),
    },
    {
      id: 'items',
      header: 'Items',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-text">
            {row.item_count === 1 ? '1 item' : `${String(row.item_count)} items`}
          </span>
          {row.job_id ? (
            <span className="text-xs text-text-muted">All the WIP of a job</span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <span className="font-semibold tabular-nums text-danger">
          {formatMoney(-row.total_wip_value, currency)}
        </span>
      ),
    },
    {
      id: 'reason',
      header: 'Reason',
      className: 'min-w-56 max-w-96',
      cell: (row) => (
        <span className="block truncate text-text" title={row.reason}>
          {row.reason}
        </span>
      ),
    },
    {
      id: 'by',
      header: 'By',
      className: 'whitespace-nowrap',
      cell: (row) => <span className="text-text">{nameOf(row.created_by) ?? '—'}</span>,
    },
  ];
}

/**
 * The work written off from the WIP items, newest first. A write-off is not a ledger movement: it
 * is reversed here, and the items return to the WIP as long as none has been billed since.
 */
export function WriteOffsView() {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const nameOf = useMemberNames();

  const clientId = params.get('client_id');
  const jobId = params.get('job_id');
  const from = isoDate(params.get('date_from'));
  const to = isoDate(params.get('date_to'));

  const filters: WriteOffFilters = {
    client_id: clientId ?? undefined,
    job_id: jobId ?? undefined,
    date_from: from ?? undefined,
    date_to: to ?? undefined,
  };
  const list = useWriteOffs(filters);
  const rows = flattenPages(list.data);
  const remove = useReverseWriteOff();

  const [reversing, setReversing] = useState<WriteOff | null>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);

  const currency = organization.currency;
  const activeFilters =
    Number(clientId !== null) +
    Number(jobId !== null) +
    Number(from !== null) +
    Number(to !== null);
  const canWriteOff = can(PERMISSIONS.wipWriteOff);

  const clearAll = () =>
    setParam({ client_id: null, job_id: null, date_from: null, date_to: null });

  const confirm = () => {
    if (!reversing) return;
    remove.mutate(reversing.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Write-off reversed' });
        setReversing(null);
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  return (
    <>
      {list.isError && !list.data ? (
        <LoadError
          title="Could not load the write-offs"
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : (
        <DataTable
          caption="WIP write-offs"
          columns={writeOffColumns(currency, nameOf)}
          rows={rows}
          rowKey={(row) => row.id}
          loading={list.isPending}
          toolbar={
            <PageToolbar
              actions={
                <FilterPopover
                  title="Filter the write-offs"
                  count={activeFilters}
                  onClear={clearAll}
                >
                  {can(PERMISSIONS.clientRead) ? (
                    <ClientPicker
                      label="Client"
                      clearable
                      value={clientId}
                      onChange={(id) => setParam({ client_id: id, job_id: null })}
                    />
                  ) : null}
                  {can(PERMISSIONS.jobRead) ? (
                    <JobPicker
                      label="Job"
                      clearable
                      value={jobId}
                      clientId={clientId}
                      onChange={(job) => setParam({ job_id: job?.id ?? null })}
                    />
                  ) : null}
                  <DateRangeField
                    label="Written off on"
                    value={{ from, to }}
                    onChange={(range) => setParam({ date_from: range.from, date_to: range.to })}
                  />
                </FilterPopover>
              }
            />
          }
          rowActions={(row) =>
            canWriteOff ? (
              <RowActions
                label={`Actions for the write-off of ${formatMoney(row.total_wip_value, currency)}`}
                items={[
                  {
                    id: 'reverse',
                    label: 'Reverse the write-off',
                    tone: 'danger',
                    icon: <Undo2 aria-hidden="true" className="size-4" />,
                    onSelect: () => {
                      setRefusal(null);
                      setReversing(row);
                    },
                  },
                ]}
              />
            ) : null
          }
          empty={
            activeFilters > 0 ? (
              <EmptyState
                icon={<SearchX className="size-6" />}
                title="No write-offs match"
                description="Try a different client, job or dates."
                action={<Button onClick={clearAll}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={<FileMinus className="size-6" />}
                title="No write-offs yet"
                description="Work written off from the WIP details is listed here, and can be reversed until it has been billed."
              />
            )
          }
          footer={
            rows.length > 0 ? (
              <div className="border-t border-row-border px-4 py-3">
                <Pagination
                  hasMore={list.hasNextPage}
                  onLoadMore={() => void list.fetchNextPage()}
                  loading={list.isFetchingNextPage}
                  count={rows.length}
                  itemLabel={['write-off', 'write-offs']}
                />
              </div>
            ) : undefined
          }
        />
      )}

      <ConfirmDialog
        open={reversing !== null}
        onClose={() => setReversing(null)}
        onConfirm={confirm}
        title="Reverse this write-off?"
        confirmLabel="Reverse write-off"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          The items written off return to the work in progress, as long as none of them has been
          billed since.
        </p>
      </ConfirmDialog>
    </>
  );
}
