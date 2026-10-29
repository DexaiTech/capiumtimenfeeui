import { Briefcase, Copy, ExternalLink, Pencil, Plus, SearchX, Trash2 } from 'lucide-react';
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
  SearchField,
  Select,
  useToast,
  type DropdownItem,
  RowActions,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { ClientPicker } from '@/features/team';
import { useDocumentTitle, usePersistentColumns, useUrlParams } from '@/hooks';
import { todayInZone } from '@/utils/dates';

import { flattenPages, useDeleteJob, useJobList, useMemberNames, useMembers } from '../api';
import { CopyJobDialog } from '../components/CopyJobDialog';
import { FilterPopover } from '../components/FilterPopover';
import { JobFormPanel } from '../components/JobFormPanel';
import { JobsBulkBar } from '../components/JobsBulkBar';
import { jobColumns, sortOfColumn, tableSort } from '../components/jobColumns';
import { LoadError, PageShell } from '../components/PageShell';
import { JOB_STATUS_META } from '../constants';
import { useUrlSearch } from '../hooks/useUrlSearch';
import { JOB_SORTS, JOB_STATUSES, type Job, type JobFilters, type JobStatus } from '../types';
import { dialogError } from '../utils/errors';
import { jobLabel } from '../utils/format';

type Tab = 'all' | JobStatus;

const TABS: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: 'all', label: 'All jobs' },
  ...JOB_STATUSES.map((status) => ({ value: status, label: JOB_STATUS_META[status].label })),
];

const isoDate = (value: string | null) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

/** `/:orgSlug/jobs`: every live job of the practice, and where a new one starts. */
export default function JobsPage() {
  useDocumentTitle('Job List');
  const { organization, can } = useOrg();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();
  const members = useMembers();
  const nameOf = useMemberNames();

  const canCreate = can(PERMISSIONS.jobCreate);
  const canUpdate = can(PERMISSIONS.jobUpdate);
  const canDelete = can(PERMISSIONS.jobDelete);
  const tabParam = params.get('status');
  const tab: Tab = TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const sort = JOB_SORTS.find((item) => item === params.get('sort')) ?? '-created_at';
  const clientId = params.get('client_id');
  const manager = params.get('manager');
  const dueFrom = isoDate(params.get('due_from'));
  const dueTo = isoDate(params.get('due_to'));

  const filters: JobFilters = {
    status: tab === 'all' ? undefined : [tab],
    client_id: clientId ?? undefined,
    manager_user_id: manager ?? undefined,
    due_from: dueFrom ?? undefined,
    due_to: dueTo ?? undefined,
    q: searched || undefined,
    sort,
  };
  const list = useJobList(filters);
  const remove = useDeleteJob();

  const [hidden, setHidden] = usePersistentColumns('jobs', ['service', 'created']);
  const [creating, setCreating] = useState(() => canCreate && params.get('new') === '1');
  const [editing, setEditing] = useState<Job | null>(null);
  const [copying, setCopying] = useState<Job | null>(null);
  const [deleting, setDeleting] = useState<Job | null>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);

  const rows = useMemo(() => flattenPages(list.data), [list.data]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  // A bulk action only reaches the jobs on screen: a ticked row that is no longer listed
  // (another filter or search, a refresh) is left out.
  const picked = useMemo(
    () => rows.filter((row) => selected.has(row.id)).map((row) => row.id),
    [rows, selected],
  );
  const selectable = canUpdate || canDelete;
  const activeFilters =
    Number(clientId !== null) +
    Number(manager !== null) +
    Number(dueFrom !== null) +
    Number(dueTo !== null);
  const filtered = searched !== '' || tab !== 'all' || activeFilters > 0;

  const closeCreate = () => {
    setCreating(false);
    if (params.has('new')) setParam({ new: null });
  };
  const clearAll = () => {
    setSearchText('');
    setParam({
      q: null,
      status: null,
      client_id: null,
      manager: null,
      due_from: null,
      due_to: null,
    });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const job = deleting;
    remove.mutate(job.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Job deleted', description: jobLabel(job) });
        setDeleting(null);
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  const actionsFor = (job: Job): DropdownItem[] => {
    const items: DropdownItem[] = [
      {
        id: 'open',
        label: 'Open',
        icon: <ExternalLink aria-hidden="true" className="size-4" />,
        onSelect: () => void navigate(routes.org.job(organization.slug, job.id)),
      },
    ];
    if (canUpdate) {
      items.push({
        id: 'edit',
        label: 'Edit',
        icon: <Pencil aria-hidden="true" className="size-4" />,
        onSelect: () => setEditing(job),
      });
    }
    if (canCreate) {
      items.push({
        id: 'copy',
        label: 'Copy',
        icon: <Copy aria-hidden="true" className="size-4" />,
        onSelect: () => setCopying(job),
      });
    }
    if (canDelete) {
      items.push(
        { id: 'separator', separator: true },
        {
          id: 'delete',
          label: 'Delete',
          tone: 'danger',
          icon: <Trash2 aria-hidden="true" className="size-4" />,
          onSelect: () => {
            setRefusal(null);
            setDeleting(job);
          },
        },
      );
    }
    return items;
  };

  const columns = jobColumns({
    slug: organization.slug,
    currency: organization.currency,
    today: todayInZone(organization.timezone),
    managerName: nameOf,
  });

  const managerOptions = [
    { value: '', label: 'Anyone' },
    { value: 'me', label: 'Me' },
    ...(members.data ?? []).map((member) => ({ value: member.user_id, label: member.full_name })),
  ];

  const newJobButton = canCreate ? (
    <Button
      variant="primary"
      size="sm"
      leftIcon={<Plus aria-hidden="true" className="size-4" />}
      onClick={() => setCreating(true)}
    >
      New job
    </Button>
  ) : undefined;

  return (
    <PageShell
      title="Job List"
      description="The work of the practice: each job belongs to a client, with its tasks, budget and the people on it."
    >
      <JobFormPanel
        open={creating}
        onClose={closeCreate}
        job={null}
        clientId={clientId ?? undefined}
        onSaved={(job) => {
          closeCreate();
          void navigate(routes.org.job(organization.slug, job.id));
        }}
      />
      {editing ? (
        <JobFormPanel
          open
          onClose={() => setEditing(null)}
          job={editing}
          onSaved={() => setEditing(null)}
        />
      ) : null}
      {list.isError && !list.data ? (
        <LoadError
          title="Could not load the jobs"
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : (
        <DataTable
          caption="Jobs"
          onRowClick={(job) => void navigate(routes.org.job(organization.slug, job.id))}
          columns={columns}
          rows={rows}
          rowKey={(job) => job.id}
          sort={tableSort(sort)}
          onSortChange={(next) => {
            const key = sortOfColumn(next);
            if (key) setParam({ sort: key });
          }}
          hiddenColumns={hidden}
          loading={list.isPending}
          selectable={selectable}
          selected={selected}
          onSelectedChange={setSelected}
          selectLabel={(job) => `Select ${jobLabel(job)}`}
          toolbar={
            <>
              <PageToolbar
                start={
                  <CountTabs
                    label="Job status"
                    items={TABS.map((item) => ({ value: item.value, label: item.label }))}
                    value={tab}
                    onChange={(value) => setParam({ status: value === 'all' ? null : value })}
                  />
                }
                search={
                  <SearchField
                    label="Search jobs"
                    placeholder="Name, number or client"
                    value={searchText}
                    onChange={setSearchText}
                  />
                }
                actions={
                  <>
                    <Button
                      size="sm"
                      variant={manager === 'me' ? 'primary' : 'secondary'}
                      aria-pressed={manager === 'me'}
                      onClick={() => setParam({ manager: manager === 'me' ? null : 'me' })}
                    >
                      My jobs
                    </Button>
                    <FilterPopover
                      title="Filter jobs"
                      count={activeFilters}
                      onClear={() =>
                        setParam({ client_id: null, manager: null, due_from: null, due_to: null })
                      }
                    >
                      {can(PERMISSIONS.clientRead) ? (
                        <ClientPicker
                          label="Client"
                          clearable
                          value={clientId}
                          onChange={(id) => setParam({ client_id: id })}
                        />
                      ) : null}
                      <Select
                        label="Manager"
                        options={managerOptions}
                        value={manager ?? ''}
                        onChange={(event) => setParam({ manager: event.target.value || null })}
                      />
                      <DateRangeField
                        label="Due date"
                        endsToday={false}
                        value={{ from: dueFrom, to: dueTo }}
                        onChange={(range) => setParam({ due_from: range.from, due_to: range.to })}
                      />
                    </FilterPopover>
                    <ColumnVisibilityMenu
                      columns={columns.map((column) => ({
                        id: column.id,
                        label: column.header,
                        locked: column.hideable === false,
                      }))}
                      hidden={hidden}
                      onChange={setHidden}
                    />
                  </>
                }
                primaryAction={newJobButton}
              />
              {picked.length > 0 ? (
                <div className="border-b border-row-border px-4 py-2">
                  <JobsBulkBar
                    ids={picked}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                    onClear={() => setSelected(new Set())}
                  />
                </div>
              ) : null}
            </>
          }
          rowActions={(job) => (
            <RowActions label={`Actions for ${jobLabel(job)}`} items={actionsFor(job)} />
          )}
          empty={
            filtered ? (
              <EmptyState
                icon={<SearchX className="size-6" />}
                title="No jobs match"
                description="Try a different search, status, client or dates."
                action={<Button onClick={clearAll}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={<Briefcase className="size-6" />}
                title="No jobs yet"
                description="A job is a piece of work for a client: time is recorded against it and it is billed from there."
                action={
                  canCreate ? (
                    <Button variant="primary" onClick={() => setCreating(true)}>
                      New job
                    </Button>
                  ) : undefined
                }
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
                  itemLabel={['job', 'jobs']}
                />
              </div>
            ) : undefined
          }
        />
      )}

      {copying ? (
        <CopyJobDialog
          open
          onClose={() => setCopying(null)}
          job={copying}
          onCopied={(job) => {
            setCopying(null);
            void navigate(routes.org.job(organization.slug, job.id));
          }}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete this job?"
        confirmLabel="Delete job"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          {deleting ? jobLabel(deleting) : ''} and its tasks will be removed. A job with time,
          expenses or invoices against it cannot be deleted: complete or cancel it instead.
        </p>
      </ConfirmDialog>
    </PageShell>
  );
}
