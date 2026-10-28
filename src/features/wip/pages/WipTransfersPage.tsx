import { ArrowLeftRight, Eye, Plus, SearchX, Undo2 } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  ColumnVisibilityMenu,
  CountTabs,
  DataTable,
  DateRangeField,
  EmptyState,
  PageToolbar,
  Pagination,
  useToast,
  type DropdownItem,
  RowActions,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { ClientPicker, JobPicker } from '@/features/team';
import { useDocumentTitle, usePersistentColumns, useUrlParams } from '@/hooks';
import { formatMoney } from '@/utils/money';

import { flattenPages, useReverseTransfer, useTransfers } from '../api';
import { FilterPopover } from '../components/FilterPopover';
import { LoadError, PageShell } from '../components/PageShell';
import { ReasonDialog } from '../components/ReasonDialog';
import { TransferDialog } from '../components/TransferDialog';
import { TransferDetailsDialog } from '../components/TransferDetailsDialog';
import { transferColumns } from '../components/transferColumns';
import { TRANSFER_STATUS_META } from '../constants';
import {
  TRANSFER_STATUSES,
  type Transfer,
  type TransferFilters,
  type TransferStatus,
} from '../types';
import { dialogError } from '../utils/errors';
import { isoDate, jobText } from '../utils/format';

type Tab = 'all' | TransferStatus;

const TABS: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: 'all', label: 'All transfers' },
  ...TRANSFER_STATUSES.map((status) => ({
    value: status,
    label: TRANSFER_STATUS_META[status].label,
  })),
];

/** /:orgSlug/wip/transfers: WIP moved between the jobs of one client, each reversible. */
export default function WipTransfersPage() {
  useDocumentTitle('WIP Transfers');
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();

  const tab: Tab = TABS.find((item) => item.value === params.get('status'))?.value ?? 'all';
  const clientId = params.get('client_id');
  const jobId = params.get('job_id');
  const from = isoDate(params.get('date_from'));
  const to = isoDate(params.get('date_to'));

  const filters: TransferFilters = {
    status: tab === 'all' ? undefined : tab,
    client_id: clientId ?? undefined,
    job_id: jobId ?? undefined,
    date_from: from ?? undefined,
    date_to: to ?? undefined,
  };
  const list = useTransfers(filters);
  const rows = flattenPages(list.data);
  const reverse = useReverseTransfer();

  const canTransfer = can(PERMISSIONS.wipTransfer);
  const currency = organization.currency;
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Transfer | null>(null);
  const [reversing, setReversing] = useState<Transfer | null>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const [hidden, setHidden] = usePersistentColumns('wip-transfers', ['by']);

  const activeFilters =
    Number(clientId !== null) +
    Number(jobId !== null) +
    Number(from !== null) +
    Number(to !== null);
  const filtered = tab !== 'all' || activeFilters > 0;
  const columns = transferColumns(currency);

  const clearAll = () =>
    setParam({ status: null, client_id: null, job_id: null, date_from: null, date_to: null });

  const confirmReverse = (reason: string) => {
    if (!reversing) return;
    reverse.mutate(
      { transferId: reversing.id, reason },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: 'Transfer reversed' });
          setReversing(null);
        },
        onError: (error) => setRefusal(dialogError(error)),
      },
    );
  };

  const actionsFor = (transfer: Transfer): DropdownItem[] => {
    const items: DropdownItem[] = [
      {
        id: 'details',
        label: 'Details',
        icon: <Eye aria-hidden="true" className="size-4" />,
        onSelect: () => setViewing(transfer),
      },
    ];
    if (transfer.status === 'applied' && canTransfer) {
      items.push(
        { id: 'separator', separator: true },
        {
          id: 'reverse',
          label: 'Reverse',
          tone: 'danger',
          icon: <Undo2 aria-hidden="true" className="size-4" />,
          onSelect: () => {
            setRefusal(null);
            setReversing(transfer);
          },
        },
      );
    }
    return items;
  };

  const newTransfer = canTransfer ? (
    <Button
      variant="primary"
      size="sm"
      leftIcon={<Plus aria-hidden="true" className="size-4" />}
      onClick={() => setCreating(true)}
    >
      Transfer WIP
    </Button>
  ) : undefined;

  return (
    <PageShell
      title="WIP Transfers"
      description="Move work in progress between two jobs of the same client. A transfer can be reversed until either job is billed."
      actions={newTransfer}
    >
      {list.isError && !list.data ? (
        <LoadError
          title="Could not load the transfers"
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : (
        <DataTable
          caption="WIP transfers"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          hiddenColumns={hidden}
          loading={list.isPending}
          toolbar={
            <PageToolbar
              start={
                <CountTabs
                  label="Transfer status"
                  items={TABS}
                  value={tab}
                  onChange={(value) => setParam({ status: value === 'all' ? null : value })}
                />
              }
              actions={
                <>
                  <FilterPopover title="Filter transfers" count={activeFilters} onClear={clearAll}>
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
                        hint="Either the job the WIP left or the one it went to"
                        clearable
                        value={jobId}
                        clientId={clientId}
                        onChange={(job) => setParam({ job_id: job?.id ?? null })}
                      />
                    ) : null}
                    <DateRangeField
                      label="Effective date"
                      value={{ from, to }}
                      onChange={(range) => setParam({ date_from: range.from, date_to: range.to })}
                    />
                  </FilterPopover>
                  <ColumnVisibilityMenu
                    columns={columns.map((column) => ({
                      id: column.id,
                      label: column.header,
                      locked: column.hideable === false,
                    }))}
                    hidden={hidden}
                    onChange={setHidden}
                  />
                </>
              }
            />
          }
          rowActions={(row) => (
            <RowActions
              label={`Actions for the transfer of ${formatMoney(row.amount, currency)}`}
              items={actionsFor(row)}
            />
          )}
          empty={
            filtered ? (
              <EmptyState
                icon={<SearchX className="size-6" />}
                title="No transfers match"
                description="Try a different status, client, job or dates."
                action={<Button onClick={clearAll}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={<ArrowLeftRight className="size-6" />}
                title="No transfers yet"
                description="When time or expenses were booked to the wrong job, move their value to the right one here."
                action={
                  canTransfer ? (
                    <Button variant="primary" onClick={() => setCreating(true)}>
                      Transfer WIP
                    </Button>
                  ) : undefined
                }
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
                  itemLabel={['transfer', 'transfers']}
                />
              </div>
            ) : undefined
          }
        />
      )}

      <TransferDialog
        open={creating}
        onClose={() => setCreating(false)}
        onDone={() => setCreating(false)}
      />
      <TransferDetailsDialog transfer={viewing} onClose={() => setViewing(null)} />
      {reversing ? (
        <ReasonDialog
          open
          onClose={() => setReversing(null)}
          title="Reverse this transfer?"
          confirmLabel="Reverse transfer"
          tone="danger"
          loading={reverse.isPending}
          error={refusal}
          onSubmit={confirmReverse}
        >
          <p>
            {formatMoney(reversing.amount, currency)} goes back from {jobText(reversing.to_job)} to{' '}
            {jobText(reversing.from_job)}. The original transfer stays on record.
          </p>
        </ReasonDialog>
      ) : null}
    </PageShell>
  );
}
