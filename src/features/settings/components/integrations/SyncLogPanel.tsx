import { ScrollText, SearchX } from 'lucide-react';
import { useState } from 'react';

import {
  Badge,
  DataTable,
  EmptyState,
  Pagination,
  Select,
  type DataTableColumn,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatUkDateTime } from '@/utils/dates';

import { flattenPages, useSyncLogs } from '../../api/adminHooks';
import type { IntegrationKey, SyncLogEntry, SyncLogFilters, SyncStatus } from '../../adminTypes';
import {
  entityName,
  INTEGRATION_KEYS,
  INTEGRATION_NAMES,
  LOG_STATUS,
  words,
} from '../../utils/integrations';
import { LoadError } from '../LoadError';

const INTEGRATION_OPTIONS = [
  { value: '', label: 'All integrations' },
  ...INTEGRATION_KEYS.map((key) => ({ value: key, label: INTEGRATION_NAMES[key] })),
];

const STATUS_OPTIONS = [
  { value: '', label: 'Any outcome' },
  ...(Object.keys(LOG_STATUS) as SyncStatus[]).map((status) => ({
    value: status,
    label: LOG_STATUS[status].label,
  })),
];

export interface SyncLogPanelProps {
  integration: IntegrationKey | '';
  onIntegrationChange: (integration: IntegrationKey | '') => void;
}

/** Every attempt to synchronise with another system, newest first, whether it worked or not. */
export function SyncLogPanel({ integration, onIntegrationChange }: SyncLogPanelProps) {
  const { organization } = useOrg();
  const [status, setStatus] = useState<SyncStatus | ''>('');
  const filters: SyncLogFilters = {
    integration: integration || undefined,
    status: status || undefined,
  };
  const logs = useSyncLogs(filters);
  const rows = flattenPages(logs.data);
  const filtered = integration !== '' || status !== '';

  const columns: DataTableColumn<SyncLogEntry>[] = [
    {
      id: 'when',
      header: 'When',
      hideable: false,
      className: 'whitespace-nowrap',
      cell: (entry) => (
        <span className="text-text">
          {formatUkDateTime(entry.created_at, organization.timezone)}
        </span>
      ),
    },
    {
      id: 'integration',
      header: 'Integration',
      className: 'whitespace-nowrap',
      cell: (entry) => (
        <span className="text-text">
          {INTEGRATION_NAMES[entry.integration as IntegrationKey] ?? words(entry.integration)}
        </span>
      ),
    },
    {
      id: 'operation',
      header: 'Action',
      className: 'whitespace-nowrap',
      cell: (entry) => (
        <div className="flex flex-col">
          <span className="text-text">{words(entry.operation)}</span>
          <span className="text-xs text-text-muted">
            {entry.direction === 'inbound' ? 'Received' : 'Sent'}
          </span>
        </div>
      ),
    },
    {
      id: 'record',
      header: 'Record',
      className: 'min-w-32',
      cell: (entry) =>
        entry.entity_type ? (
          <span className="text-text">{entityName(entry.entity_type)}</span>
        ) : (
          <span className="text-text-subtle">—</span>
        ),
    },
    {
      id: 'status',
      header: 'Outcome',
      className: 'whitespace-nowrap',
      cell: (entry) => (
        <Badge tone={LOG_STATUS[entry.status].tone} size="sm">
          {LOG_STATUS[entry.status].label}
        </Badge>
      ),
    },
    {
      id: 'attempt',
      header: 'Attempt',
      align: 'end',
      cell: (entry) => <span className="tabular-nums text-text">{entry.attempt}</span>,
    },
    {
      id: 'message',
      header: 'What happened',
      className: 'min-w-56 max-w-96',
      cell: (entry) =>
        entry.message ? (
          <span className="text-text">{entry.message}</span>
        ) : (
          <span className="text-text-subtle">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Select
          label="Integration"
          options={INTEGRATION_OPTIONS}
          value={integration}
          onChange={(event) => onIntegrationChange(event.target.value as IntegrationKey | '')}
          className="w-full sm:w-52"
        />
        <Select
          label="Outcome"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(event) => setStatus(event.target.value as SyncStatus | '')}
          className="w-full sm:w-40"
        />
      </div>

      {logs.isError && !logs.data ? (
        <LoadError
          title="Could not load the sync log"
          error={logs.error}
          onRetry={() => void logs.refetch()}
          retrying={logs.isRefetching}
        />
      ) : (
        <>
          <DataTable
            caption="Sync log"
            columns={columns}
            rows={rows}
            rowKey={(entry) => entry.id}
            loading={logs.isPending}
            empty={
              filtered ? (
                <EmptyState
                  icon={<SearchX className="size-6" />}
                  title="No attempts match"
                  description="Try another integration or outcome."
                />
              ) : (
                <EmptyState
                  icon={<ScrollText className="size-6" />}
                  title="Nothing has been synchronised yet"
                  description="Every attempt to synchronise with another system is logged here."
                />
              )
            }
          />
          {rows.length > 0 ? (
            <Pagination
              hasMore={logs.hasNextPage}
              onLoadMore={() => void logs.fetchNextPage()}
              loading={logs.isFetchingNextPage}
              count={rows.length}
              itemLabel={['attempt', 'attempts']}
              loadMoreLabel="Load older attempts"
              endLabel="Start of the log"
            />
          ) : null}
        </>
      )}
    </div>
  );
}
