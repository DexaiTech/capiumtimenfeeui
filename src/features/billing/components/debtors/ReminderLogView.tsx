import { Mail, SearchX } from 'lucide-react';
import { Link } from 'react-router';

import {
  Badge,
  Button,
  DataTable,
  DateRangeField,
  EmptyState,
  PageToolbar,
  Pagination,
  Select,
  type DataTableColumn,
} from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { ClientPicker } from '@/features/team';
import { useUrlParams } from '@/hooks';
import { formatMoney } from '@/utils/money';

import { flattenPages, useReminderLog } from '../../api';
import { REMINDER_STATUS_LABELS, REMINDER_TEMPLATE_LABELS } from '../../constants';
import { isoDateParam, oneOf } from '../../hooks/useUrlSearch';
import type { ReminderLogEntry, ReminderLogFilters, ReminderStatus } from '../../types';
import { dateCell } from '../../utils/format';
import { FilterPopover } from '../FilterPopover';
import { LoadError } from '../PageShell';

const STATUSES = Object.keys(REMINDER_STATUS_LABELS) as ReminderStatus[];
const SOURCES = ['manual', 'scheduled'] as const;
const SOURCE_LABEL = { manual: 'Sent by a person', scheduled: 'Scheduled' } as const;

function logColumns(slug: string, currency: string): DataTableColumn<ReminderLogEntry>[] {
  return [
    {
      id: 'sent',
      header: 'Sent',
      hideable: false,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <span className="text-text">
          {dateCell(row.sent_on ?? row.sent_at?.slice(0, 10) ?? row.created_at.slice(0, 10))}
        </span>
      ),
    },
    {
      id: 'client',
      header: 'Client',
      className: 'min-w-40 max-w-64',
      cell: (row) => (
        <span className="block truncate text-text" title={row.client.name}>
          {row.client.name}
        </span>
      ),
    },
    {
      id: 'invoice',
      header: 'Invoice',
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.invoice.number ? (
          <Link
            to={routes.org.invoice(slug, row.invoice.id)}
            className="font-medium text-link hover:underline"
          >
            {row.invoice.number}
          </Link>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'template',
      header: 'Email',
      className: 'whitespace-nowrap',
      cell: (row) => <span className="text-text">{REMINDER_TEMPLATE_LABELS[row.template]}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone={REMINDER_STATUS_LABELS[row.status].tone} size="sm" dot>
            {REMINDER_STATUS_LABELS[row.status].label}
          </Badge>
          {row.error ? <span className="max-w-56 text-xs text-danger">{row.error}</span> : null}
        </div>
      ),
    },
    {
      id: 'source',
      header: 'Source',
      className: 'whitespace-nowrap',
      cell: (row) => <span className="text-text">{SOURCE_LABEL[row.source]}</span>,
    },
    {
      id: 'to',
      header: 'Sent to',
      className: 'min-w-44 max-w-64',
      cell: (row) => (
        <span className="block truncate text-text" title={row.to.join(', ')}>
          {row.to.join(', ') || '—'}
        </span>
      ),
    },
    {
      id: 'due',
      header: 'Overdue',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <div className="flex flex-col items-end">
          <span className="tabular-nums text-text">{formatMoney(row.amount_due, currency)}</span>
          <span className="text-xs text-text-muted">{row.days_overdue} days</span>
        </div>
      ),
    },
    {
      id: 'by',
      header: 'By',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <span className="text-text">
          {row.sent_by ? (row.sent_by.full_name ?? 'Former member') : '—'}
        </span>
      ),
    },
  ];
}

/** The payment reminders sent so far, by a person or by the daily job, newest first. */
export function ReminderLogView() {
  const { organization, can } = useOrg();
  const { params, setParam } = useUrlParams();

  const status = oneOf(params.get('status'), STATUSES);
  const source = oneOf(params.get('source'), SOURCES);
  const clientId = params.get('client');
  const from = isoDateParam(params.get('from'));
  const to = isoDateParam(params.get('to'));

  const filters: ReminderLogFilters = {
    status,
    source,
    client_id: clientId ?? undefined,
    date_from: from || undefined,
    date_to: to || undefined,
  };
  const list = useReminderLog(filters);
  const rows = flattenPages(list.data);
  const active =
    Number(status !== undefined) +
    Number(source !== undefined) +
    Number(clientId !== null) +
    Number(from !== '') +
    Number(to !== '');
  const clear = () => setParam({ status: null, source: null, client: null, from: null, to: null });

  if (list.isError && !list.data) {
    return (
      <LoadError
        title="Could not load the reminders"
        error={list.error}
        onRetry={() => void list.refetch()}
        retrying={list.isRefetching}
      />
    );
  }

  return (
    <DataTable
      caption="Payment reminders sent"
      columns={logColumns(organization.slug, organization.currency)}
      rows={rows}
      rowKey={(row) => row.id}
      loading={list.isPending}
      toolbar={
        <PageToolbar
          actions={
            <FilterPopover title="Filter the reminders" count={active} onClear={clear}>
              <Select
                label="Status"
                value={status ?? ''}
                options={[
                  { value: '', label: 'Any status' },
                  ...STATUSES.map((value) => ({
                    value,
                    label: REMINDER_STATUS_LABELS[value].label,
                  })),
                ]}
                onChange={(event) => setParam({ status: event.target.value })}
              />
              <Select
                label="Source"
                value={source ?? ''}
                options={[
                  { value: '', label: 'Any source' },
                  ...SOURCES.map((value) => ({ value, label: SOURCE_LABEL[value] })),
                ]}
                onChange={(event) => setParam({ source: event.target.value })}
              />
              {can(P.clientRead) ? (
                <ClientPicker
                  label="Client"
                  clearable
                  value={clientId}
                  onChange={(id) => setParam({ client: id })}
                />
              ) : null}
              <DateRangeField
                label="Sent on"
                value={{ from: from || null, to: to || null }}
                onChange={(range) => setParam({ from: range.from, to: range.to })}
              />
            </FilterPopover>
          }
        />
      }
      empty={
        active > 0 ? (
          <EmptyState
            icon={<SearchX className="size-6" />}
            title="No reminders match"
            description="Try different filters."
            action={<Button onClick={clear}>Clear filters</Button>}
          />
        ) : (
          <EmptyState
            icon={<Mail className="size-6" />}
            title="No reminders sent yet"
            description="Reminders sent from the debtors, and by the daily job when it is switched on, are listed here."
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
              itemLabel={['reminder', 'reminders']}
            />
          </div>
        ) : undefined
      }
    />
  );
}
