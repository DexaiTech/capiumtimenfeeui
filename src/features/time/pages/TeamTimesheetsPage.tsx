import { BellRing, Download, Eye, Ellipsis, Plus, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  Badge,
  Button,
  ConfirmDialog,
  CountTabs,
  DataTable,
  EmptyState,
  Dropdown,
  InitialsAvatar,
  PageToolbar,
  SearchField,
  Select,
  sortRows,
  useToast,
  type DataTableColumn,
  type DataTableSort,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { StaffPicker } from '@/features/team';
import { useOrg } from '@/features/organizations';
import { useDebouncedValue, useDocumentTitle, useUrlParams } from '@/hooks';
import { downloadText, toCsv } from '@/utils/csv';
import { addDays, formatUkDate, formatUkDateTime, todayInZone } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';

import { useMissingTimesheets, useRunReminders, useStaffDirectory, useTimesheetList } from '../api';
import { EntryDialog } from '../components/EntryDialog';
import { FilterPopover } from '../components/FilterPopover';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { PeriodNavigator } from '../components/PeriodNavigator';
import { SheetStatusBadge } from '../components/badges';
import { PersonSheetDrawer } from '../components/team/PersonSheetDrawer';
import { SHEET_STATUS_LABEL } from '../constants';
import { useDateParam } from '../hooks/useTimesheetParams';
import { dialogError } from '../utils/errors';
import { describeVariance, formatDayList } from '../utils/format';
import { buildTeamRows, isMissing, type TeamRow, type TeamStatus } from '../utils/team';
import { formatWeekRange, weekDates, weekStartOf } from '../utils/weeks';

type Tab = 'all' | 'missing';

const STATUSES: ReadonlyArray<TeamStatus> = ['none', 'open', 'submitted', 'approved', 'rejected'];

const statusOptions = [
  { value: '', label: 'All statuses' },
  ...STATUSES.map((status) => ({ value: status, label: SHEET_STATUS_LABEL[status] })),
];

function Page() {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const today = todayInZone(organization.timezone);
  const { date, setDate } = useDateParam(today);
  const { params, setParam } = useUrlParams();
  const weekStart = weekStartOf(date, organization.week_start);

  const tab: Tab = params.get('tab') === 'missing' ? 'missing' : 'all';
  const person = params.get('person') ?? '';
  const manager = params.get('manager') ?? '';
  const status = STATUSES.find((item) => item === params.get('status')) ?? '';
  const [text, setText] = useState('');
  const needle = useDebouncedValue(text.trim()).toLowerCase();

  const canListStaff = can(PERMISSIONS.memberRead);
  const canRemind = can(PERMISSIONS.organizationUpdate) || can(PERMISSIONS.timesheetApprove);
  const canRecordForOthers = can(PERMISSIONS.timeManageAll);

  const sheets = useTimesheetList({ user_id: person || 'all', from: weekStart, to: weekStart });
  const missing = useMissingTimesheets({
    week_start: weekStart,
    user_id: person || undefined,
    manager_user_id: manager || undefined,
  });
  const staff = useStaffDirectory({ enabled: canListStaff });
  const reminders = useRunReminders();

  const [sort, setSort] = useState<DataTableSort | null>(null);
  const [viewing, setViewing] = useState<TeamRow | null>(null);
  const [recording, setRecording] = useState<TeamRow | null>(null);
  const [reminding, setReminding] = useState(false);
  const [remindError, setRemindError] = useState<{ message: string; requestId?: string } | null>(
    null,
  );

  const rows = useMemo(
    () =>
      buildTeamRows({
        missing: missing.data ?? [],
        sheets: sheets.data ?? [],
        staff: staff.data,
        days: weekDates(weekStart),
        managerId: manager || undefined,
      }),
    [missing.data, sheets.data, staff.data, weekStart, manager],
  );

  const visible = rows.filter(
    (row) =>
      (tab === 'all' || isMissing(row)) &&
      (status === '' || row.status === status) &&
      (needle === '' || row.name.toLowerCase().includes(needle)),
  );

  const columns: DataTableColumn<TeamRow>[] = [
    {
      id: 'person',
      header: 'Person',
      hideable: false,
      sortable: true,
      sortValue: (row) => row.name,
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <InitialsAvatar name={row.name} colorKey={row.userId} size="sm" />
          <div className="flex flex-col items-start gap-0.5">
            <span className="font-semibold text-text uppercase">{row.name}</span>
            {row.hasLogin === false ? (
              <Badge tone="grey" size="sm">
                No login
              </Badge>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: 'manager',
      header: 'Manager',
      cell: (row) => row.manager?.name ?? '—',
    },
    {
      id: 'expected',
      header: 'Expected',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.expected,
      className: 'whitespace-nowrap tabular-nums',
      cell: (row) => (row.expected === null ? '—' : formatMinutes(row.expected)),
    },
    {
      id: 'logged',
      header: 'Logged',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.logged,
      className: 'whitespace-nowrap tabular-nums',
      cell: (row) => <span className="font-semibold">{formatMinutes(row.logged)}</span>,
    },
    {
      id: 'variance',
      header: 'Over or under',
      align: 'end',
      sortable: true,
      sortValue: (row) => (row.expected === null ? null : row.logged - row.expected),
      className: 'whitespace-nowrap tabular-nums',
      cell: (row) => {
        if (row.expected === null) return '—';
        const variance = describeVariance(row.logged - row.expected);
        return (
          <span className={variance.kind === 'under' ? 'text-warning' : undefined}>
            {variance.text}
            {variance.kind === 'under' ? <span className="sr-only"> under</span> : null}
            {variance.kind === 'over' ? <span className="sr-only"> over</span> : null}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (row) => SHEET_STATUS_LABEL[row.status],
      cell: (row) => <SheetStatusBadge status={row.status} />,
    },
    {
      id: 'missing',
      header: 'Days with no time',
      cell: (row) =>
        row.missingDays.length === 0 ? (
          '—'
        ) : (
          <span className="flex flex-col">
            <span className="font-semibold text-warning">
              {row.missingDays.length} {row.missingDays.length === 1 ? 'day' : 'days'}
            </span>
            <span className="text-text-muted">{formatDayList(row.missingDays)}</span>
          </span>
        ),
    },
    {
      id: 'reminded',
      header: 'Last reminded',
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.lastRemindedAt
          ? formatUkDateTime(row.lastRemindedAt, organization.timezone)
          : isMissing(row)
            ? 'Not yet'
            : '—',
    },
  ];

  const sorted = sortRows(visible, columns, sort);
  const missingCount = rows.filter(isMissing).length;
  const totals = visible.reduce(
    (sum, row) => ({
      logged: sum.logged + row.logged,
      expected: sum.expected + (row.expected ?? 0),
    }),
    { logged: 0, expected: 0 },
  );
  const filterCount = [person, manager, status].filter(Boolean).length;
  const clearFilters = () => setParam({ person: null, manager: null, status: null });

  const exportCsv = () => {
    downloadText(
      `${organization.slug}-team-timesheets-${weekStart}.csv`,
      toCsv([
        ['Person', 'Manager', 'Status', 'Expected', 'Logged', 'Days with no time', 'Last reminded'],
        ...sorted.map((row) => [
          row.name,
          row.manager?.name ?? '',
          SHEET_STATUS_LABEL[row.status],
          row.expected === null ? '' : formatMinutes(row.expected),
          formatMinutes(row.logged),
          row.missingDays.map(formatUkDate).join(' '),
          row.lastRemindedAt ? formatUkDateTime(row.lastRemindedAt, organization.timezone) : '',
        ]),
      ]),
    );
  };

  const sendReminders = () => {
    setRemindError(null);
    reminders.mutate(weekStart, {
      onSuccess: (result) => {
        const parts = [
          `${result.reminded} ${result.reminded === 1 ? 'person' : 'people'} reminded`,
          `${result.already_reminded} reminded before`,
          `${result.unreachable} could not be reached`,
          `${result.approvers_reminded} ${result.approvers_reminded === 1 ? 'approver' : 'approvers'} reminded about ${result.sheets_waiting} ${result.sheets_waiting === 1 ? 'timesheet' : 'timesheets'} waiting`,
        ];
        toast({
          tone: 'success',
          title: 'Reminders sent',
          description:
            parts.join('; ') +
            '.' +
            (result.disabled.length > 0
              ? ` Switched off in the notification settings: ${result.disabled.join(', ')}.`
              : ''),
        });
        setReminding(false);
      },
      onError: (error) => setRemindError(dialogError(error)),
    });
  };

  if ((sheets.isError && !sheets.data) || (missing.isError && !missing.data)) {
    const failed = sheets.isError ? sheets : missing;
    return (
      <LoadError
        title="Could not load the timesheets"
        error={failed.error}
        onRetry={() => {
          void sheets.refetch();
          void missing.refetch();
        }}
        retrying={sheets.isRefetching || missing.isRefetching}
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PeriodNavigator
          label={formatWeekRange(weekStart)}
          unit="week"
          onPrevious={() => setDate(addDays(weekStart, -7))}
          onNext={() => setDate(addDays(weekStart, 7))}
          onToday={() => setDate(today)}
          todayLabel="This week"
          date={date}
          onDateChange={setDate}
        />
        <Button
          size="sm"
          onClick={() => setDate(addDays(weekStartOf(today, organization.week_start), -7))}
        >
          Last week
        </Button>
      </div>
      <DataTable
        caption={`Timesheets for the week of ${formatUkDate(weekStart)}`}
        columns={columns}
        rows={sorted}
        rowKey={(row) => row.userId}
        sort={sort}
        onSortChange={setSort}
        loading={sheets.isPending || missing.isPending}
        onRowClick={setViewing}
        toolbar={
          <PageToolbar
            start={
              <CountTabs
                label="Timesheets to show"
                items={[
                  { value: 'all', label: 'Everyone', count: rows.length },
                  { value: 'missing', label: 'Missing', count: missingCount },
                ]}
                value={tab}
                onChange={(value) => setParam({ tab: value === 'all' ? null : value })}
              />
            }
            search={<SearchField label="Search people" value={text} onChange={setText} />}
            actions={
              <>
                <FilterPopover title="Filter timesheets" count={filterCount} onClear={clearFilters}>
                  <Select
                    label="Status"
                    options={statusOptions}
                    value={status}
                    onChange={(event) => setParam({ status: event.target.value })}
                  />
                  {canListStaff ? (
                    <StaffPicker
                      label="Manager"
                      value={manager || null}
                      hasLogin
                      placeholder="Any manager"
                      onChange={(id) => setParam({ manager: id })}
                    />
                  ) : null}
                  {canListStaff ? (
                    <StaffPicker
                      label="Person"
                      value={person || null}
                      includeLeft
                      placeholder="Everyone"
                      onChange={(id) => setParam({ person: id })}
                    />
                  ) : null}
                </FilterPopover>
                {canRemind ? (
                  <Button
                    variant="brand-outline"
                    size="sm"
                    leftIcon={<BellRing className="size-4" aria-hidden="true" />}
                    onClick={() => {
                      setRemindError(null);
                      setReminding(true);
                    }}
                  >
                    Send reminders
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Download className="size-4" aria-hidden="true" />}
                  disabled={sorted.length === 0}
                  onClick={exportCsv}
                >
                  Export
                </Button>
              </>
            }
          />
        }
        rowActions={(row) => (
          <Dropdown
            label={`Actions for ${row.name}`}
            trigger={<Ellipsis className="size-4" aria-hidden="true" />}
            items={[
              {
                id: 'view',
                label: 'View timesheet',
                icon: <Eye className="size-4" aria-hidden="true" />,
                onSelect: () => setViewing(row),
              },
              ...(canRecordForOthers
                ? [
                    {
                      id: 'record',
                      label: 'Record time on behalf',
                      icon: <Plus className="size-4" aria-hidden="true" />,
                      onSelect: () => setRecording(row),
                    },
                  ]
                : []),
            ]}
          />
        )}
        empty={
          <EmptyState
            icon={<UsersRound className="size-6" />}
            title={tab === 'missing' ? 'Nobody is missing a timesheet' : 'No timesheets this week'}
            description={
              filterCount > 0 || needle !== ''
                ? 'Try other filters or another search.'
                : tab === 'missing'
                  ? 'Everyone who records time has submitted for the week of ' +
                    formatUkDate(weekStart) +
                    '.'
                  : 'Nobody has recorded time or submitted a timesheet for this week yet.'
            }
          />
        }
        footer={
          sorted.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-row-border px-4 py-2 text-xs text-text-muted">
              <span aria-live="polite">
                {sorted.length} {sorted.length === 1 ? 'person' : 'people'}
              </span>
              <span className="tabular-nums">
                Expected {formatMinutes(totals.expected)} · Logged {formatMinutes(totals.logged)}
              </span>
            </div>
          ) : null
        }
      />

      <PersonSheetDrawer
        person={viewing}
        weekStart={weekStart}
        staff={staff.data}
        onClose={() => setViewing(null)}
      />
      <EntryDialog
        open={recording !== null}
        onClose={() => setRecording(null)}
        onBehalfOf={recording ? { id: recording.userId, name: recording.name } : null}
        defaults={{
          date: today >= weekStart && today <= addDays(weekStart, 6) ? today : weekStart,
        }}
      />
      <ConfirmDialog
        open={reminding}
        onClose={() => setReminding(false)}
        onConfirm={sendReminders}
        title="Send timesheet reminders?"
        confirmLabel="Send reminders"
        tone="default"
        loading={reminders.isPending}
        error={remindError}
      >
        <p>
          People whose timesheet for the week of {formatUkDate(weekStart)} is not submitted are
          reminded once, and so are the approvers who have submitted timesheets waiting. Anyone
          already reminded about this week is left out.
        </p>
      </ConfirmDialog>
    </>
  );
}

/**
 * Team Timesheets: the week of everyone the caller may see, who is expected to log what, who has
 * submitted and who is missing; a person's sheet opens beside the list, time can be recorded on
 * behalf of someone, and reminders go out from here.
 */
export default function TeamTimesheetsPage() {
  useDocumentTitle('Team Timesheets');
  const { can } = useOrg();
  const allowed = can(PERMISSIONS.timeReadAll) || can(PERMISSIONS.timesheetApprove);
  return (
    <PageShell
      title="Team Timesheets"
      description="See who has logged and submitted time this week, who is missing, and follow up."
    >
      {allowed ? <Page /> : <NoAccess what="the timesheets of other people" />}
    </PageShell>
  );
}
