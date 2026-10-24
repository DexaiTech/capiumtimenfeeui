import { Award, Ellipsis, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  Button,
  ColumnVisibilityMenu,
  ConfirmDialog,
  CountTabs,
  DataTable,
  Dropdown,
  EmptyState,
  PageToolbar,
  Pagination,
  SearchField,
  useToast,
  type DataTableColumn,
  type DataTableSort,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, useUrlParams } from '@/hooks';
import { formatBasisPoints } from '@/utils/money';

import { flattenPages, useDeleteGrade, useGrades, useSetGradeActive } from '../api';
import { ActiveBadge } from '../components/badges';
import { GradeFormPanel } from '../components/grades/GradeFormPanel';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { useUrlSearch } from '../hooks/useUrlSearch';
import type { Grade, GradeFilters, GradeSort } from '../types';
import { describeFailure, dialogError } from '../utils/errors';
import { formatRate, plural } from '../utils/format';

type GradeTab = 'all' | 'active' | 'inactive';
const TABS: ReadonlyArray<{ value: GradeTab; label: string }> = [
  { value: 'all', label: 'All grades' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const SORTS: ReadonlyArray<GradeSort> = ['sort_order', 'name', 'code'];

type DialogState = { type: 'form'; grade: Grade | null } | { type: 'delete'; grade: Grade } | null;

function GradeList() {
  const { can } = useOrg();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();

  const tabParam = params.get('tab');
  const tab: GradeTab = TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const sortKey: GradeSort = SORTS.find((item) => item === params.get('sort')) ?? 'sort_order';
  const order = params.get('order') === 'desc' ? 'desc' : 'asc';

  const canManage = can(PERMISSIONS.rateManage);
  const canReadRates = can(PERMISSIONS.rateRead);

  const filters = useMemo<GradeFilters>(
    () => ({
      q: searched || undefined,
      is_active: tab === 'all' ? undefined : tab === 'active',
      sort: sortKey,
      order,
    }),
    [searched, tab, sortKey, order],
  );
  const grades = useGrades(filters);
  const setActive = useSetGradeActive();
  const remove = useDeleteGrade();

  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const close = () => setDialog(null);

  const toggleActive = (grade: Grade) => {
    setActive.mutate(
      { gradeId: grade.id, active: !grade.is_active },
      {
        onSuccess: () =>
          toast({
            tone: 'success',
            title: grade.is_active ? `${grade.name} deactivated` : `${grade.name} activated`,
          }),
        onError: (error) =>
          toast({ tone: 'error', ...describeFailure(error, 'Could not change the grade') }),
      },
    );
  };

  const confirmDelete = () => {
    if (dialog?.type !== 'delete') return;
    const grade = dialog.grade;
    remove.mutate(grade.id, {
      onSuccess: (result) => {
        toast({
          tone: 'success',
          title:
            result.outcome === 'deleted'
              ? `${grade.name} deleted`
              : `${grade.name} deactivated instead`,
          description:
            result.outcome === 'deleted'
              ? undefined
              : 'It is used by staff or rates, so it was kept. Staff who hold it keep it.',
        });
        close();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  const actionsFor = (grade: Grade): DropdownItem[] => [
    { id: 'edit', label: 'Edit', onSelect: () => setDialog({ type: 'form', grade }) },
    {
      id: 'toggle',
      label: grade.is_active ? 'Deactivate' : 'Activate',
      onSelect: () => toggleActive(grade),
    },
    { id: 'separator', separator: true },
    {
      id: 'delete',
      label: 'Delete',
      tone: 'danger',
      onSelect: () => {
        setRefusal(null);
        setDialog({ type: 'delete', grade });
      },
    },
  ];

  const columns: DataTableColumn<Grade>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      hideable: false,
      cell: (grade) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-text">{grade.name}</span>
          {grade.description ? (
            <span className="truncate text-xs text-text-muted" title={grade.description}>
              {grade.description}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'code',
      header: 'Code',
      sortable: true,
      className: 'w-28 whitespace-nowrap',
      cell: (grade) => <span className="font-medium text-text-muted">{grade.code}</span>,
    },
    ...(canReadRates
      ? [
          {
            id: 'cost',
            header: 'Default cost rate',
            align: 'end' as const,
            className: 'w-40 whitespace-nowrap',
            cell: (grade: Grade) => (
              <span className="text-text tabular-nums">{formatRate(grade.default_cost_rate)}</span>
            ),
          },
        ]
      : []),
    {
      id: 'charge',
      header: 'Default charge-out rate',
      align: 'end',
      className: 'w-48 whitespace-nowrap',
      cell: (grade) => (
        <span className="text-text tabular-nums">{formatRate(grade.default_charge_rate)}</span>
      ),
    },
    {
      id: 'target',
      header: 'Chargeable target',
      align: 'end',
      className: 'w-40 whitespace-nowrap',
      cell: (grade) => (
        <span className="text-text tabular-nums">
          {formatBasisPoints(grade.default_chargeable_target_bp)}
        </span>
      ),
    },
    {
      id: 'staff',
      header: 'Staff',
      align: 'end',
      className: 'w-24',
      cell: (grade) => <span className="text-text tabular-nums">{grade.staff_count}</span>,
    },
    {
      id: 'sort_order',
      header: 'Order',
      sortable: true,
      align: 'end',
      className: 'w-24',
      cell: (grade) => <span className="text-text-muted tabular-nums">{grade.sort_order}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      className: 'w-28',
      cell: (grade) => <ActiveBadge active={grade.is_active} />,
    },
  ];

  const sort: DataTableSort = { columnId: sortKey, direction: order };
  const loaded = flattenPages(grades.data);
  const count = grades.data && !grades.hasNextPage ? loaded.length : null;
  const filtered = Boolean(searched) || tab !== 'all';

  if (grades.isError && !grades.data) {
    return (
      <LoadError
        title="Could not load the grades"
        error={grades.error}
        onRetry={() => void grades.refetch()}
        retrying={grades.isRefetching}
      />
    );
  }

  const target = dialog?.type === 'delete' ? dialog.grade : null;

  return (
    <>
      <GradeFormPanel
        open={dialog?.type === 'form'}
        grade={dialog?.type === 'form' ? dialog.grade : null}
        onClose={close}
      />
      <DataTable
        caption="Grades"
        columns={columns}
        rows={loaded}
        rowKey={(grade) => grade.id}
        sort={sort}
        onSortChange={(next) => setParam({ sort: next.columnId, order: next.direction })}
        hiddenColumns={hidden}
        loading={grades.isPending}
        toolbar={
          <PageToolbar
            start={
              <CountTabs
                label="Grade lists"
                items={TABS.map((item) => ({
                  ...item,
                  count: item.value === tab ? count : undefined,
                }))}
                value={tab}
                onChange={(value) => setParam({ tab: value === 'all' ? null : value })}
              />
            }
            search={
              <SearchField
                label="Search grades"
                placeholder="Quick search"
                value={searchText}
                onChange={setSearchText}
              />
            }
            actions={
              <ColumnVisibilityMenu
                columns={columns.map((column) => ({
                  id: column.id,
                  label: column.header,
                  locked: column.hideable === false,
                }))}
                hidden={hidden}
                onChange={setHidden}
              />
            }
            primaryAction={
              canManage ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Award aria-hidden="true" className="size-4" />}
                  onClick={() => setDialog({ type: 'form', grade: null })}
                >
                  Add grade
                </Button>
              ) : undefined
            }
          />
        }
        rowActions={
          canManage
            ? (grade) => (
                <Dropdown
                  label={`Actions for ${grade.name}`}
                  items={actionsFor(grade)}
                  trigger={<Ellipsis aria-hidden="true" className="size-5 text-text-muted" />}
                />
              )
            : undefined
        }
        empty={
          filtered ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No grades match"
              description="Try a different search or another tab."
              action={
                <Button
                  onClick={() => {
                    setSearchText('');
                    setParam({ q: null, tab: null });
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Award className="size-6" />}
              title="No grades yet"
              description="Grades group staff by level and carry the default rates and chargeable target."
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    onClick={() => setDialog({ type: 'form', grade: null })}
                  >
                    Add grade
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
                hasMore={grades.hasNextPage}
                onLoadMore={() => void grades.fetchNextPage()}
                loading={grades.isFetchingNextPage}
                count={loaded.length}
                itemLabel={['grade', 'grades']}
              />
            </div>
          ) : null
        }
      />
      <ConfirmDialog
        open={target !== null}
        onClose={close}
        onConfirm={confirmDelete}
        title={target?.can_delete === false ? 'Deactivate grade?' : 'Delete grade?'}
        confirmLabel={target?.can_delete === false ? 'Deactivate' : 'Delete'}
        loading={remove.isPending}
        error={refusal}
      >
        {target?.can_delete === false ? (
          <p>
            <strong className="font-medium text-text">{target.name}</strong> is used by{' '}
            {plural(target.staff_count, 'staff member', 'staff members')} or by rates, so it cannot
            be deleted. It will be deactivated instead: staff who hold it keep it, and it cannot be
            given to anyone else.
          </p>
        ) : (
          <p>
            <strong className="font-medium text-text">{target?.name}</strong> is not used by any
            staff member or rate, so it will be removed completely.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

/** `/:orgSlug/team/grades`: staff grades with default rates and chargeable target (`member.read`). */
export default function GradesPage() {
  const { can } = useOrg();
  useDocumentTitle('Grades');
  return (
    <PageShell
      title="Grades"
      description="Staff grades with their default cost rate, charge-out rate and chargeable target. A dated rate overrides a grade's default while it is in force."
    >
      {can(PERMISSIONS.memberRead) ? <GradeList /> : <NoAccess what="grades" />}
    </PageShell>
  );
}
