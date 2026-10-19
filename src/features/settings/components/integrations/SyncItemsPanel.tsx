import { ListChecks, SearchX } from 'lucide-react';
import { useState } from 'react';

import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Pagination,
  SearchField,
  Select,
  useToast,
  type DataTableColumn,
} from '@/components/ui';
import { useDebouncedValue } from '@/hooks';

import { flattenPages, useRetrySyncItem, useSyncItems } from '../../api/adminHooks';
import type { IntegrationKey, ItemStatus, SyncItem, SyncItemFilters } from '../../adminTypes';
import { describeError } from '../../utils/errors';
import {
  entityName,
  INTEGRATION_KEYS,
  INTEGRATION_NAMES,
  ITEM_STATUS,
  RETRY_OUTCOME,
  words,
} from '../../utils/integrations';
import { LoadError } from '../LoadError';
import { RelativeTime } from '../RelativeTime';

const INTEGRATION_OPTIONS = [
  { value: '', label: 'All integrations' },
  ...INTEGRATION_KEYS.map((key) => ({ value: key, label: INTEGRATION_NAMES[key] })),
];

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  ...(Object.keys(ITEM_STATUS) as ItemStatus[]).map((status) => ({
    value: status,
    label: ITEM_STATUS[status].label,
  })),
];

export interface SyncItemsPanelProps {
  integration: IntegrationKey | '';
  onIntegrationChange: (integration: IntegrationKey | '') => void;
  /** Holds `integration.manage`: only then can an item be retried. */
  canManage: boolean;
}

/** What is waiting to be sent to another system, what was sent and what failed and why. */
export function SyncItemsPanel({
  integration,
  onIntegrationChange,
  canManage,
}: SyncItemsPanelProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<ItemStatus | ''>('');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search, 300).trim();
  const filters: SyncItemFilters = {
    integration: integration || undefined,
    status: status || undefined,
    q: q || undefined,
  };
  const items = useSyncItems(filters);
  const retry = useRetrySyncItem();
  const rows = flattenPages(items.data);
  const filtered = integration !== '' || status !== '' || q !== '';

  const retryItem = (item: SyncItem) =>
    retry.mutate(item.id, {
      onSuccess: (result) => {
        const outcome = RETRY_OUTCOME[result.outcome];
        toast({ tone: outcome.tone, title: `${item.label ?? 'Item'}: ${outcome.title}` });
      },
      onError: (error) =>
        toast({ tone: 'error', ...describeError(error, 'Could not retry the item') }),
    });

  const columns: DataTableColumn<SyncItem>[] = [
    {
      id: 'record',
      header: 'Record',
      hideable: false,
      className: 'min-w-40',
      cell: (item) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-text">{item.label ?? 'Unnamed record'}</span>
          <span className="text-xs text-text-muted">{entityName(item.entity_type)}</span>
        </div>
      ),
    },
    {
      id: 'integration',
      header: 'Integration',
      className: 'whitespace-nowrap',
      cell: (item) => <span className="text-text">{INTEGRATION_NAMES[item.integration]}</span>,
    },
    {
      id: 'operation',
      header: 'Action',
      className: 'whitespace-nowrap',
      cell: (item) => <span className="text-text">{words(item.operation)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      className: 'whitespace-nowrap',
      cell: (item) => (
        <div className="flex flex-col items-start gap-0.5">
          <Badge tone={ITEM_STATUS[item.status].tone} size="sm">
            {ITEM_STATUS[item.status].label}
          </Badge>
          {item.status === 'pending' && item.next_attempt_at ? (
            <span className="text-xs text-text-muted">
              Next try <RelativeTime iso={item.next_attempt_at} />
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'attempts',
      header: 'Attempts',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (item) => (
        <span className="tabular-nums text-text">
          {item.attempts} of {item.max_attempts}
        </span>
      ),
    },
    {
      id: 'result',
      header: 'Result',
      className: 'min-w-56 max-w-96',
      cell: (item) => {
        if (item.status === 'ok') {
          return (
            <span className="text-text">
              {item.external_ref ? `Reference ${item.external_ref}` : 'Sent'}
            </span>
          );
        }
        if (!item.last_error) return <span className="text-text-subtle">—</span>;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-text">{item.last_error}</span>
            {item.last_error_code ? (
              <span className="font-mono text-xs text-text-muted">{item.last_error_code}</span>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <Select
          label="Integration"
          options={INTEGRATION_OPTIONS}
          value={integration}
          onChange={(event) => onIntegrationChange(event.target.value as IntegrationKey | '')}
          className="w-full sm:w-52"
        />
        <Select
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(event) => setStatus(event.target.value as ItemStatus | '')}
          className="w-full sm:w-40"
        />
        <SearchField
          label="Search sync items"
          placeholder="Record or error"
          value={search}
          onChange={setSearch}
        />
      </div>

      {items.isError && !items.data ? (
        <LoadError
          title="Could not load the sync items"
          error={items.error}
          onRetry={() => void items.refetch()}
          retrying={items.isRefetching}
        />
      ) : (
        <>
          <DataTable
            caption="Sync items"
            columns={columns}
            rows={rows}
            rowKey={(item) => item.id}
            loading={items.isPending}
            rowActions={
              canManage
                ? (item) =>
                    item.status === 'failed' || item.status === 'pending' ? (
                      <Button
                        size="sm"
                        aria-label={`Retry ${item.label ?? 'item'}`}
                        loading={retry.isPending && retry.variables === item.id}
                        disabled={retry.isPending}
                        onClick={() => retryItem(item)}
                      >
                        Retry
                      </Button>
                    ) : null
                : undefined
            }
            empty={
              filtered ? (
                <EmptyState
                  icon={<SearchX className="size-6" />}
                  title="No sync items match"
                  description="Try another integration or status."
                />
              ) : (
                <EmptyState
                  icon={<ListChecks className="size-6" />}
                  title="Nothing to sync yet"
                  description="Documents and statuses queued for another system appear here."
                />
              )
            }
          />
          {rows.length > 0 ? (
            <Pagination
              hasMore={items.hasNextPage}
              onLoadMore={() => void items.fetchNextPage()}
              loading={items.isFetchingNextPage}
              count={rows.length}
              itemLabel={['item', 'items']}
              loadMoreLabel="Load more items"
              endLabel="End of the list"
            />
          ) : null}
        </>
      )}
    </div>
  );
}
