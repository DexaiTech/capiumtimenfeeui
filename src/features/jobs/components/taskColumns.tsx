import { Link } from 'react-router';

import { Badge, type DataTableColumn, type DataTableSort } from '@/components/ui';
import { routes } from '@/constants/routes';
import { formatUkDate } from '@/utils/dates';

import { jobLocksTasks } from '../constants';
import type { TaskListItem, TaskSort, TaskStatus } from '../types';
import { assigneeNames, hoursOf, isAssignedTo } from '../utils/format';
import { TaskStatusPicker } from './StatusPickers';

const KEY_OF_COLUMN: Record<string, 'title' | 'job' | 'status' | 'due_date'> = {
  task: 'title',
  job: 'job',
  status: 'status',
  due: 'due_date',
};
const COLUMN_OF_KEY = { title: 'task', job: 'job', status: 'status', due_date: 'due' } as const;

/** The table's sort state for the API's `sort` (a leading `-` is descending). */
export function taskTableSort(sort: TaskSort): DataTableSort {
  const descending = sort.startsWith('-');
  const key = (descending ? sort.slice(1) : sort) as keyof typeof COLUMN_OF_KEY;
  return { columnId: COLUMN_OF_KEY[key], direction: descending ? 'desc' : 'asc' };
}

/** The API's sort for a header the person clicked; null for a column that does not sort. */
export function taskSortOfColumn(next: DataTableSort): TaskSort | null {
  const key = KEY_OF_COLUMN[next.columnId];
  return key ? `${next.direction === 'desc' ? '-' : ''}${key}` : null;
}

export interface TaskColumnsOptions {
  slug: string;
  /** Whether the caller may change the status of any task (`job.update`). */
  canEdit: boolean;
  /** The signed-in person, who may also change the status of the tasks assigned to them. */
  userId: string | undefined;
  onStatus: (task: TaskListItem, status: TaskStatus) => void;
}

/** The columns of a list of tasks across jobs (the Tasks and Assignments pages). */
export function taskColumns({
  slug,
  canEdit,
  userId,
  onStatus,
}: TaskColumnsOptions): DataTableColumn<TaskListItem>[] {
  return [
    {
      id: 'task',
      header: 'Task',
      hideable: false,
      sortable: true,
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
      id: 'job',
      header: 'Job',
      sortable: true,
      className: 'min-w-52 max-w-80',
      cell: (task) => (
        <Link
          to={routes.org.job(slug, task.job_id)}
          className="flex min-w-0 flex-col hover:text-brand-text"
          title={`${task.job_number} ${task.job_name}`}
        >
          <span className="truncate text-text">
            {task.job_number} {task.job_name}
          </span>
          <span className="truncate text-xs text-text-muted">{task.client_name}</span>
        </Link>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      className: 'w-40',
      cell: (task) => (
        <TaskStatusPicker
          status={task.status}
          label={`Change the status of ${task.title}`}
          canChange={(canEdit || isAssignedTo(task, userId)) && !jobLocksTasks(task.job_status)}
          onChoose={(status) => onStatus(task, status)}
        />
      ),
    },
    {
      id: 'assignees',
      header: 'Assigned to',
      className: 'min-w-40',
      cell: (task) => <span className="text-text">{assigneeNames(task.assignees)}</span>,
    },
    {
      id: 'due',
      header: 'Due',
      sortable: true,
      className: 'w-40 whitespace-nowrap',
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
}
