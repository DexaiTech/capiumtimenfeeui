import { AlarmClockPlus, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  Badge,
  Button,
  ConfirmDialog,
  CountTabs,
  DataTable,
  EmptyState,
  PageToolbar,
  Pagination,
  RowActions,
  Select,
  useToast,
  type DataTableColumn,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useUrlParams } from '@/hooks';
import { formatUkDate } from '@/utils/dates';

import { flattenPages, useDeleteOvertimeRate, useGradeOptions, useOvertimeRates } from '../../api';
import type { OvertimeLevel, OvertimeRate, OvertimeRateFilters, RuleStatus } from '../../types';
import { dialogError } from '../../utils/errors';
import { formatOvertimeRate, overtimeSubject } from '../../utils/format';
import { RuleStatusBadge } from '../badges';
import { FilterPopover } from '../FilterPopover';
import { LoadError } from '../PageShell';
import { StaffPicker } from '../pickers/StaffPicker';
import { EndOvertimeRateDialog } from './EndOvertimeRateDialog';
import { OvertimeRatePanel } from './OvertimeRatePanel';

type StatusTab = 'all' | RuleStatus;
const STATUS_TABS: ReadonlyArray<{ value: StatusTab; label: string }> = [
  { value: 'all', label: 'All rates' },
  { value: 'current', label: 'Current' },
  { value: 'future', label: 'Future' },
  { value: 'ended', label: 'Ended' },
];
const LEVEL_LABEL: Record<OvertimeLevel, string> = { grade: 'Grade', staff: 'Staff' };
const LEVELS: ReadonlyArray<OvertimeLevel> = ['grade', 'staff'];

type DialogState =
  | { type: 'add' }
  | { type: 'end'; rate: OvertimeRate }
  | { type: 'delete'; rate: OvertimeRate }
  | null;

/**
 * The overtime rates of grades and staff, with their filters, and the actions on a rate: add,
 * end-date and delete. The page checks `rate.read`; the actions need `rate.manage`.
 */
export function OvertimeRatesView() {
  const { can } = useOrg();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();

  const canManage = can(PERMISSIONS.rateManage);
  // The staff and grade filters read lists that need `member.read`.
  const canPickPeople = can(PERMISSIONS.memberRead);

  const tabParam = params.get('status');
  const tab: StatusTab = STATUS_TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const level = LEVELS.find((value) => value === params.get('level')) ?? '';
  const staffId = params.get('staff') ?? '';
  const gradeId = params.get('grade') ?? '';

  const filters = useMemo<OvertimeRateFilters>(
    () => ({
      level: level || undefined,
      status: tab === 'all' ? undefined : tab,
      user_id: staffId || undefined,
      grade_id: gradeId || undefined,
    }),
    [level, tab, staffId, gradeId],
  );
  const rates = useOvertimeRates(filters);
  const remove = useDeleteOvertimeRate();
  const grades = useGradeOptions({ enabled: canPickPeople });

  const [dialog, setDialog] = useState<DialogState>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const close = () => setDialog(null);

  const filterCount = [level, staffId, gradeId].filter(Boolean).length;
  const filtered = tab !== 'all' || filterCount > 0;
  const clearFilters = () => setParam({ status: null, level: null, staff: null, grade: null });

  const confirmDelete = () => {
    if (dialog?.type !== 'delete') return;
    remove.mutate(dialog.rate.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Overtime rate deleted' });
        close();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  const actionsFor = (rate: OvertimeRate): DropdownItem[] => {
    const items: DropdownItem[] = [];
    if (rate.status !== 'ended') {
      items.push({
        id: 'end',
        label: 'End-date',
        onSelect: () => setDialog({ type: 'end', rate }),
      });
    }
    items.push({
      id: 'delete',
      label: 'Delete',
      tone: 'danger',
      onSelect: () => {
        setRefusal(null);
        setDialog({ type: 'delete', rate });
      },
    });
    return items;
  };

  const columns: DataTableColumn<OvertimeRate>[] = [
    {
      id: 'applies',
      header: 'Applies to',
      cell: (rate) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-1.5">
            <Badge tone="violet" size="sm">
              {LEVEL_LABEL[rate.level]}
            </Badge>
          </span>
          <span className="truncate font-medium text-text">{overtimeSubject(rate)}</span>
        </div>
      ),
    },
    {
      id: 'rate',
      header: 'Overtime rate',
      className: 'whitespace-nowrap',
      cell: (rate) => (
        <span className="font-semibold text-text tabular-nums">{formatOvertimeRate(rate)}</span>
      ),
    },
    {
      id: 'effective_from',
      header: 'Effective from',
      className: 'w-36 whitespace-nowrap',
      cell: (rate) => <span className="text-text">{formatUkDate(rate.effective_from)}</span>,
    },
    {
      id: 'effective_to',
      header: 'Effective to',
      className: 'w-36 whitespace-nowrap',
      cell: (rate) =>
        rate.effective_to ? (
          <span className="text-text">{formatUkDate(rate.effective_to)}</span>
        ) : (
          <span className="text-text-muted">Open-ended</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      className: 'w-32',
      cell: (rate) => <RuleStatusBadge status={rate.status} />,
    },
  ];

  const loaded = flattenPages(rates.data);
  const count = rates.data && !rates.hasNextPage ? loaded.length : null;

  if (rates.isError && !rates.data) {
    return (
      <LoadError
        title="Could not load the overtime rates"
        error={rates.error}
        onRetry={() => void rates.refetch()}
        retrying={rates.isRefetching}
      />
    );
  }

  const gradeOptions = [
    { value: '', label: 'All grades' },
    ...(grades.data ?? []).map((grade) => ({ value: grade.id, label: grade.name })),
  ];
  const levelOptions = [
    { value: '', label: 'All levels' },
    ...LEVELS.map((value) => ({ value, label: LEVEL_LABEL[value] })),
  ];
  const add = () => setDialog({ type: 'add' });
  const deleting = dialog?.type === 'delete' ? dialog.rate : null;

  return (
    <>
      <OvertimeRatePanel open={dialog?.type === 'add'} onClose={close} />
      <DataTable
        caption="Overtime rates"
        columns={columns}
        rows={loaded}
        rowKey={(rate) => rate.id}
        loading={rates.isPending}
        toolbar={
          <PageToolbar
            start={
              <CountTabs
                label="Rate lists"
                items={STATUS_TABS.map((item) => ({
                  ...item,
                  count: item.value === tab ? count : undefined,
                }))}
                value={tab}
                onChange={(value) => setParam({ status: value === 'all' ? null : value })}
              />
            }
            actions={
              <FilterPopover
                title="Filter overtime rates"
                count={filterCount}
                onClear={() => setParam({ level: null, staff: null, grade: null })}
              >
                <Select
                  label="Applies to"
                  options={levelOptions}
                  value={level}
                  onChange={(event) => setParam({ level: event.target.value })}
                />
                {canPickPeople ? (
                  <StaffPicker
                    label="Staff member"
                    value={staffId || null}
                    onChange={(id) => setParam({ staff: id })}
                    includeLeft
                    placeholder="Anyone"
                  />
                ) : null}
                {canPickPeople ? (
                  <Select
                    label="Grade"
                    options={gradeOptions}
                    value={gradeId}
                    onChange={(event) => setParam({ grade: event.target.value })}
                  />
                ) : null}
              </FilterPopover>
            }
            primaryAction={
              canManage ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<AlarmClockPlus aria-hidden="true" className="size-4" />}
                  onClick={add}
                >
                  Add overtime rate
                </Button>
              ) : undefined
            }
          />
        }
        rowActions={
          canManage
            ? (rate) => (
                <RowActions
                  label={`Actions for the overtime rate of ${overtimeSubject(rate)}`}
                  items={actionsFor(rate)}
                />
              )
            : undefined
        }
        empty={
          filtered ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No overtime rates match"
              description="Try fewer filters."
              action={<Button onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={<AlarmClockPlus className="size-6" />}
              title="No overtime rates yet"
              description="An overtime rate says what an hour beyond a person's standard hours costs the practice: a multiple of their cost rate or a fixed amount."
              action={
                canManage ? (
                  <Button variant="primary" onClick={add}>
                    Add overtime rate
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
                hasMore={rates.hasNextPage}
                onLoadMore={() => void rates.fetchNextPage()}
                loading={rates.isFetchingNextPage}
                count={loaded.length}
                itemLabel={['rate', 'rates']}
              />
            </div>
          ) : null
        }
      />
      <EndOvertimeRateDialog rate={dialog?.type === 'end' ? dialog.rate : null} onClose={close} />
      <ConfirmDialog
        open={deleting !== null}
        onClose={close}
        onConfirm={confirmDelete}
        title="Delete overtime rate?"
        confirmLabel="Delete rate"
        loading={remove.isPending}
        error={refusal}
      >
        {deleting ? (
          <p>
            The overtime rate of{' '}
            <strong className="font-medium text-text">{overtimeSubject(deleting)}</strong> (
            {formatOvertimeRate(deleting)} from {formatUkDate(deleting.effective_from)}) will be
            removed. This cannot be undone.
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
