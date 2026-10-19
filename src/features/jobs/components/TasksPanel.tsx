import { Ellipsis, ListTodo, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Dropdown,
  EmptyState,
  useToast,
  type DataTableColumn,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/features/auth';
import { useOrg } from '@/features/organizations';
import { formatUkDate } from '@/utils/dates';

import { useChangeTaskStatus, useDeleteTask, useJobTasks, useSetTaskAssignees } from '../api';
import { MAX_TASKS_PER_JOB, jobLocksTasks } from '../constants';
import type { Job, Task } from '../types';
import { describeFailure, dialogError } from '../utils/errors';
import { hoursOf, isAssignedTo } from '../utils/format';
import { AssigneePicker } from './AssigneePicker';
import { LoadError } from './PageShell';
import { TaskStatusPicker } from './StatusPickers';
import { TaskFormDialog } from './TaskFormDialog';

/** The tasks of a job: their status, who they are assigned to, when they are due, and the hours. */
export function TasksPanel({ job }: { job: Job }) {
  const { can } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const tasks = useJobTasks(job.id);
  const changeStatus = useChangeTaskStatus();
  const setAssignees = useSetTaskAssignees();
  const remove = useDeleteTask();

  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);

  const locked = jobLocksTasks(job.status);
  const canEdit = can(PERMISSIONS.jobUpdate) && !locked;
  // The assignees of a task may also change its status, with `job.read` alone.
  const canChangeStatus = (task: Task) =>
    (can(PERMISSIONS.jobUpdate) || isAssignedTo(task, user?.id)) && !locked;
  const rows = tasks.data ?? [];
  const completed = rows.filter((task) => task.status === 'completed').length;
  const full = rows.length >= MAX_TASKS_PER_JOB;

  const refuse = (error: unknown, title: string) =>
    toast({ tone: 'error', ...describeFailure(error, title) });

  const actionsFor = (task: Task): DropdownItem[] => [
    {
      id: 'edit',
      label: 'Edit',
      icon: <Pencil aria-hidden="true" className="size-4" />,
      onSelect: () => setEditing(task),
    },
    { id: 'separator', separator: true },
    {
      id: 'delete',
      label: 'Delete',
      tone: 'danger',
      icon: <Trash2 aria-hidden="true" className="size-4" />,
      onSelect: () => {
        setRefusal(null);
        setDeleting(task);
      },
    },
  ];

  const columns: DataTableColumn<Task>[] = [
    {
      id: 'title',
      header: 'Task',
      hideable: false,
      className: 'min-w-56 max-w-96',
      cell: (task) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-text" title={task.title}>
            {task.title}
          </span>
          {task.description ? (
            <span className="truncate text-xs text-text-muted" title={task.description}>
              {task.description}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      className: 'w-40',
      cell: (task) => (
        <TaskStatusPicker
          status={task.status}
          label={`Change the status of ${task.title}`}
          canChange={canChangeStatus(task)}
          onChoose={(status) =>
            changeStatus.mutate(
              { jobId: job.id, taskId: task.id, status },
              { onError: (error) => refuse(error, 'Could not change the status') },
            )
          }
        />
      ),
    },
    {
      id: 'assignees',
      header: 'Assigned to',
      className: 'min-w-44',
      cell: (task) => (
        <AssigneePicker
          label={`Assignees of ${task.title}`}
          value={task.assignees.map((assignee) => assignee.user_id)}
          knownNames={new Map(task.assignees.map((a) => [a.user_id, a.full_name]))}
          disabled={!canEdit}
          onChange={(userIds) =>
            setAssignees.mutate(
              { jobId: job.id, taskId: task.id, userIds },
              { onError: (error) => refuse(error, 'Could not change the assignees') },
            )
          }
        />
      ),
    },
    {
      id: 'due',
      header: 'Due',
      className: 'w-36 whitespace-nowrap',
      cell: (task) =>
        task.due_date ? (
          <span className="inline-flex items-center gap-2 text-text">
            {formatUkDate(task.due_date)}
            {task.is_overdue ? (
              <Badge tone="red" size="sm">
                Overdue
              </Badge>
            ) : null}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'hours',
      header: 'Hours',
      align: 'end',
      className: 'w-36 whitespace-nowrap',
      cell: (task) => (
        <span className="text-text tabular-nums">
          {hoursOf(task.logged_minutes, task.budget_minutes)}
        </span>
      ),
    },
  ];

  const confirmDelete = () => {
    if (!deleting) return;
    const task = deleting;
    remove.mutate(
      { jobId: job.id, taskId: task.id },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: 'Task deleted', description: task.title });
          setDeleting(null);
        },
        onError: (error) => setRefusal(dialogError(error)),
      },
    );
  };

  if (tasks.isError && !tasks.data) {
    return (
      <LoadError
        title="Could not load the tasks"
        error={tasks.error}
        onRetry={() => void tasks.refetch()}
        retrying={tasks.isRefetching}
      />
    );
  }

  return (
    <>
      <DataTable
        caption={`Tasks of ${job.number}`}
        columns={columns}
        rows={rows}
        rowKey={(task) => task.id}
        loading={tasks.isPending}
        skeletonRows={3}
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-row-border px-4 py-3">
            <div className="flex min-w-0 flex-col">
              <h2 className="text-sm font-semibold text-text">Tasks</h2>
              <p className="text-xs text-text-muted">
                {rows.length === 0
                  ? 'The work inside this job.'
                  : `${String(completed)} of ${String(rows.length)} completed`}
                {locked ? ' Tasks cannot be changed while the job is closed or cancelled.' : ''}
              </p>
            </div>
            {canEdit ? (
              <Button
                size="sm"
                variant="primary"
                disabled={full}
                leftIcon={<Plus aria-hidden="true" className="size-4" />}
                onClick={() => setEditing('new')}
              >
                Add task
              </Button>
            ) : null}
          </div>
        }
        rowActions={
          canEdit
            ? (task) => (
                <Dropdown
                  label={`Actions for ${task.title}`}
                  items={actionsFor(task)}
                  trigger={<Ellipsis aria-hidden="true" className="size-5 text-text-muted" />}
                />
              )
            : undefined
        }
        empty={
          <EmptyState
            icon={<ListTodo className="size-6" />}
            title="No tasks yet"
            description={
              canEdit
                ? 'Break the job into tasks, give each a due date and assign it to the people doing it.'
                : 'Nothing has been planned for this job.'
            }
            action={
              canEdit ? (
                <Button variant="primary" onClick={() => setEditing('new')}>
                  Add task
                </Button>
              ) : undefined
            }
          />
        }
      />
      <TaskFormDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        job={job}
        task={editing === 'new' ? null : editing}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete this task?"
        confirmLabel="Delete task"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          {deleting?.title ?? ''} will be removed from the job. A task with time logged against it
          cannot be deleted: mark it completed instead.
        </p>
      </ConfirmDialog>
    </>
  );
}
