import { ListTodo, SearchX } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  ColumnVisibilityMenu,
  CountTabs,
  DataTable,
  DateRangeField,
  EmptyState,
  PageToolbar,
  Pagination,
  SearchField,
  Select,
  useToast,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/features/auth';
import { useOrg } from '@/features/organizations';
import { ClientPicker, JobPicker } from '@/features/team';
import { useDocumentTitle, useUrlParams } from '@/hooks';

import { flattenPages, useChangeTaskStatus, useMembers, useTaskList } from '../api';
import { FilterPopover } from '../components/FilterPopover';
import { TasksBulkBar } from '../components/TasksBulkBar';
import { LoadError, PageShell } from '../components/PageShell';
import { taskColumns, taskSortOfColumn, taskTableSort } from '../components/taskColumns';
import { TASK_STATUS_META } from '../constants';
import { useUrlSearch } from '../hooks/useUrlSearch';
import { TASK_SORTS, TASK_STATUSES, type TaskFilters, type TaskStatus } from '../types';
import { describeFailure } from '../utils/errors';

type Tab = 'all' | TaskStatus;

const TABS: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: 'all', label: 'All tasks' },
  ...TASK_STATUSES.map((status) => ({ value: status, label: TASK_STATUS_META[status].label })),
];

const isoDate = (value: string | null) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

/** `/:orgSlug/jobs/tasks`: the tasks of every job, with assignees and due dates. */
export default function TasksPage() {
  useDocumentTitle('Tasks');
  const { organization, can } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();
  const members = useMembers();
  const changeStatus = useChangeTaskStatus();

  const tabParam = params.get('status');
  const tab: Tab = TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const sort = TASK_SORTS.find((item) => item === params.get('sort')) ?? 'due_date';
  const assignee = params.get('assignee');
  const jobId = params.get('job_id');
  const clientId = params.get('client_id');
  const dueFrom = isoDate(params.get('due_from'));
  const dueTo = isoDate(params.get('due_to'));

  const filters: TaskFilters = {
    status: tab === 'all' ? undefined : [tab],
    assignee_user_id: assignee ?? undefined,
    job_id: jobId ?? undefined,
    client_id: clientId ?? undefined,
    due_from: dueFrom ?? undefined,
    due_to: dueTo ?? undefined,
    q: searched || undefined,
    sort,
  };
  const list = useTaskList(filters);

  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const rows = flattenPages(list.data);
  const canEdit = can(PERMISSIONS.jobUpdate);
  // Only tasks still in the list can be acted on: a ticked row a filter hid is left out.
  const pickedIds = rows.filter((task) => selected.has(task.id)).map((task) => task.id);
  const activeFilters =
    Number(assignee !== null) +
    Number(jobId !== null) +
    Number(clientId !== null) +
    Number(dueFrom !== null) +
    Number(dueTo !== null);
  const filtered = searched !== '' || tab !== 'all' || activeFilters > 0;

  const clearAll = () => {
    setSearchText('');
    setParam({
      q: null,
      status: null,
      assignee: null,
      job_id: null,
      client_id: null,
      due_from: null,
      due_to: null,
    });
  };

  const columns = taskColumns({
    slug: organization.slug,
    canEdit: can(PERMISSIONS.jobUpdate),
    userId: user?.id,
    onStatus: (task, status) =>
      changeStatus.mutate(
        { jobId: task.job_id, taskId: task.id, status },
        {
          onSuccess: () =>
            toast({ tone: 'success', title: 'Status changed', description: task.title }),
          onError: (error) =>
            toast({ tone: 'error', ...describeFailure(error, 'Could not change the status') }),
        },
      ),
  });

  const assigneeOptions = [
    { value: '', label: 'Anyone' },
    { value: 'me', label: 'Me' },
    ...(members.data ?? []).map((member) => ({ value: member.user_id, label: member.full_name })),
  ];

  return (
    <PageShell
      title="Tasks"
      description="The tasks of every job, with the people they are assigned to and when they are due."
    >
      {list.isError && !list.data ? (
        <LoadError
          title="Could not load the tasks"
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : (
        <>
          {pickedIds.length > 0 && canEdit ? (
            <TasksBulkBar
              ids={pickedIds}
              canEdit={canEdit}
              canChangeStatus={canEdit}
              onClear={() => setSelected(new Set())}
            />
          ) : null}
          <DataTable
            caption="Tasks"
            columns={columns}
            rows={rows}
            rowKey={(task) => task.id}
            selectable={canEdit}
            selectLabel={(task) => `Select ${task.title}`}
            selected={selected}
            onSelectedChange={setSelected}
            sort={taskTableSort(sort)}
            onSortChange={(next) => {
              const key = taskSortOfColumn(next);
              if (key) setParam({ sort: key });
            }}
            hiddenColumns={hidden}
            loading={list.isPending}
            toolbar={
              <PageToolbar
                start={
                  <CountTabs
                    label="Task status"
                    items={TABS.map((item) => ({ value: item.value, label: item.label }))}
                    value={tab}
                    onChange={(value) => setParam({ status: value === 'all' ? null : value })}
                  />
                }
                search={
                  <SearchField
                    label="Search tasks"
                    placeholder="Task, job or client"
                    value={searchText}
                    onChange={setSearchText}
                  />
                }
                actions={
                  <>
                    <FilterPopover
                      title="Filter tasks"
                      count={activeFilters}
                      onClear={() =>
                        setParam({
                          assignee: null,
                          job_id: null,
                          client_id: null,
                          due_from: null,
                          due_to: null,
                        })
                      }
                    >
                      <Select
                        label="Assigned to"
                        options={assigneeOptions}
                        value={assignee ?? ''}
                        onChange={(event) => setParam({ assignee: event.target.value || null })}
                      />
                      <JobPicker
                        label="Job"
                        clearable
                        value={jobId}
                        onChange={(job) => setParam({ job_id: job?.id ?? null })}
                      />
                      {can(PERMISSIONS.clientRead) ? (
                        <ClientPicker
                          label="Client"
                          clearable
                          value={clientId}
                          onChange={(id) => setParam({ client_id: id })}
                        />
                      ) : null}
                      <DateRangeField
                        label="Due date"
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
              />
            }
            empty={
              filtered ? (
                <EmptyState
                  icon={<SearchX className="size-6" />}
                  title="No tasks match"
                  description="Try a different search, status, person or dates."
                  action={<Button onClick={clearAll}>Clear filters</Button>}
                />
              ) : (
                <EmptyState
                  icon={<ListTodo className="size-6" />}
                  title="No tasks yet"
                  description="Tasks are added to a job, from the page of the job."
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
                    itemLabel={['task', 'tasks']}
                  />
                </div>
              ) : undefined
            }
          />
        </>
      )}
    </PageShell>
  );
}
