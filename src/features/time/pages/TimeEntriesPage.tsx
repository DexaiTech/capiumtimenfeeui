import {
  Download,
  FilePlus2,
  History,
  Lock,
  Pencil,
  Plus,
  SearchX,
  Trash2,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  Button,
  ColumnVisibilityMenu,
  ConfirmDialog,
  CountTabs,
  DataTable,
  DateRangeField,
  EmptyState,
  PageToolbar,
  Pagination,
  Select,
  sortRows,
  useToast,
  type DataTableColumn,
  type DataTableSort,
  type DropdownItem,
  RowActions,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { modulePath, ORG_SEGMENTS } from '@/constants/routes';
import { useAuth } from '@/features/auth';
import { useOrg } from '@/features/organizations';
import { ClientPicker, JobPicker, StaffPicker } from '@/features/team';
import { useDocumentTitle, usePersistentColumns, useUrlParams } from '@/hooks';
import { downloadText, toCsv } from '@/utils/csv';
import { formatUkDate, todayInZone } from '@/utils/dates';
import { formatMinutes, formatDecimalHours } from '@/utils/minutes';
import { formatMoney, penceToDecimalString } from '@/utils/money';

import {
  fetchEverything,
  flattenPages,
  timeApi,
  useDeleteEntry,
  useStaffDirectory,
  useTimeEntryList,
} from '../api';
import { BillableBadge, BillingStatusBadge, SheetStatusBadge } from '../components/badges';
import { EntryPanel, type EntryDefaults } from '../components/EntryPanel';
import { FilterPopover } from '../components/FilterPopover';
import { HistoryDrawer } from '../components/HistoryDrawer';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import {
  BILLING_STATUS_LABEL,
  BILLING_STATUSES,
  EXPORT_MAX_ROWS,
  SHEET_STATUS_LABEL,
  TIMESHEET_STATUSES,
} from '../constants';
import type { BillingStatus, TimeEntry, TimeEntryFilters, TimesheetStatus } from '../types';
import { dialogError } from '../utils/errors';
import { refLabel } from '../utils/format';
import { isIsoDate, monthStart } from '../utils/weeks';

type BillingTab = 'all' | 'unbilled' | 'billed';

const TABS: ReadonlyArray<{ value: BillingTab; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: 'unbilled', label: 'Unbilled' },
  { value: 'billed', label: 'Billed' },
];

const BILLABLE_OPTIONS = [
  { value: '', label: 'Billable or not' },
  { value: 'true', label: 'Billable' },
  { value: 'false', label: 'Non-billable' },
];

const BILLING_OPTIONS = [
  { value: '', label: 'Any billing status' },
  ...BILLING_STATUSES.map((status) => ({ value: status, label: BILLING_STATUS_LABEL[status] })),
];

const SHEET_OPTIONS = [
  { value: '', label: 'Any timesheet status' },
  ...TIMESHEET_STATUSES.map((status) => ({ value: status, label: SHEET_STATUS_LABEL[status] })),
];

const oneOf = <T extends string>(value: string | null, allowed: ReadonlyArray<T>): T | '' =>
  allowed.find((item) => item === value) ?? '';

function List() {
  const { organization, can } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const currency = organization.currency;
  const today = todayInZone(organization.timezone);

  const canReadAll = can(PERMISSIONS.timeReadAll);
  const canSeeCost = can(PERMISSIONS.rateRead);
  const canPickPeople = canReadAll && can(PERMISSIONS.memberRead);

  const rawFrom = params.get('from');
  const rawTo = params.get('to');
  const from = isIsoDate(rawFrom) ? rawFrom : monthStart(today);
  const to = isIsoDate(rawTo) ? rawTo : today;
  const person = canReadAll ? (params.get('person') ?? '') : '';
  const clientId = params.get('client') ?? '';
  const jobId = params.get('job') ?? '';
  const billable = oneOf(params.get('billable'), ['true', 'false'] as const);
  const billing: BillingStatus | '' = oneOf(params.get('billing'), BILLING_STATUSES);
  const sheetStatus: TimesheetStatus | '' = oneOf(params.get('timesheet'), TIMESHEET_STATUSES);
  const tab: BillingTab =
    billing === 'unbilled' ? 'unbilled' : billing === 'billed' ? 'billed' : 'all';

  const filters = useMemo<TimeEntryFilters>(
    () => ({
      user_id: canReadAll ? person || 'all' : undefined,
      date_from: from,
      date_to: to,
      client_id: clientId || undefined,
      job_id: jobId || undefined,
      billable: billable === '' ? undefined : billable === 'true',
      billing_status: billing ? [billing] : undefined,
      timesheet_status: sheetStatus ? [sheetStatus] : undefined,
    }),
    [canReadAll, person, from, to, clientId, jobId, billable, billing, sheetStatus],
  );
  const list = useTimeEntryList(filters);
  const staff = useStaffDirectory({ enabled: canReadAll && can(PERMISSIONS.memberRead) });
  const remove = useDeleteEntry();

  const [hidden, setHidden] = usePersistentColumns('time-entries');
  const [sort, setSort] = useState<DataTableSort | null>(null);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [correcting, setCorrecting] = useState<TimeEntry | null>(null);
  const [history, setHistory] = useState<TimeEntry | null>(null);
  const [deleting, setDeleting] = useState<TimeEntry | null>(null);
  const [deleteError, setDeleteError] = useState<{ message: string; requestId?: string } | null>(
    null,
  );
  const [adding, setAdding] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const navigate = useNavigate();
  const canBill = can(PERMISSIONS.invoiceCreate) && can(PERMISSIONS.wipRead);

  const names = new Map((staff.data ?? []).map((member) => [member.id, member.full_name]));
  const personName = (userId: string) =>
    userId === user?.id ? 'You' : (names.get(userId) ?? 'Another person');

  const canEdit = (entry: TimeEntry) =>
    !entry.is_locked &&
    (entry.user_id === user?.id ? can(PERMISSIONS.timeLog) : can(PERMISSIONS.timeManageAll));
  const canCorrect = (entry: TimeEntry) =>
    entry.timesheet_status === 'approved' &&
    entry.billing_status === 'unbilled' &&
    (can(PERMISSIONS.timeManageAll) || can(PERMISSIONS.timesheetApprove));

  const columns: DataTableColumn<TimeEntry>[] = [
    {
      id: 'date',
      header: 'Date',
      hideable: false,
      sortable: true,
      sortValue: (entry) => entry.entry_date,
      className: 'whitespace-nowrap',
      cell: (entry) => formatUkDate(entry.entry_date),
    },
    ...(canReadAll
      ? [
          {
            id: 'person',
            header: 'Person',
            sortable: true,
            sortValue: (entry: TimeEntry) => personName(entry.user_id),
            cell: (entry: TimeEntry) => personName(entry.user_id),
          } satisfies DataTableColumn<TimeEntry>,
        ]
      : []),
    {
      id: 'client',
      header: 'Client',
      sortable: true,
      sortValue: (entry) => entry.client_name,
      cell: (entry) => (
        <span className="font-semibold text-text uppercase">{entry.client_name ?? '—'}</span>
      ),
    },
    {
      id: 'job',
      header: 'Job',
      cell: (entry) => (
        <div className="flex flex-col">
          <span>{refLabel({ code: entry.job_number, name: entry.job_name }) || '—'}</span>
          {entry.task_name ? <span className="text-text-muted">{entry.task_name}</span> : null}
        </div>
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
      cell: (entry) => <span className="font-semibold">{formatMinutes(entry.minutes)}</span>,
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
    ...(canSeeCost
      ? [
          {
            id: 'cost',
            header: 'Cost',
            align: 'end',
            className: 'whitespace-nowrap tabular-nums',
            cell: (entry: TimeEntry) =>
              entry.cost_value === null ? '—' : formatMoney(entry.cost_value, currency),
          } satisfies DataTableColumn<TimeEntry>,
        ]
      : []),
    {
      id: 'billable',
      header: 'Billable',
      cell: (entry) => <BillableBadge billable={entry.is_billable} />,
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

  const loaded = flattenPages(list.data);
  const rows = sortRows(loaded, columns, sort);

  // Time that can go on an invoice: billable, unbilled, for a client. One client per invoice.
  const chosen = loaded.filter((entry) => picked.has(entry.id));
  const billableChosen = chosen.filter(
    (entry) => entry.is_billable && entry.billing_status === 'unbilled' && entry.client_id,
  );
  const billClients = new Set(billableChosen.map((entry) => entry.client_id));
  const billClient = billClients.size === 1 ? billableChosen[0] : undefined;
  const createInvoice = () => {
    if (!billClient?.client_id) return;
    const query = new URLSearchParams({
      client: billClient.client_id,
      time: billableChosen.map((entry) => entry.id).join(','),
    });
    void navigate(
      `${modulePath(organization.slug, ORG_SEGMENTS.billing, 'prepare')}?${query.toString()}`,
    );
  };

  // New time starts from the client and job the list is filtered to, so it is not chosen again.
  const sample = jobId
    ? loaded.find((entry) => entry.job_id === jobId)
    : clientId
      ? loaded.find((entry) => entry.client_id === clientId)
      : undefined;
  const addDefaults: EntryDefaults = { date: today };
  const defaultClientId = clientId || sample?.client_id || '';
  if (defaultClientId) {
    addDefaults.client = {
      id: defaultClientId,
      label:
        sample?.client_id === defaultClientId
          ? refLabel({ code: sample.client_code, name: sample.client_name })
          : undefined,
    };
  }
  if (jobId && sample?.job_id) {
    addDefaults.job = {
      id: sample.job_id,
      number: sample.job_number ?? '',
      name: sample.job_name ?? '',
      client_id: sample.client_id ?? '',
      client_code: sample.client_code ?? '',
      client_name: sample.client_name ?? '',
      service_id: sample.service_id,
      service_name: sample.service_name,
    };
  }
  const totals = loaded.reduce(
    (sum, entry) => ({
      minutes: sum.minutes + entry.minutes,
      billableMinutes: sum.billableMinutes + (entry.is_billable ? entry.minutes : 0),
      value: sum.value + (entry.is_billable ? entry.charge_value : 0),
    }),
    { minutes: 0, billableMinutes: 0, value: 0 },
  );

  const filterCount = [person, clientId, jobId, billable, sheetStatus].filter(Boolean).length;
  const filtered = filterCount > 0 || billing !== '';
  const clearFilters = () =>
    setParam({
      from: null,
      to: null,
      person: null,
      client: null,
      job: null,
      billable: null,
      billing: null,
      timesheet: null,
    });

  const actionsOf = (entry: TimeEntry): DropdownItem[] => {
    const editable = canEdit(entry);
    return [
      {
        id: 'edit',
        label: editable ? 'Edit entry' : 'View entry',
        icon: editable ? (
          <Pencil className="size-4" aria-hidden="true" />
        ) : (
          <Lock className="size-4" aria-hidden="true" />
        ),
        onSelect: () => setEditing(entry),
      },
      ...(canCorrect(entry)
        ? [
            {
              id: 'correct',
              label: 'Correct approved time',
              icon: <Wrench className="size-4" aria-hidden="true" />,
              onSelect: () => setCorrecting(entry),
            },
          ]
        : []),
      {
        id: 'history',
        label: 'History of corrections',
        icon: <History className="size-4" aria-hidden="true" />,
        onSelect: () => setHistory(entry),
      },
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

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await fetchEverything<TimeEntry>(
        (cursor) => timeApi.listEntries(organization.id, filters, { cursor, limit: 100 }),
        Math.ceil(EXPORT_MAX_ROWS / 100),
      );
      downloadText(
        `${organization.slug}-time-entries-${from}-${to}.csv`,
        toCsv([
          [
            'Date',
            'Person',
            'Client',
            'Job',
            'Activity',
            'Description',
            'Time',
            'Hours',
            'Billable',
            'Rate',
            'Value',
            ...(canSeeCost ? ['Cost'] : []),
            'Timesheet',
            'Billing',
          ],
          ...all.map((entry) => [
            formatUkDate(entry.entry_date),
            personName(entry.user_id),
            entry.client_name,
            refLabel({ code: entry.job_number, name: entry.job_name }),
            entry.activity_name,
            entry.description,
            formatMinutes(entry.minutes),
            formatDecimalHours(entry.minutes),
            entry.is_billable ? 'Yes' : 'No',
            penceToDecimalString(entry.charge_rate, currency),
            penceToDecimalString(entry.charge_value, currency),
            ...(canSeeCost
              ? [entry.cost_value === null ? '' : penceToDecimalString(entry.cost_value, currency)]
              : []),
            SHEET_STATUS_LABEL[entry.timesheet_status],
            BILLING_STATUS_LABEL[entry.billing_status],
          ]),
        ]),
      );
      toast({
        tone: 'success',
        title: 'Export ready',
        description:
          all.length >= EXPORT_MAX_ROWS
            ? `The first ${EXPORT_MAX_ROWS} entries were exported. Narrow the dates to export the rest.`
            : `${all.length} ${all.length === 1 ? 'entry' : 'entries'} exported.`,
      });
    } catch (error) {
      toast({ tone: 'error', title: 'Could not export', description: dialogError(error).message });
    } finally {
      setExporting(false);
    }
  };

  if (list.isError && !list.data) {
    return (
      <LoadError
        title="Could not load the time entries"
        error={list.error}
        onRetry={() => void list.refetch()}
        retrying={list.isRefetching}
      />
    );
  }

  return (
    <>
      <EntryPanel open={adding} onClose={() => setAdding(false)} defaults={addDefaults} />
      <EntryPanel open={editing !== null} entry={editing} onClose={() => setEditing(null)} />
      <EntryPanel
        open={correcting !== null}
        entry={correcting}
        correction
        onClose={() => setCorrecting(null)}
      />
      {canBill && picked.size > 0 ? (
        <div
          role="region"
          aria-label="Bill the selected time"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-brand-soft px-3 py-2"
        >
          <p aria-live="polite" className="mr-1 text-xs font-semibold text-brand-text">
            {picked.size} selected
          </p>
          <p className="text-xs text-text-muted">
            {billClients.size > 1
              ? 'The time belongs to more than one client: choose the time of one client to bill it.'
              : billableChosen.length === 0
                ? 'None of it can be billed: only billable time that is not billed yet can go on an invoice.'
                : billableChosen.length < chosen.length
                  ? `${billableChosen.length} of ${chosen.length} can be billed; the rest is left out.`
                  : `${billableChosen.length} ${billableChosen.length === 1 ? 'entry' : 'entries'} for ${billClient?.client_name ?? 'the client'}.`}
          </p>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<FilePlus2 className="size-4" aria-hidden="true" />}
            disabled={billClient === undefined}
            onClick={createInvoice}
          >
            Create invoice
          </Button>
          <Button size="sm" onClick={() => setPicked(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}
      <DataTable
        caption="Time entries"
        selectable={canBill}
        selected={picked}
        onSelectedChange={setPicked}
        selectLabel={(entry) =>
          `Select the entry of ${formatUkDate(entry.entry_date)}, ${formatMinutes(entry.minutes)}`
        }
        onRowClick={(entry) => {
          if (canEdit(entry)) setEditing(entry);
        }}
        columns={columns}
        rows={rows}
        rowKey={(entry) => entry.id}
        hiddenColumns={hidden}
        sort={sort}
        onSortChange={setSort}
        loading={list.isPending}
        toolbar={
          <PageToolbar
            start={
              <CountTabs
                label="Billing status"
                items={TABS}
                value={tab}
                onChange={(value) => setParam({ billing: value === 'all' ? null : value })}
              />
            }
            search={
              <DateRangeField
                label="Date"
                hideLabel
                prefix="Date"
                presetsFrom={today}
                weekStartsOn={organization.week_start}
                value={{ from, to }}
                onChange={(range) => setParam({ from: range.from, to: range.to })}
                className="w-full sm:w-80"
              />
            }
            actions={
              <>
                <ColumnVisibilityMenu
                  columns={columns.map((column) => ({
                    id: column.id,
                    label: column.header,
                    locked: column.hideable === false,
                  }))}
                  hidden={hidden}
                  onChange={setHidden}
                />
                <FilterPopover
                  title="Filter time entries"
                  count={filterCount}
                  onClear={clearFilters}
                >
                  {canPickPeople ? (
                    <StaffPicker
                      label="Person"
                      value={person || null}
                      includeLeft
                      placeholder="Everyone"
                      onChange={(id) => setParam({ person: id })}
                    />
                  ) : null}
                  {can(PERMISSIONS.clientRead) ? (
                    <ClientPicker
                      label="Client"
                      value={clientId || null}
                      placeholder="Any client"
                      onChange={(id) => setParam({ client: id, job: null })}
                    />
                  ) : null}
                  {can(PERMISSIONS.jobRead) ? (
                    <JobPicker
                      label="Job"
                      value={jobId || null}
                      clientId={clientId || null}
                      placeholder="Any job"
                      onChange={(job) => setParam({ job: job?.id ?? null })}
                    />
                  ) : null}
                  <Select
                    label="Timesheet status"
                    options={SHEET_OPTIONS}
                    value={sheetStatus}
                    onChange={(event) => setParam({ timesheet: event.target.value })}
                  />
                  <Select
                    label="Billable"
                    options={BILLABLE_OPTIONS}
                    value={billable}
                    onChange={(event) => setParam({ billable: event.target.value })}
                  />
                  <Select
                    label="Billing status"
                    options={BILLING_OPTIONS}
                    value={billing}
                    onChange={(event) => setParam({ billing: event.target.value })}
                  />
                </FilterPopover>
                <Button
                  variant="brand-outline"
                  size="sm"
                  leftIcon={<Download className="size-4" aria-hidden="true" />}
                  loading={exporting}
                  disabled={rows.length === 0}
                  onClick={() => void exportCsv()}
                >
                  Export
                </Button>
              </>
            }
            primaryAction={
              can(PERMISSIONS.timeLog) ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="size-4" aria-hidden="true" />}
                  onClick={() => setAdding(true)}
                >
                  Add entry
                </Button>
              ) : null
            }
          />
        }
        rowActions={(entry) => (
          <RowActions
            label={`Actions for the entry of ${formatUkDate(entry.entry_date)}, ${formatMinutes(entry.minutes)}`}
            items={actionsOf(entry)}
          />
        )}
        empty={
          filtered ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No entries match"
              description="Try other dates or fewer filters."
              action={<Button onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={<History className="size-6" />}
              title="No time recorded in this period"
              description="Time recorded in these dates appears here."
            />
          )
        }
        footer={
          rows.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-row-border px-4 py-2">
              <p className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-muted tabular-nums">
                <span>
                  Total <strong className="text-text">{formatMinutes(totals.minutes)}</strong>
                </span>
                <span>
                  Billable{' '}
                  <strong className="text-text">{formatMinutes(totals.billableMinutes)}</strong>
                </span>
                <span>
                  Billable value{' '}
                  <strong className="text-text">{formatMoney(totals.value, currency)}</strong>
                </span>
                {list.hasNextPage ? <span>Totals of the entries loaded so far.</span> : null}
              </p>
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

      <HistoryDrawer entry={history} onClose={() => setHistory(null)} />
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
            ? `${formatMinutes(deleting.minutes)} on ${formatUkDate(deleting.entry_date)}`
            : ''}{' '}
          will be removed for good.
        </p>
      </ConfirmDialog>
    </>
  );
}

/**
 * Time Entries: every entry in a range of dates (everyone's with `time.read_all`, otherwise the
 * caller's own), with totals, edit and delete while unbilled, the correction of approved
 * unbilled time with a required reason, and the history of corrections.
 */
export default function TimeEntriesPage() {
  useDocumentTitle('Time Entries');
  const { can } = useOrg();
  const allowed = can(PERMISSIONS.timeLog) || can(PERMISSIONS.timeReadAll);
  return (
    <PageShell
      title="Time Entries"
      description="Every time entry: edit it while it is unbilled, correct approved time with a reason, and see its history."
    >
      {allowed ? <List /> : <NoAccess what="time entries" />}
    </PageShell>
  );
}
