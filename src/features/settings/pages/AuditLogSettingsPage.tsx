import { ScrollText, SearchX } from 'lucide-react';
import { useMemo } from 'react';

import {
  Button,
  EmptyState,
  ErrorState,
  InitialsAvatar,
  Input,
  Pagination,
  Select,
  Table,
  type TableColumn,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, useUrlParams } from '@/hooks';
import { isApiError } from '@/services/api';

import { flattenPages, useAuditLogs } from '../api/hooks';
import { AuditDetails } from '../components/audit/AuditDetails';
import { MemberPicker } from '../components/MemberPicker';
import { RelativeTime } from '../components/RelativeTime';
import { NoAccess, SettingsSection } from '../components/SettingsSection';
import type { AuditLogEntry, AuditLogFilters } from '../types';
import {
  ACTION_GROUPS,
  dayEndIso,
  dayStartIso,
  describeAuditEntry,
  isKnownAction,
} from '../utils/audit';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const GROUP_OPTIONS = [
  { value: '', label: 'All activity' },
  ...ACTION_GROUPS.map(({ value, label }) => ({ value, label })),
];

function Actor({ actor }: { actor: AuditLogEntry['actor'] }) {
  if (!actor) {
    return (
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-hover text-text-muted"
        >
          <ScrollText className="size-3.5" />
        </span>
        <span className="text-text-muted">System</span>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <InitialsAvatar name={actor.full_name} colorKey={actor.id} size="sm" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-text">{actor.full_name}</span>
        <span className="truncate text-xs text-text-muted">{actor.email}</span>
      </div>
    </div>
  );
}

function AuditLogList() {
  const { params, setParam } = useUrlParams();
  const group = ACTION_GROUPS.find((item) => item.value === params.get('group'));
  const actorId = params.get('actor');
  const fromParam = params.get('from') ?? '';
  const toParam = params.get('to') ?? '';
  const from = DATE_PATTERN.test(fromParam) ? fromParam : '';
  const to = DATE_PATTERN.test(toParam) ? toParam : '';

  const filters = useMemo<AuditLogFilters>(
    () => ({
      action: group?.prefix,
      actor_user_id: actorId ?? undefined,
      from: from ? dayStartIso(from) : undefined,
      to: to ? dayEndIso(to) : undefined,
    }),
    [group?.prefix, actorId, from, to],
  );
  const filtered = Boolean(group || actorId || from || to);
  const clearFilters = () => setParam({ group: null, actor: null, from: null, to: null });

  const entries = useAuditLogs(filters);
  const rows = flattenPages(entries.data);

  const columns: TableColumn<AuditLogEntry>[] = [
    {
      id: 'time',
      header: 'Time',
      className: 'whitespace-nowrap',
      cell: (entry) => <RelativeTime iso={entry.created_at} className="text-text-muted" />,
    },
    { id: 'actor', header: 'Actor', cell: (entry) => <Actor actor={entry.actor} /> },
    {
      id: 'event',
      header: 'Event',
      card: 'title',
      cell: (entry) =>
        isKnownAction(entry.action) ? (
          <span className="text-text">{describeAuditEntry(entry)}</span>
        ) : (
          // An action this version does not know yet: show the raw code rather than guess.
          <code className="font-mono text-xs break-all text-text">{entry.action}</code>
        ),
    },
    {
      id: 'ip',
      header: 'IP address',
      className: 'whitespace-nowrap md:hidden lg:table-cell',
      cell: (entry) =>
        entry.ip_address ? (
          <span className="font-mono text-xs text-text-muted">{entry.ip_address}</span>
        ) : (
          <span className="text-text-subtle">—</span>
        ),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_repeat(2,minmax(0,10.5rem))] lg:items-start">
        <Select
          label="Activity"
          options={GROUP_OPTIONS}
          value={group?.value ?? ''}
          onChange={(event) => setParam({ group: event.target.value })}
          className="col-span-2 lg:col-span-1"
        />
        <MemberPicker
          label="Actor"
          value={actorId}
          onChange={(userId) => setParam({ actor: userId })}
          placeholder="Anyone"
          className="col-span-2 lg:col-span-1"
        />
        <Input
          label="From"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(event) => setParam({ from: event.target.value })}
        />
        <Input
          label="To"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(event) => setParam({ to: event.target.value })}
        />
      </div>

      {entries.isError && !entries.data ? (
        <div className="rounded-xl border border-border bg-surface shadow-card">
          <ErrorState
            title="Could not load the audit log"
            error={isApiError(entries.error) ? entries.error : null}
            onRetry={() => void entries.refetch()}
            retrying={entries.isRefetching}
          />
        </div>
      ) : (
        <>
          <Table
            caption="Audit log"
            columns={columns}
            rows={rows}
            rowKey={(entry) => entry.id}
            loading={entries.isPending}
            skeletonRows={8}
            stickyHeader
            className="[--table-sticky-top:4rem]"
            expansion={{
              label: (entry) => `Details: ${describeAuditEntry(entry)}`,
              render: (entry) => <AuditDetails entry={entry} />,
            }}
            empty={
              filtered ? (
                <EmptyState
                  icon={<SearchX className="size-6" />}
                  title="No activity matches"
                  description="Try a wider date range or fewer filters."
                  action={<Button onClick={clearFilters}>Clear filters</Button>}
                />
              ) : (
                <EmptyState
                  icon={<ScrollText className="size-6" />}
                  title="No activity yet"
                  description="Changes to staff, roles, settings and financial records are recorded here."
                />
              )
            }
          />
          {rows.length > 0 ? (
            <Pagination
              hasMore={entries.hasNextPage}
              onLoadMore={() => void entries.fetchNextPage()}
              loading={entries.isFetchingNextPage}
              count={rows.length}
              itemLabel={['event', 'events']}
              loadMoreLabel="Load older events"
              endLabel="Start of the log"
            />
          ) : null}
        </>
      )}
    </>
  );
}

/** `/:orgSlug/settings/audit`: the audit log. Needs `audit_log.read`. */
export default function AuditLogSettingsPage() {
  const { can } = useOrg();
  useDocumentTitle('Audit log');
  return (
    <SettingsSection
      title="Audit log"
      description="A permanent record of who changed staff, roles, practice settings, clients, jobs, invoices and payments. Newest first."
    >
      {can('audit_log.read') ? <AuditLogList /> : <NoAccess what="the audit log" />}
    </SettingsSection>
  );
}
