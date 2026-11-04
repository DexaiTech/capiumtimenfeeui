import { Building2, Plus, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  CountTabs,
  DataTable,
  EmptyState,
  PageToolbar,
  RowActions,
  SearchField,
  sortRows,
  Switch,
  useToast,
  type DataTableColumn,
  type DataTableSort,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg, useUpdateOrganization } from '@/features/organizations';
import { useDocumentTitle, useUrlParams } from '@/hooks';

import { useBranches, useDeleteBranch, useUpdateBranch } from '../api/branchHooks';
import type { Branch } from '../branchTypes';
import { BranchFormPanel } from '../components/branches/BranchFormPanel';
import { LoadError } from '../components/LoadError';
import { SettingsSection } from '../components/SettingsSection';
import { useUrlSearch } from '../hooks/useUrlSearch';
import { dialogError } from '../utils/billingErrors';
import { describeError } from '../utils/errors';

type BranchTab = 'all' | 'active' | 'inactive';
const TABS: ReadonlyArray<{ value: BranchTab; label: string }> = [
  { value: 'all', label: 'All branches' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const SORTS = ['name', 'clients', 'status'] as const;
// The client counts are only for members who may read clients.
const WITHOUT_CLIENTS: ReadonlySet<string> = new Set(['clients']);

type DialogState =
  { type: 'form'; branch: Branch | null } | { type: 'delete'; branchId: string } | null;

function BranchList() {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();

  const tabParam = params.get('tab');
  const tab: BranchTab = TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const sortId = SORTS.find((item) => item === params.get('sort'));
  const order = params.get('order') === 'desc' ? 'desc' : 'asc';
  const canManage = can(PERMISSIONS.settingsManage);

  const branches = useBranches();
  const update = useUpdateBranch();
  const remove = useDeleteBranch();

  const [dialog, setDialog] = useState<DialogState>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const close = () => setDialog(null);

  const all = branches.data ?? [];
  const target =
    dialog?.type === 'delete' ? (all.find((entry) => entry.id === dialog.branchId) ?? null) : null;

  const setActive = (branch: Branch, active: boolean) => {
    update.mutate(
      { branchId: branch.id, body: { is_active: active } },
      {
        onSuccess: () =>
          toast({
            tone: 'success',
            title: `${branch.name} ${active ? 'activated' : 'deactivated'}`,
          }),
        onError: (error) =>
          toast({ tone: 'error', ...describeError(error, 'Could not change the branch') }),
      },
    );
  };

  const confirmDelete = () => {
    if (!target) return;
    remove.mutate(target.id, {
      onSuccess: (result) => {
        toast({
          tone: 'success',
          title:
            result.outcome === 'deleted'
              ? `${target.name} deleted`
              : `${target.name} deactivated instead`,
          description:
            result.outcome === 'deleted' ? undefined : 'Clients have this branch, so it was kept.',
        });
        close();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  const actionsFor = (branch: Branch): DropdownItem[] => [
    { id: 'edit', label: 'Edit', onSelect: () => setDialog({ type: 'form', branch }) },
    branch.is_active
      ? { id: 'deactivate', label: 'Deactivate', onSelect: () => setActive(branch, false) }
      : { id: 'activate', label: 'Activate', onSelect: () => setActive(branch, true) },
    { id: 'separator', separator: true },
    {
      id: 'delete',
      label: 'Delete',
      tone: 'danger',
      onSelect: () => {
        setRefusal(null);
        setDialog({ type: 'delete', branchId: branch.id });
      },
    },
  ];

  const columns: DataTableColumn<Branch>[] = [
    {
      id: 'name',
      header: 'Branch',
      sortable: true,
      sortValue: (branch) => branch.name,
      hideable: false,
      cell: (branch) => <span className="font-semibold text-text">{branch.name}</span>,
    },
    {
      id: 'clients',
      header: 'Clients',
      sortable: true,
      sortValue: (branch) => branch.client_count,
      align: 'end',
      className: 'w-28 whitespace-nowrap',
      cell: (branch) =>
        branch.client_count ? (
          <Link
            to={`${routes.org.clients(organization.slug)}?branch=${encodeURIComponent(branch.id)}`}
            aria-label={`${branch.client_count} ${branch.client_count === 1 ? 'client' : 'clients'} in ${branch.name}`}
            className="font-medium tabular-nums text-brand-text hover:underline"
          >
            {branch.client_count}
          </Link>
        ) : (
          <span className="tabular-nums text-text-muted">0</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (branch) => (branch.is_active ? 'Active' : 'Inactive'),
      className: 'w-28',
      cell: (branch) => (
        <Badge tone={branch.is_active ? 'success' : 'neutral'}>
          {branch.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  const needle = searched.toLowerCase();
  const matches = all.filter(
    (branch) =>
      (tab === 'all' || branch.is_active === (tab === 'active')) &&
      (needle === '' || branch.name.toLowerCase().includes(needle)),
  );
  const sort: DataTableSort | null = sortId ? { columnId: sortId, direction: order } : null;
  const rows = sortRows(matches, columns, sort);
  const counts: Record<BranchTab, number> = {
    all: all.length,
    active: all.filter((branch) => branch.is_active).length,
    inactive: all.filter((branch) => !branch.is_active).length,
  };
  const filtered = needle !== '' || tab !== 'all';

  if (branches.isError && !branches.data) {
    return (
      <LoadError
        title="Could not load the branches"
        error={branches.error}
        onRetry={() => void branches.refetch()}
        retrying={branches.isRefetching}
      />
    );
  }

  return (
    <>
      <BranchFormPanel
        open={dialog?.type === 'form'}
        branch={dialog?.type === 'form' ? dialog.branch : null}
        onClose={close}
      />
      <DataTable
        caption="Branches"
        columns={columns}
        rows={rows}
        rowKey={(branch) => branch.id}
        hiddenColumns={can(PERMISSIONS.clientRead) ? undefined : WITHOUT_CLIENTS}
        sort={sort}
        onSortChange={(next) => setParam({ sort: next.columnId, order: next.direction })}
        loading={branches.isPending}
        toolbar={
          <PageToolbar
            start={
              <CountTabs
                label="Branch lists"
                items={TABS.map((item) => ({
                  ...item,
                  count: branches.data ? counts[item.value] : null,
                }))}
                value={tab}
                onChange={(value) => setParam({ tab: value === 'all' ? null : value })}
              />
            }
            search={
              <SearchField
                label="Search branches"
                placeholder="Quick search"
                value={searchText}
                onChange={setSearchText}
              />
            }
            primaryAction={
              canManage ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus aria-hidden="true" className="size-4" />}
                  onClick={() => setDialog({ type: 'form', branch: null })}
                >
                  Add branch
                </Button>
              ) : undefined
            }
          />
        }
        rowActions={
          canManage
            ? (branch) => (
                <RowActions label={`Actions for ${branch.name}`} items={actionsFor(branch)} />
              )
            : undefined
        }
        empty={
          filtered ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No branches match"
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
              icon={<Building2 className="size-6" />}
              title="No branches yet"
              description="Branches are the offices of the practice, for example London or Manchester. Add the ones the practice has, then choose one on each client."
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    onClick={() => setDialog({ type: 'form', branch: null })}
                  >
                    Add branch
                  </Button>
                ) : undefined
              }
            />
          )
        }
        footer={
          rows.length > 0 ? (
            <p className="border-t border-row-border px-4 py-3 text-sm text-text-muted">
              Showing {rows.length} of {all.length} {all.length === 1 ? 'branch' : 'branches'}
              {canManage ? null : '. Changing branches needs permission to manage settings.'}
            </p>
          ) : null
        }
      />
      <ConfirmDialog
        open={dialog?.type === 'delete' && target !== null}
        onClose={close}
        onConfirm={confirmDelete}
        title="Delete branch?"
        confirmLabel="Delete"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          <strong className="font-medium text-text">{target?.name}</strong> is removed completely
          when no client has it. If clients have it, it is deactivated instead, so what they show
          does not change.
        </p>
      </ConfirmDialog>
    </>
  );
}

/**
 * `/:orgSlug/settings/branches`: the branches (offices) clients belong to (ticket APT74). Any
 * member reads them; `settings.manage` adds, renames, deactivates and deletes; the "Use branches"
 * switch needs `organization.update`.
 */
export default function BranchesPage() {
  useDocumentTitle('Branches');
  return (
    <SettingsSection
      title="Branches"
      description="The offices of the practice, such as London or Manchester. Each client belongs to one branch."
    >
      <BranchesSwitch />
      <BranchList />
    </SettingsSection>
  );
}

/** "Use branches": on, every client needs a branch; off hides branches everywhere. */
function BranchesSwitch() {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const update = useUpdateOrganization(organization.id);
  const branches = useBranches();
  const enabled = organization.branches_enabled;
  // On, every new client needs a branch, so there must be an active one to give it.
  const noActiveBranch =
    !enabled && branches.data !== undefined && !branches.data.some((branch) => branch.is_active);
  return (
    <Card padding="sm">
      <Switch
        label="Use branches"
        description={`On, each client needs a branch: the client form asks for one, and the client list shows a Branch column and filter. Off hides branches everywhere. Nothing is deleted either way.${noActiveBranch ? ' Add an active branch before switching branches on.' : ''}`}
        checked={enabled}
        disabled={!can(PERMISSIONS.organizationUpdate) || update.isPending || noActiveBranch}
        onChange={(checked) =>
          update.mutate(
            { branches_enabled: checked },
            {
              onSuccess: () =>
                toast({
                  tone: 'success',
                  title: checked ? 'Branches switched on' : 'Branches hidden',
                }),
              onError: (error) =>
                toast({ tone: 'error', ...describeError(error, 'Could not change the setting') }),
            },
          )
        }
      />
    </Card>
  );
}
