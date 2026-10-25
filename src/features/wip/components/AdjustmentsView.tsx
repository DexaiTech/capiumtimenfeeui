import { Check, Ellipsis, Eye, SearchX, SlidersHorizontal, Undo2, X } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  ColumnVisibilityMenu,
  CountTabs,
  DataTable,
  DateRangeField,
  Dropdown,
  EmptyState,
  PageToolbar,
  Pagination,
  Select,
  useToast,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { ClientPicker, JobPicker } from '@/features/team';
import { usePersistentColumns, useUrlParams } from '@/hooks';
import { formatMoney } from '@/utils/money';

import {
  flattenPages,
  useAdjustmentCounts,
  useAdjustments,
  useApproveAdjustment,
  useRejectAdjustment,
  useReverseAdjustment,
} from '../api';
import { ADJUSTMENT_KIND_META, ADJUSTMENT_STATUS_META } from '../constants';
import {
  ADJUSTMENT_KINDS,
  ADJUSTMENT_STATUSES,
  type Adjustment,
  type AdjustmentFilters,
  type AdjustmentStatus,
} from '../types';
import { dialogError } from '../utils/errors';
import { isoDate, jobText, signedMoney } from '../utils/format';
import { AdjustmentDetailsDialog } from './AdjustmentDetailsDialog';
import { adjustmentColumns } from './adjustmentColumns';
import { FilterPopover } from './FilterPopover';
import { LoadError } from './PageShell';
import { ReasonDialog } from './ReasonDialog';

type Tab = 'all' | AdjustmentStatus;
type Action = 'approve' | 'reject' | 'reverse';

const DECISIONS: Record<
  Action,
  {
    title: string;
    confirm: string;
    done: string;
    label: string;
    required: boolean;
    tone: 'danger' | 'default';
    effect: string;
  }
> = {
  approve: {
    title: 'Approve this adjustment?',
    confirm: 'Approve',
    done: 'Adjustment approved',
    label: 'Note',
    required: false,
    tone: 'default',
    effect: 'It takes effect at once and counts in the WIP until the job is next billed.',
  },
  reject: {
    title: 'Reject this adjustment?',
    confirm: 'Reject',
    done: 'Adjustment rejected',
    label: 'Reason',
    required: true,
    tone: 'danger',
    effect: 'Nothing changes in the WIP. The person who asked sees the reason.',
  },
  reverse: {
    title: 'Reverse this adjustment?',
    confirm: 'Reverse',
    done: 'Adjustment reversed',
    label: 'Reason',
    required: true,
    tone: 'danger',
    effect: 'The opposite movement is written to the ledger; the original stays on record.',
  },
};

export interface AdjustmentsViewProps {
  /** Opens the form of a new adjustment (the person may adjust WIP). */
  onCreate?: () => void;
}

/** The adjustments of the practice by status, with the decisions the person may take. */
export function AdjustmentsView({ onCreate }: AdjustmentsViewProps) {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const counts = useAdjustmentCounts();

  const tabParam = params.get('status');
  const tab: Tab = ADJUSTMENT_STATUSES.find((item) => item === tabParam) ?? 'all';
  const kind = ADJUSTMENT_KINDS.find((item) => item === params.get('kind'));
  const clientId = params.get('client_id');
  const jobId = params.get('job_id');
  const from = isoDate(params.get('date_from'));
  const to = isoDate(params.get('date_to'));

  const filters: AdjustmentFilters = {
    status: tab === 'all' ? undefined : [tab],
    kind,
    client_id: clientId ?? undefined,
    job_id: jobId ?? undefined,
    date_from: from ?? undefined,
    date_to: to ?? undefined,
  };
  const list = useAdjustments(filters);
  const rows = flattenPages(list.data);

  const approve = useApproveAdjustment();
  const reject = useRejectAdjustment();
  const reverse = useReverseAdjustment();
  const [deciding, setDeciding] = useState<{ adjustment: Adjustment; action: Action } | null>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const [viewing, setViewing] = useState<Adjustment | null>(null);
  const [hidden, setHidden] = usePersistentColumns('wip-adjustments', ['requested']);

  const canApprove = can(PERMISSIONS.wipApprove);
  const canAdjust = can(PERMISSIONS.wipAdjust);
  const currency = organization.currency;
  const activeFilters =
    Number(clientId !== null) +
    Number(jobId !== null) +
    Number(kind !== undefined) +
    Number(from !== null) +
    Number(to !== null);
  const filtered = tab !== 'all' || activeFilters > 0;
  const columns = adjustmentColumns({ currency });

  const summary = counts.data;
  const total = summary
    ? summary.pending + summary.approved + summary.rejected + summary.reversed
    : null;
  const tabs = [
    { value: 'all' as Tab, label: 'All', count: total },
    ...ADJUSTMENT_STATUSES.map((status) => ({
      value: status,
      label: ADJUSTMENT_STATUS_META[status].label,
      count: summary ? summary[status] : null,
    })),
  ];

  const clearAll = () =>
    setParam({
      status: null,
      kind: null,
      client_id: null,
      job_id: null,
      date_from: null,
      date_to: null,
    });

  const decide = (text: string) => {
    if (!deciding) return;
    const { adjustment, action } = deciding;
    const callbacks = {
      onSuccess: () => {
        toast({ tone: 'success', title: DECISIONS[action].done });
        setDeciding(null);
      },
      onError: (error: unknown) => setRefusal(dialogError(error)),
    };
    if (action === 'approve') {
      approve.mutate({ adjustmentId: adjustment.id, note: text || undefined }, callbacks);
    } else if (action === 'reject') {
      reject.mutate({ adjustmentId: adjustment.id, reason: text }, callbacks);
    } else {
      reverse.mutate({ adjustmentId: adjustment.id, reason: text }, callbacks);
    }
  };

  const open = (adjustment: Adjustment, action: Action) => {
    setRefusal(null);
    setDeciding({ adjustment, action });
  };

  const actionsFor = (adjustment: Adjustment): DropdownItem[] => {
    const items: DropdownItem[] = [
      {
        id: 'details',
        label: 'Details',
        icon: <Eye aria-hidden="true" className="size-4" />,
        onSelect: () => setViewing(adjustment),
      },
    ];
    if (adjustment.status === 'pending' && canApprove) {
      items.push(
        {
          id: 'approve',
          label: 'Approve',
          icon: <Check aria-hidden="true" className="size-4" />,
          onSelect: () => open(adjustment, 'approve'),
        },
        {
          id: 'reject',
          label: 'Reject',
          tone: 'danger',
          icon: <X aria-hidden="true" className="size-4" />,
          onSelect: () => open(adjustment, 'reject'),
        },
      );
    }
    if (adjustment.status === 'approved' && adjustment.in_force && canAdjust) {
      items.push(
        { id: 'separator', separator: true },
        {
          id: 'reverse',
          label: 'Reverse',
          tone: 'danger',
          icon: <Undo2 aria-hidden="true" className="size-4" />,
          onSelect: () => open(adjustment, 'reverse'),
        },
      );
    }
    return items;
  };

  const decision = deciding ? DECISIONS[deciding.action] : null;
  const subject = deciding
    ? `${ADJUSTMENT_KIND_META[deciding.adjustment.kind].label} of ${formatMoney(deciding.adjustment.amount, currency)} on ${deciding.adjustment.job ? jobText(deciding.adjustment.job) : (deciding.adjustment.client?.name ?? 'the client')}.`
    : '';

  return (
    <>
      {canApprove && summary && summary.pending > 0 && tab !== 'pending' ? (
        <div
          role="note"
          className="flex flex-wrap items-center gap-3 rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5 text-sm text-text"
        >
          <span>
            {summary.pending === 1
              ? '1 adjustment is'
              : `${String(summary.pending)} adjustments are`}{' '}
            waiting for approval, {formatMoney(summary.pending_value, currency)} in all.
          </span>
          <Button size="sm" onClick={() => setParam({ status: 'pending' })}>
            Review
          </Button>
        </div>
      ) : null}
      {list.isError && !list.data ? (
        <LoadError
          title="Could not load the adjustments"
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : (
        <DataTable
          caption="WIP adjustments"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          hiddenColumns={hidden}
          loading={list.isPending}
          toolbar={
            <PageToolbar
              start={
                <CountTabs
                  label="Adjustment status"
                  items={tabs}
                  value={tab}
                  onChange={(value) => setParam({ status: value === 'all' ? null : value })}
                />
              }
              actions={
                <>
                  <FilterPopover
                    title="Filter adjustments"
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
                    <Select
                      label="Adjustment"
                      options={[
                        { value: '', label: 'Write-ons and write-offs' },
                        ...ADJUSTMENT_KINDS.map((item) => ({
                          value: item,
                          label: ADJUSTMENT_KIND_META[item].label,
                        })),
                      ]}
                      value={kind ?? ''}
                      onChange={(event) => setParam({ kind: event.target.value || null })}
                    />
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
            <Dropdown
              label={`Actions for the ${ADJUSTMENT_KIND_META[row.kind].label.toLowerCase()} of ${signedMoney(row.signed_amount, currency)}`}
              items={actionsFor(row)}
              trigger={<Ellipsis aria-hidden="true" className="size-5 text-text-muted" />}
            />
          )}
          empty={
            filtered ? (
              <EmptyState
                icon={<SearchX className="size-6" />}
                title="No adjustments match"
                description="Try a different status, client, job or dates."
                action={<Button onClick={clearAll}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={<SlidersHorizontal className="size-6" />}
                title="No adjustments yet"
                description="Write WIP on or off when what is billed differs from the work done: a reason is always recorded."
                action={
                  canAdjust && onCreate ? (
                    <Button variant="primary" onClick={onCreate}>
                      Adjust WIP
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
                  itemLabel={['adjustment', 'adjustments']}
                />
              </div>
            ) : undefined
          }
        />
      )}

      <AdjustmentDetailsDialog adjustment={viewing} onClose={() => setViewing(null)} />
      {deciding && decision ? (
        <ReasonDialog
          open
          onClose={() => setDeciding(null)}
          title={decision.title}
          confirmLabel={decision.confirm}
          tone={decision.tone}
          label={decision.label}
          required={decision.required}
          loading={approve.isPending || reject.isPending || reverse.isPending}
          error={refusal}
          onSubmit={decide}
        >
          <p>
            {subject} {decision.effect}
          </p>
        </ReasonDialog>
      ) : null}
    </>
  );
}
