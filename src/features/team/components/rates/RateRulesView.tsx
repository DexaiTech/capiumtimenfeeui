import { Ellipsis, PoundSterling, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  Badge,
  Button,
  ColumnVisibilityMenu,
  ConfirmDialog,
  CountTabs,
  DataTable,
  Dropdown,
  EmptyState,
  Input,
  PageToolbar,
  Pagination,
  SearchField,
  Select,
  useToast,
  type DataTableColumn,
  type DataTableSort,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { modulePath, ORG_SEGMENTS } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { usePersistentColumns, useUrlParams } from '@/hooks';
import { formatUkDate } from '@/utils/dates';
import { cn } from '@/utils/cn';

import {
  flattenPages,
  useDeleteRateRule,
  useGradeOptions,
  useRateRules,
  useServices,
} from '../../api';
import { RATE_KIND_LABEL, scopeOptionsFor, type ScopeOption } from '../../constants';
import { useUrlSearch } from '../../hooks/useUrlSearch';
import type { RateKind, RateRule, RateRuleFilters, RuleSort, RuleStatus } from '../../types';
import { dialogError } from '../../utils/errors';
import { formatRate, scopeNames } from '../../utils/format';
import { RuleStatusBadge } from '../badges';
import { FilterPopover } from '../FilterPopover';
import { LoadError } from '../PageShell';
import { ClientPicker } from '../pickers/ClientPicker';
import { StaffPicker } from '../pickers/StaffPicker';
import { EndDateDialog } from './EndDateDialog';
import { RateRulePanel } from './RateRulePanel';

type StatusTab = 'all' | RuleStatus;
const STATUS_TABS: ReadonlyArray<{ value: StatusTab; label: string }> = [
  { value: 'all', label: 'All rates' },
  { value: 'current', label: 'Current' },
  { value: 'future', label: 'Future' },
  { value: 'ended', label: 'Ended' },
];
const SORTS: ReadonlyArray<RuleSort> = ['effective_from', 'rate'];
const LEVELS: Record<RateKind, ReadonlyArray<ScopeOption>> = {
  cost: scopeOptionsFor('cost'),
  charge: scopeOptionsFor('charge'),
};

type DialogState =
  | { type: 'form'; rule: RateRule | null }
  | { type: 'end'; rule: RateRule }
  | { type: 'delete'; rule: RateRule }
  | null;

export interface RateRulesViewProps {
  kind: RateKind;
}

/**
 * The list of the rate rules of one kind (cost or charge-out) with its filters, and the actions on
 * a rate: add, edit, end-date, delete and a link to its history. The page checks `rate.read`;
 * the actions need `rate.manage`.
 */
export function RateRulesView({ kind }: RateRulesViewProps) {
  const { organization, can } = useOrg();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();

  const canManage = can(PERMISSIONS.rateManage);
  // The pickers read staff, grades and clients, which have their own permissions.
  const canPickPeople = can(PERMISSIONS.memberRead);
  const canPickClient = can(PERMISSIONS.clientRead);
  const levels = LEVELS[kind];

  const tabParam = params.get('status');
  const tab: StatusTab = STATUS_TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const scopeParam = params.get('scope');
  const scope = levels.find((option) => option.level === scopeParam)?.level ?? '';
  const onDate = params.get('as_at') ?? '';
  const staffId = params.get('staff') ?? '';
  const gradeId = params.get('grade') ?? '';
  const clientId = params.get('client') ?? '';
  const serviceId = params.get('service') ?? '';
  const sortKey: RuleSort = SORTS.find((item) => item === params.get('sort')) ?? 'effective_from';
  const order = params.get('order') === 'asc' ? 'asc' : 'desc';

  const filters = useMemo<RateRuleFilters>(
    () => ({
      kind,
      level: scope ? [scope] : undefined,
      status: tab === 'all' ? undefined : tab,
      on_date: onDate || undefined,
      user_id: staffId || undefined,
      grade_id: gradeId || undefined,
      client_id: clientId || undefined,
      service_id: serviceId || undefined,
      q: searched || undefined,
      sort: sortKey,
      order,
    }),
    [kind, scope, tab, onDate, staffId, gradeId, clientId, serviceId, searched, sortKey, order],
  );
  const rules = useRateRules(filters);
  const remove = useDeleteRateRule();
  const grades = useGradeOptions({ enabled: canPickPeople });
  const services = useServices();

  const [hidden, setHidden] = usePersistentColumns('rate-rules');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const close = () => setDialog(null);

  const kindName = RATE_KIND_LABEL[kind].toLowerCase();
  const filterCount = [scope, onDate, staffId, gradeId, clientId, serviceId].filter(Boolean).length;
  const filtered = Boolean(searched) || tab !== 'all' || filterCount > 0;
  const clearFilters = () => {
    setSearchText('');
    setParam({
      q: null,
      status: null,
      scope: null,
      as_at: null,
      staff: null,
      grade: null,
      client: null,
      service: null,
    });
  };

  /** The history page, narrowed to what the rate applies to. */
  const historyPath = (rule: RateRule) => {
    const query = new URLSearchParams({ kind: rule.kind });
    if (rule.staff) query.set('staff', rule.staff.id);
    if (rule.grade) query.set('grade', rule.grade.id);
    if (rule.client) query.set('client', rule.client.id);
    if (rule.service) query.set('service', rule.service.id);
    return `${modulePath(organization.slug, ORG_SEGMENTS.team, 'rate-history')}?${query.toString()}`;
  };

  const confirmDelete = () => {
    if (dialog?.type !== 'delete') return;
    remove.mutate(dialog.rule.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Rate deleted' });
        close();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  const actionsFor = (rule: RateRule): DropdownItem[] => {
    const items: DropdownItem[] = [];
    if (canManage) {
      items.push({
        id: 'edit',
        label: 'Edit',
        onSelect: () => setDialog({ type: 'form', rule }),
      });
      if (rule.status !== 'ended') {
        items.push({
          id: 'end',
          label: 'End-date',
          onSelect: () => setDialog({ type: 'end', rule }),
        });
      }
    }
    items.push({
      id: 'history',
      label: 'View history',
      onSelect: () => void navigate(historyPath(rule)),
    });
    if (canManage && rule.can_delete) {
      items.push({ id: 'separator', separator: true });
      items.push({
        id: 'delete',
        label: 'Delete',
        tone: 'danger',
        onSelect: () => {
          setRefusal(null);
          setDialog({ type: 'delete', rule });
        },
      });
    }
    return items;
  };

  const columns: DataTableColumn<RateRule>[] = [
    {
      id: 'applies',
      header: 'Applies to',
      hideable: false,
      cell: (rule) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-1.5">
            <Badge tone="violet" size="sm">
              {rule.level_label}
            </Badge>
          </span>
          <span
            className={cn(
              'truncate font-medium text-text',
              canManage && 'hover:text-brand-text hover:underline',
            )}
            title={scopeNames(rule).join(' · ')}
          >
            {scopeNames(rule).join(' · ')}
          </span>
        </div>
      ),
    },
    {
      id: 'rate',
      header: 'Rate',
      sortable: true,
      align: 'end',
      className: 'w-36 whitespace-nowrap',
      cell: (rule) => (
        <span className="font-semibold text-text tabular-nums">{formatRate(rule.rate)}</span>
      ),
    },
    {
      id: 'effective_from',
      header: 'Effective from',
      sortable: true,
      className: 'w-36 whitespace-nowrap',
      cell: (rule) => <span className="text-text">{formatUkDate(rule.effective_from)}</span>,
    },
    {
      id: 'effective_to',
      header: 'Effective to',
      className: 'w-36 whitespace-nowrap',
      cell: (rule) =>
        rule.effective_to ? (
          <span className="text-text">{formatUkDate(rule.effective_to)}</span>
        ) : (
          <span className="text-text-muted">Open-ended</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      className: 'w-44',
      cell: (rule) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <RuleStatusBadge status={rule.status} />
          {rule.is_used ? (
            <span title="Time has been recorded under this rate: it can be end-dated, not deleted.">
              <Badge tone="grey" size="sm">
                In use
              </Badge>
            </span>
          ) : null}
        </span>
      ),
    },
  ];

  const sort: DataTableSort = { columnId: sortKey, direction: order };
  const loaded = flattenPages(rules.data);
  const count = rules.data && !rules.hasNextPage ? loaded.length : null;

  if (rules.isError && !rules.data) {
    return (
      <LoadError
        title={`Could not load the ${kindName} rates`}
        error={rules.error}
        onRetry={() => void rules.refetch()}
        retrying={rules.isRefetching}
      />
    );
  }

  const gradeOptions = [
    { value: '', label: 'All grades' },
    ...(grades.data ?? []).map((grade) => ({ value: grade.id, label: grade.name })),
  ];
  const serviceOptions = [
    { value: '', label: 'All services' },
    ...(services.data ?? []).map((service) => ({ value: service.id, label: service.name })),
  ];
  const scopeOptions = [
    { value: '', label: 'All levels' },
    ...levels.map((option) => ({ value: option.level, label: option.label })),
  ];
  const deleting = dialog?.type === 'delete' ? dialog.rule : null;

  return (
    <>
      <RateRulePanel
        kind={kind}
        open={dialog?.type === 'form'}
        rule={dialog?.type === 'form' ? dialog.rule : null}
        defaultLevel={scope || undefined}
        onClose={close}
      />
      <DataTable
        caption={`${RATE_KIND_LABEL[kind]} rates`}
        columns={columns}
        rows={loaded}
        rowKey={(rule) => rule.id}
        // Clicking a rate (its name or anywhere on its row) opens it for editing.
        onRowClick={canManage ? (rule) => setDialog({ type: 'form', rule }) : undefined}
        sort={sort}
        onSortChange={(next) => setParam({ sort: next.columnId, order: next.direction })}
        hiddenColumns={hidden}
        loading={rules.isPending}
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
            search={
              <SearchField
                label={`Search ${kindName} rates`}
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
                  title={`Filter ${kindName} rates`}
                  count={filterCount}
                  onClear={() =>
                    setParam({
                      scope: null,
                      as_at: null,
                      staff: null,
                      grade: null,
                      client: null,
                      service: null,
                    })
                  }
                >
                  <Select
                    label="Applies to"
                    options={scopeOptions}
                    value={scope}
                    onChange={(event) => setParam({ scope: event.target.value })}
                  />
                  <Input
                    label="In force on"
                    type="date"
                    hint="Only rates that apply on this date."
                    value={onDate}
                    onChange={(event) => setParam({ as_at: event.target.value })}
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
                  {kind === 'charge' && canPickClient ? (
                    <ClientPicker
                      label="Client"
                      value={clientId || null}
                      onChange={(id) => setParam({ client: id })}
                      placeholder="Any client"
                    />
                  ) : null}
                  {kind === 'charge' ? (
                    <Select
                      label="Service"
                      options={serviceOptions}
                      value={serviceId}
                      onChange={(event) => setParam({ service: event.target.value })}
                    />
                  ) : null}
                </FilterPopover>
              </>
            }
            primaryAction={
              canManage ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<PoundSterling aria-hidden="true" className="size-4" />}
                  onClick={() => setDialog({ type: 'form', rule: null })}
                >
                  Add rate
                </Button>
              ) : undefined
            }
          />
        }
        rowActions={(rule) => (
          <Dropdown
            label={`Actions for the rate of ${scopeNames(rule).join(' · ')}`}
            items={actionsFor(rule)}
            trigger={<Ellipsis aria-hidden="true" className="size-5 text-text-muted" />}
          />
        )}
        empty={
          filtered ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No rates match"
              description="Try a different search or fewer filters."
              action={<Button onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={<PoundSterling className="size-6" />}
              title={`No ${kindName} rates yet`}
              description={
                kind === 'cost'
                  ? 'Cost rates say what a person or a grade costs the practice per hour. Without one, the grade default applies.'
                  : 'Charge-out rates say what the practice charges per hour. Without one, the grade default and then the practice default apply.'
              }
              action={
                canManage ? (
                  <Button variant="primary" onClick={() => setDialog({ type: 'form', rule: null })}>
                    Add rate
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
                hasMore={rules.hasNextPage}
                onLoadMore={() => void rules.fetchNextPage()}
                loading={rules.isFetchingNextPage}
                count={loaded.length}
                itemLabel={['rate', 'rates']}
              />
            </div>
          ) : null
        }
      />
      <EndDateDialog rule={dialog?.type === 'end' ? dialog.rule : null} onClose={close} />
      <ConfirmDialog
        open={deleting !== null}
        onClose={close}
        onConfirm={confirmDelete}
        title="Delete rate?"
        confirmLabel="Delete rate"
        loading={remove.isPending}
        error={refusal}
      >
        {deleting ? (
          <p>
            The {kindName} rate of{' '}
            <strong className="font-medium text-text">{scopeNames(deleting).join(' · ')}</strong> (
            {formatRate(deleting.rate)} from {formatUkDate(deleting.effective_from)}) will be
            removed. The change is kept in the rate history. No time has been recorded under it.
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
