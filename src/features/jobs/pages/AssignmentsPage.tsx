import { Briefcase, ListTodo } from 'lucide-react';

import { Card, DataTable, EmptyState, Select, useToast } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/features/auth';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, useUrlParams } from '@/hooks';
import { addDays, todayInZone } from '@/utils/dates';

import {
  flattenPages,
  useChangeTaskStatus,
  useJobList,
  useMemberNames,
  useMembers,
  useTaskList,
} from '../api';
import { jobColumns } from '../components/jobColumns';
import { LoadError, PageShell } from '../components/PageShell';
import { taskColumns } from '../components/taskColumns';
import { OPEN_JOB_STATUSES } from '../constants';
import type { JobFilters, TaskFilters } from '../types';
import { describeFailure } from '../utils/errors';

const OPEN_TASKS = ['not_started', 'in_progress', 'on_hold'] as const;

/** A count that may be a lower bound: the lists are read a page at a time. */
const count = (rows: number, more: boolean) => (more ? `${String(rows)}+` : String(rows));

/** `/:orgSlug/jobs/assignments`: who is assigned to what, and how much is on their plate. */
export default function AssignmentsPage() {
  useDocumentTitle('Assignments');
  const { organization, can } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const members = useMembers();
  const nameOf = useMemberNames();
  const changeStatus = useChangeTaskStatus();

  const person = params.get('person') ?? 'me';
  const today = todayInZone(organization.timezone);
  const weekAhead = addDays(today, 7);

  const jobFilters: JobFilters = {
    assignee: person,
    status: [...OPEN_JOB_STATUSES],
    sort: 'due_date',
  };
  const taskFilters: TaskFilters = {
    assignee_user_id: person,
    status: [...OPEN_TASKS],
    sort: 'due_date',
  };
  const jobs = useJobList(jobFilters);
  const tasks = useTaskList(taskFilters);
  const jobRows = flattenPages(jobs.data);
  const taskRows = flattenPages(tasks.data);

  const overdue = taskRows.filter((task) => task.is_overdue).length;
  const dueSoon = taskRows.filter(
    (task) => task.due_date !== null && task.due_date >= today && task.due_date <= weekAhead,
  ).length;
  const more = jobs.hasNextPage || tasks.hasNextPage;

  const personOptions = [
    { value: 'me', label: 'Me' },
    ...(members.data ?? []).map((member) => ({ value: member.user_id, label: member.full_name })),
  ];

  const jobCols = jobColumns({
    slug: organization.slug,
    currency: organization.currency,
    today,
    managerName: nameOf,
  }).filter((column) => ['job', 'client', 'status', 'due', 'budget'].includes(column.id));
  const taskCols = taskColumns({
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
  }).filter((column) => column.id !== 'assignees');

  const stats = [
    { label: 'Open jobs', value: count(jobRows.length, jobs.hasNextPage) },
    { label: 'Open tasks', value: count(taskRows.length, tasks.hasNextPage) },
    { label: 'Overdue tasks', value: count(overdue, tasks.hasNextPage) },
    { label: 'Due in the next 7 days', value: count(dueSoon, tasks.hasNextPage) },
  ];

  return (
    <PageShell
      title="Assignments"
      description="The open jobs and tasks a person is assigned to, and how much is on their plate."
      actions={
        <Select
          label="Person"
          hideLabel
          options={personOptions}
          value={person}
          onChange={(event) =>
            setParam({ person: event.target.value === 'me' ? null : event.target.value })
          }
        />
      }
    >
      <dl aria-label="Workload" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} padding="sm" className="flex flex-col gap-1">
            <dt className="text-xs text-text-muted">{stat.label}</dt>
            <dd className="text-xl font-semibold text-text tabular-nums">{stat.value}</dd>
          </Card>
        ))}
      </dl>
      {more ? (
        <p className="text-xs text-text-muted">
          A figure with a + is counted from the first rows only: the lists below load the rest.
        </p>
      ) : null}

      {jobs.isError && !jobs.data ? (
        <LoadError
          title="Could not load the jobs"
          error={jobs.error}
          onRetry={() => void jobs.refetch()}
          retrying={jobs.isRefetching}
        />
      ) : (
        <DataTable
          caption="Assigned jobs"
          columns={jobCols}
          rows={jobRows}
          rowKey={(job) => job.id}
          loading={jobs.isPending}
          skeletonRows={3}
          toolbar={
            <div className="border-b border-row-border px-4 py-3">
              <h2 className="text-sm font-semibold text-text">Jobs</h2>
            </div>
          }
          empty={
            <EmptyState
              icon={<Briefcase className="size-6" />}
              title="No open jobs"
              description="Nothing open is assigned to this person."
            />
          }
        />
      )}

      {tasks.isError && !tasks.data ? (
        <LoadError
          title="Could not load the tasks"
          error={tasks.error}
          onRetry={() => void tasks.refetch()}
          retrying={tasks.isRefetching}
        />
      ) : (
        <DataTable
          caption="Assigned tasks"
          columns={taskCols}
          rows={taskRows}
          rowKey={(task) => task.id}
          loading={tasks.isPending}
          skeletonRows={3}
          toolbar={
            <div className="border-b border-row-border px-4 py-3">
              <h2 className="text-sm font-semibold text-text">Tasks</h2>
            </div>
          }
          empty={
            <EmptyState
              icon={<ListTodo className="size-6" />}
              title="No open tasks"
              description="Nothing open is assigned to this person."
            />
          }
        />
      )}
    </PageShell>
  );
}
