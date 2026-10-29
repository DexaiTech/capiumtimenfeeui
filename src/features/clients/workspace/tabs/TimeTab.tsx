import { Clock, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { Badge, Button, PageToolbar, Select, type DataTableColumn } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { EntryPanel } from '@/features/time';
import { useUrlParams } from '@/hooks';
import { formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';
import { formatMoney } from '@/utils/money';

import { useClientTime, useStaffDirectory, type TimeFilters } from '../../api';
import { ToneBadge } from '../badges';
import { BILLING_STATUS_LABELS } from '../constants';
import { DateRangeFilter } from '../records/DateRangeFilter';
import { RecordTable } from '../records/RecordTable';
import { SummaryStrip } from '../records/SummaryStrip';
import { isoDateParam, oneOf } from '../records/urlFilters';
import { BILLING_STATUSES, type ClientOverview, type TimeEntryRow } from '../types';

const BILLABLE = ['true', 'false'] as const;

const BILLABLE_OPTIONS = [
  { value: '', label: 'Billable or not' },
  { value: 'true', label: 'Billable' },
  { value: 'false', label: 'Non-billable' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...BILLING_STATUSES.map((status) => ({
    value: status,
    label: BILLING_STATUS_LABELS[status].label,
  })),
];

export interface TimeTabProps {
  clientId: string;
  clientName: string;
  overview: ClientOverview | undefined;
}

/**
 * The time recorded for the client (`GET /time-entries?client_id=`): every person's with
 * `time.read_all`, otherwise the caller's own. The totals above come from the overview, so they
 * stay right however many rows are loaded. "Add time" opens the time panel for this client; saving
 * refreshes the list and the totals through the time invalidation.
 */
export function TimeTab({ clientId, clientName, overview }: TimeTabProps) {
  const { organization, can } = useOrg();
  const { params, setParam } = useUrlParams();
  const staff = useStaffDirectory();
  const [adding, setAdding] = useState(false);
  const scope = can(P.timeReadAll) ? 'all' : 'own';
  const from = isoDateParam(params.get('from'));
  const to = isoDateParam(params.get('to'));
  const billable = oneOf(params.get('billable'), BILLABLE);
  const billingStatus = oneOf(params.get('status'), BILLING_STATUSES);

  const filters = useMemo<TimeFilters>(
    () => ({ from, to, billable, billing_status: billingStatus }),
    [from, to, billable, billingStatus],
  );
  const query = useClientTime(clientId, filters, scope);
  const slug = organization.slug;
  const currency = organization.currency;

  const person = (userId: string) =>
    staff.data?.find((member) => member.user_id === userId)?.full_name ?? 'A former member';

  const columns: DataTableColumn<TimeEntryRow>[] = [
    {
      id: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (entry) => entry.entry_date,
      className: 'whitespace-nowrap',
      cell: (entry) => formatUkDate(entry.entry_date),
    },
    ...(scope === 'all'
      ? [
          {
            id: 'person',
            header: 'Staff',
            sortable: true,
            sortValue: (entry: TimeEntryRow) => person(entry.user_id),
            cell: (entry: TimeEntryRow) => person(entry.user_id),
          } satisfies DataTableColumn<TimeEntryRow>,
        ]
      : []),
    {
      id: 'job',
      header: 'Job',
      cell: (entry) =>
        entry.job_id ? (
          <Link
            to={routes.org.job(slug, entry.job_id)}
            className="font-semibold text-brand-text hover:underline"
          >
            {entry.job_number}
            <span className="ml-1.5 font-normal text-text-muted">{entry.job_name}</span>
          </Link>
        ) : (
          <span className="text-text-muted">No job</span>
        ),
    },
    { id: 'activity', header: 'Activity', cell: (entry) => entry.activity_name ?? '—' },
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
      sortable: true,
      sortValue: (entry) => entry.minutes,
      className: 'whitespace-nowrap tabular-nums',
      cell: (entry) => formatMinutes(entry.minutes),
    },
    {
      id: 'rate',
      header: 'Rate',
      align: 'end',
      className: 'whitespace-nowrap tabular-nums',
      cell: (entry) => `${formatMoney(entry.charge_rate, currency)} / h`,
    },
    {
      id: 'value',
      header: 'Value',
      align: 'end',
      sortable: true,
      sortValue: (entry) => entry.charge_value,
      className: 'whitespace-nowrap tabular-nums',
      cell: (entry) => formatMoney(entry.charge_value, currency),
    },
    {
      id: 'billable',
      header: 'Billable',
      cell: (entry) => (
        <Badge tone={entry.is_billable ? 'green' : 'grey'} size="sm">
          {entry.is_billable ? 'Billable' : 'Non-billable'}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (entry) => <ToneBadge info={BILLING_STATUS_LABELS[entry.billing_status]} />,
    },
  ];

  const filtered = Boolean(from || to || billable || billingStatus);
  const time = overview?.time;
  const own = time?.scope === 'own';

  return (
    <div className="flex flex-col gap-4">
      <EntryPanel
        open={adding}
        onClose={() => setAdding(false)}
        defaults={{ client: { id: clientId, label: clientName } }}
      />
      {time ? (
        <SummaryStrip
          label="Time totals"
          items={[
            {
              label: own ? 'Your time, last 30 days' : 'Last 30 days',
              value: formatMinutes(time.minutes_30d),
              hint: `${formatMinutes(time.billable_minutes_30d)} billable`,
            },
            {
              label: own ? 'Your time this year' : 'This year',
              value: formatMinutes(time.minutes_ytd),
              hint: `${formatMinutes(time.billable_minutes_ytd)} billable`,
            },
            { label: 'Last entry', value: formatUkDate(time.last_entry_on) || '—' },
          ]}
        />
      ) : null}
      <RecordTable
        caption={`Time recorded for ${clientName}`}
        columns={columns}
        rowKey={(entry) => entry.id}
        query={query}
        noun={['entry', 'entries']}
        filtered={filtered}
        onClearFilters={() => setParam({ from: null, to: null, billable: null, status: null })}
        emptyIcon={<Clock className="size-6" />}
        emptyTitle="No time recorded yet"
        emptyDescription={
          scope === 'own'
            ? 'Time you record for this client will be listed here.'
            : 'Time recorded for this client will be listed here.'
        }
        errorTitle="Could not load the time"
        toolbar={
          <PageToolbar
            start={
              <h2 className="px-2 text-sm font-semibold text-text">
                {scope === 'own' ? 'Your time' : 'Time entries'}
              </h2>
            }
            primaryAction={
              can(P.timeLog) ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="size-4" aria-hidden="true" />}
                  onClick={() => setAdding(true)}
                >
                  Add time
                </Button>
              ) : null
            }
            actions={
              <>
                <DateRangeFilter label="Date" from={from} to={to} />
                <Select
                  label="Billable"
                  hideLabel
                  options={BILLABLE_OPTIONS}
                  value={billable}
                  onChange={(event) => setParam({ billable: event.target.value })}
                  className="w-full sm:w-40"
                />
                <Select
                  label="Status"
                  hideLabel
                  options={STATUS_OPTIONS}
                  value={billingStatus}
                  onChange={(event) => setParam({ status: event.target.value })}
                  className="w-full sm:w-40"
                />
              </>
            }
          />
        }
      />
    </div>
  );
}
