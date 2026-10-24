import { Download, Ellipsis, SearchX, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import {
  Badge,
  Button,
  ColumnVisibilityMenu,
  CountTabs,
  DataTable,
  Dropdown,
  EmptyState,
  InitialsAvatar,
  PageToolbar,
  Pagination,
  SearchField,
  Select,
  useBulkFlow,
  type DataTableColumn,
  type DataTableSort,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useAuth } from '@/features/auth';
import { useOrg } from '@/features/organizations';
import { useRoles } from '@/features/settings';
import { useRoleName } from '@/features/system';
import { useDocumentTitle, useUrlParams } from '@/hooks';
import { downloadText, toCsv } from '@/utils/csv';
import { formatUkDate, formatWeekdays } from '@/utils/dates';
import { formatMinutes, minutesToHours } from '@/utils/minutes';
import { formatBasisPoints, penceToPoundsInput } from '@/utils/money';

import { flattenPages, useBulkStaff, useGradeOptions, useStaffList } from '../api';
import { LoginStatusBadge, StaffStatusBadge } from '../components/badges';
import { FilterPopover } from '../components/FilterPopover';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { StaffPicker } from '../components/pickers/StaffPicker';
import { StaffBulkBar } from '../components/staff/StaffBulkBar';
import { AddStaffPanel } from '../components/staff/AddStaffPanel';
import {
  TemporaryPasswordDialog,
  type TemporaryPassword,
} from '../components/staff/TemporaryPasswordDialog';
import { STAFF_STATUS_LABEL } from '../constants';
import { useStaffActions } from '../hooks/useStaffActions';
import { useUrlSearch } from '../hooks/useUrlSearch';
import type { StaffBulkRequest, StaffFilters, StaffMember, StaffSort, StaffStatus } from '../types';
import { formatRate } from '../utils/format';

type StaffTab = StaffStatus;
const TABS: ReadonlyArray<{ value: StaffTab; label: string }> = (
  ['active', 'inactive', 'left'] as const
).map((value) => ({ value, label: STAFF_STATUS_LABEL[value] }));

const SORTS: ReadonlyArray<StaffSort> = [
  'name',
  'code',
  'email',
  'grade',
  'status',
  'start_date',
  'leaving_date',
];

const LOGIN_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'yes', label: 'Can sign in' },
  { value: 'no', label: 'No login' },
];

/** Hidden until asked for: they are details most people do not need on the list. */
const DEFAULT_HIDDEN: ReadonlySet<string> = new Set([
  'email',
  'role',
  'start_date',
  'leaving_date',
]);

function StaffList({
  onAdd,
  onSecret,
}: {
  onAdd: () => void;
  onSecret: (secret: TemporaryPassword) => void;
}) {
  const { organization, can } = useOrg();
  const { user } = useAuth();
  const roleName = useRoleName();
  const { params, setParam } = useUrlParams();

  const { text: searchText, setText: setSearchText, searched: urlQuery } = useUrlSearch();

  const tabParam = params.get('tab');
  const tab: StaffTab = TABS.some((item) => item.value === tabParam)
    ? (tabParam as StaffTab)
    : 'active';
  const gradeId = params.get('grade') ?? '';
  const approverId = params.get('approver') ?? '';
  const roleId = params.get('role') ?? '';
  const loginParam = params.get('login') ?? '';
  const sortParam = params.get('sort');
  const sortKey: StaffSort = SORTS.find((item) => item === sortParam) ?? 'name';
  const order = params.get('order') === 'desc' ? 'desc' : 'asc';

  const canUpdate = can(PERMISSIONS.memberUpdate);
  const canRemove = can(PERMISSIONS.memberRemove);
  const canInvite = can(PERMISSIONS.memberInvite);
  const canReadRoles = can(PERMISSIONS.roleRead);
  const canReadRates = can(PERMISSIONS.rateRead);

  const filters = useMemo<StaffFilters>(
    () => ({
      q: urlQuery || undefined,
      status: [tab],
      grade_id: gradeId || undefined,
      approver_id: approverId || undefined,
      role_id: roleId || undefined,
      has_login: loginParam === 'yes' ? true : loginParam === 'no' ? false : undefined,
      sort: sortKey,
      order,
    }),
    [urlQuery, tab, gradeId, approverId, roleId, loginParam, sortKey, order],
  );
  const filterCount = [gradeId, approverId, roleId, loginParam].filter(Boolean).length;
  const filtered = Boolean(urlQuery) || filterCount > 0;

  const staff = useStaffList(filters);
  const grades = useGradeOptions();
  // The role list needs `role.read`; without it the role filter and "Change role" are not offered.
  const roles = useRoles({ enabled: canReadRoles });

  const [hidden, setHidden] = useState<ReadonlySet<string>>(DEFAULT_HIDDEN);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const navigate = useNavigate();
  const bulk = useBulkStaff();
  // Only people still in the list can be acted on: a ticked row a filter hid is left out.
  const pickedIds = useMemo(
    () =>
      flattenPages(staff.data)
        .filter((member) => selected.has(member.id))
        .map((member) => member.id),
    [staff.data, selected],
  );
  const bulkFlow = useBulkFlow<StaffBulkRequest>({
    run: bulk.mutateAsync,
    noun: ['person', 'people'],
    onDone: () => setSelected(new Set()),
  });
  // Edit opens the person's own page; every other action opens its dialog from here.
  const { actionsFor, dialogs, editPanel } = useStaffActions({
    onSecret,
    onEdit: (member) => void navigate(routes.org.staffMember(organization.slug, member.id)),
  });
  const clearFilters = () => {
    setSearchText('');
    setParam({ q: null, grade: null, approver: null, role: null, login: null });
  };

  const columns: DataTableColumn<StaffMember>[] = [
    {
      id: 'code',
      header: 'Code',
      sortable: true,
      className: 'w-24 whitespace-nowrap',
      cell: (member) => (
        <span className="font-medium text-text-muted tabular-nums">{member.code}</span>
      ),
    },
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      hideable: false,
      cell: (member) => (
        <div className="flex min-w-0 items-center gap-3">
          <InitialsAvatar name={member.full_name} initials={member.initials} colorKey={member.id} />
          <div className="flex min-w-0 flex-col">
            <span className="flex flex-wrap items-center gap-1.5">
              <Link
                to={routes.org.staffMember(organization.slug, member.id)}
                className="truncate font-semibold text-text hover:text-brand-text hover:underline"
              >
                {member.full_name}
              </Link>
              {member.id === user?.id ? (
                <Badge size="sm" tone="violet">
                  You
                </Badge>
              ) : null}
            </span>
            <span className="truncate text-xs text-text-muted">
              {member.job_title ?? member.email ?? member.login_email ?? ''}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'grade',
      header: 'Grade',
      sortable: true,
      className: 'w-32',
      cell: (member) =>
        member.grade ? (
          <span className="text-text-muted">{member.grade.name}</span>
        ) : (
          <span className="text-text-subtle">—</span>
        ),
    },
    {
      id: 'approver',
      header: 'Approver',
      className: 'w-44',
      cell: (member) =>
        member.approver ? (
          <span className="flex items-center gap-2">
            <InitialsAvatar
              name={member.approver.full_name}
              colorKey={member.approver.id}
              size="xs"
            />
            <span className="truncate text-text-muted">{member.approver.full_name}</span>
          </span>
        ) : (
          <span className="text-text-subtle">—</span>
        ),
    },
    {
      id: 'hours',
      header: 'Hours/day',
      align: 'end',
      className: 'w-28 whitespace-nowrap',
      cell: (member) => (
        <span
          className="text-text tabular-nums"
          title={`${minutesToHours(member.working_minutes_per_day)} hours`}
        >
          {formatMinutes(member.working_minutes_per_day)}
        </span>
      ),
    },
    {
      id: 'days',
      header: 'Working days',
      className: 'w-36 whitespace-nowrap',
      cell: (member) => (
        <span className="text-text-muted">{formatWeekdays(member.working_days)}</span>
      ),
    },
    {
      id: 'target',
      header: 'Chargeable target',
      align: 'end',
      className: 'w-36 whitespace-nowrap',
      cell: (member) => (
        <span className="text-text tabular-nums">
          {formatBasisPoints(member.chargeable_target_bp)}
        </span>
      ),
    },
    ...(canReadRates
      ? [
          {
            id: 'charge_rate',
            header: 'Charge-out rate',
            align: 'end' as const,
            className: 'w-36 whitespace-nowrap',
            cell: (member: StaffMember) => (
              <span className="text-text tabular-nums">{formatRate(member.charge_rate)}</span>
            ),
          },
          {
            id: 'cost_rate',
            header: 'Cost rate',
            align: 'end' as const,
            className: 'w-32 whitespace-nowrap',
            cell: (member: StaffMember) => (
              <span className="text-text tabular-nums">{formatRate(member.cost_rate)}</span>
            ),
          },
        ]
      : []),
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      className: 'w-28',
      cell: (member) => <StaffStatusBadge status={member.status} />,
    },
    {
      id: 'login',
      header: 'Login',
      className: 'w-32',
      cell: (member) => <LoginStatusBadge status={member.login_status} />,
    },
    {
      id: 'email',
      header: 'Work email',
      sortable: true,
      className: 'w-56',
      cell: (member) =>
        member.email ? (
          <span className="block truncate text-text-muted" title={member.email}>
            {member.email}
          </span>
        ) : (
          <span className="text-text-subtle">—</span>
        ),
    },
    {
      id: 'role',
      header: 'Role',
      className: 'w-36',
      cell: (member) => <Badge tone="neutral">{roleName(member.role)}</Badge>,
    },
    {
      id: 'start_date',
      header: 'Start date',
      sortable: true,
      className: 'w-32 whitespace-nowrap',
      cell: (member) => (
        <span className="text-text-muted">{formatUkDate(member.start_date) || '—'}</span>
      ),
    },
    {
      id: 'leaving_date',
      header: 'Leaving date',
      sortable: true,
      className: 'w-32 whitespace-nowrap',
      cell: (member) => (
        <span className="text-text-muted">{formatUkDate(member.leaving_date) || '—'}</span>
      ),
    },
  ];

  const sort: DataTableSort = { columnId: sortKey, direction: order };
  const loaded = flattenPages(staff.data);
  const showActions = canUpdate || canRemove || canInvite;
  const count = staff.data && !staff.hasNextPage ? loaded.length : null;
  const gradeFilterOptions = [
    { value: '', label: 'Any grade' },
    ...(grades.data ?? []).map((grade) => ({ value: grade.id, label: grade.name })),
  ];
  const roleFilterOptions = [
    { value: '', label: 'Any role' },
    ...(roles.data ?? []).map((item) => ({ value: item.id, label: roleName(item) })),
  ];

  const exportCsv = () => {
    const chosen = selected.size > 0 ? loaded.filter((row) => selected.has(row.id)) : loaded;
    const header = [
      'Code',
      'Name',
      'Work email',
      'Sign-in email',
      'Grade',
      'Approver',
      'Role',
      'Status',
      'Login',
      'Hours per day',
      'Working days',
      'Chargeable target %',
      'Start date',
      'Leaving date',
      ...(canReadRates ? ['Charge-out rate (£/h)', 'Cost rate (£/h)'] : []),
    ];
    const csv = toCsv([
      header,
      ...chosen.map((member) => [
        member.code,
        member.full_name,
        member.email,
        member.login_email,
        member.grade?.name,
        member.approver?.full_name,
        roleName(member.role),
        member.status,
        member.login_status,
        minutesToHours(member.working_minutes_per_day),
        formatWeekdays(member.working_days),
        member.chargeable_target_bp / 100,
        member.start_date,
        member.leaving_date,
        ...(canReadRates
          ? [penceToPoundsInput(member.charge_rate), penceToPoundsInput(member.cost_rate)]
          : []),
      ]),
    ]);
    downloadText(`${organization.slug}-staff.csv`, csv);
  };

  if (staff.isError && !staff.data) {
    return (
      <LoadError
        title="Could not load the staff list"
        error={staff.error}
        onRetry={() => void staff.refetch()}
        retrying={staff.isRefetching}
      />
    );
  }

  return (
    <>
      {editPanel}
      {pickedIds.length > 0 && (canUpdate || canRemove) ? (
        <StaffBulkBar
          ids={pickedIds}
          grades={grades.data ?? []}
          canUpdate={canUpdate}
          canRemove={canRemove}
          flow={bulkFlow}
          onClear={() => setSelected(new Set())}
        />
      ) : null}
      <DataTable
        caption="Staff members"
        columns={columns}
        rows={loaded}
        rowKey={(member) => member.id}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        selectLabel={(member) => `Select ${member.full_name}`}
        sort={sort}
        onSortChange={(next) => {
          setParam({ sort: next.columnId, order: next.direction });
        }}
        hiddenColumns={hidden}
        loading={staff.isPending}
        toolbar={
          <PageToolbar
            start={
              <CountTabs
                label="Staff lists"
                items={TABS.map((item) => ({
                  ...item,
                  count: item.value === tab ? count : undefined,
                }))}
                value={tab}
                onChange={(value) => {
                  setSelected(new Set());
                  setParam({ tab: value === 'active' ? null : value });
                }}
              />
            }
            search={
              <SearchField
                label="Search staff"
                placeholder="Quick search"
                value={searchText}
                onChange={setSearchText}
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
                  title="Filter staff"
                  count={filterCount}
                  onClear={() => setParam({ grade: null, approver: null, role: null, login: null })}
                >
                  <Select
                    label="Grade"
                    options={gradeFilterOptions}
                    value={gradeId}
                    onChange={(event) => setParam({ grade: event.target.value })}
                  />
                  <StaffPicker
                    label="Approver"
                    value={approverId || null}
                    onChange={(id) => setParam({ approver: id })}
                    hasLogin
                    placeholder="Anyone"
                  />
                  {canReadRoles ? (
                    <Select
                      label="Role"
                      options={roleFilterOptions}
                      value={roleId}
                      onChange={(event) => setParam({ role: event.target.value })}
                    />
                  ) : null}
                  <Select
                    label="Sign-in access"
                    options={LOGIN_OPTIONS}
                    value={loginParam}
                    onChange={(event) => setParam({ login: event.target.value })}
                  />
                </FilterPopover>
                <Button
                  variant="brand-outline"
                  size="sm"
                  leftIcon={<Download aria-hidden="true" className="size-4" />}
                  onClick={exportCsv}
                  disabled={loaded.length === 0}
                >
                  {selected.size > 0 ? `Export ${selected.size}` : 'Export'}
                </Button>
              </>
            }
            primaryAction={
              canInvite ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<UserPlus aria-hidden="true" className="size-4" />}
                  onClick={onAdd}
                >
                  Add staff member
                </Button>
              ) : undefined
            }
          />
        }
        rowActions={
          showActions
            ? (member) => {
                const items = actionsFor(member);
                return items.length > 0 ? (
                  <Dropdown
                    label={`Actions for ${member.full_name}`}
                    items={items}
                    trigger={<Ellipsis aria-hidden="true" className="size-5 text-text-muted" />}
                  />
                ) : null;
              }
            : undefined
        }
        empty={
          filtered ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No staff match"
              description="Try a different search or fewer filters."
              action={<Button onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={<Users className="size-6" />}
              title={tab === 'active' ? 'No staff yet' : `No ${tab} staff`}
              description={
                tab === 'active'
                  ? canInvite
                    ? 'Add the people you record time for. They do not need a login.'
                    : 'Staff appear here once an administrator adds them.'
                  : 'People appear here when they are deactivated or marked as left.'
              }
              action={
                tab === 'active' && canInvite ? (
                  <Button variant="primary" onClick={onAdd}>
                    Add staff member
                  </Button>
                ) : undefined
              }
            />
          )
        }
        footer={
          loaded.length > 0 ? (
            <div className="border-t border-row-border px-4 py-2">
              <Pagination
                hasMore={staff.hasNextPage}
                onLoadMore={() => void staff.fetchNextPage()}
                loading={staff.isFetchingNextPage}
                count={loaded.length}
                itemLabel={['person', 'people']}
              />
            </div>
          ) : null
        }
      />

      {dialogs}
    </>
  );
}

/** `/:orgSlug/team/staff`: the staff list. Needs `member.read`; adding needs `member.invite`. */
export default function StaffMembersPage() {
  const { can } = useOrg();
  useDocumentTitle('Staff Members');
  const { params, setParam } = useUrlParams();
  const canAdd = can(PERMISSIONS.memberInvite);
  // `?new=1` (the "+" quick-create menu) opens the dialog at once.
  const [adding, setAdding] = useState(() => canAdd && params.get('new') === '1');
  const [secret, setSecret] = useState<TemporaryPassword | null>(null);
  const closeAdding = () => {
    setAdding(false);
    if (params.has('new')) setParam({ new: null });
  };

  return (
    <PageShell
      title="Staff Members"
      description="The people you record time for: grade, approver, working hours, chargeable target and whether they can sign in."
    >
      <AddStaffPanel
        open={adding}
        onClose={closeAdding}
        onCreated={({ secret: created }) => {
          closeAdding();
          if (created) setSecret(created);
        }}
      />
      {can(PERMISSIONS.memberRead) ? (
        <StaffList onAdd={() => setAdding(true)} onSecret={setSecret} />
      ) : (
        <NoAccess what="the staff list" />
      )}
      <TemporaryPasswordDialog secret={secret} onClose={() => setSecret(null)} />
    </PageShell>
  );
}
