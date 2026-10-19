import { Gauge } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Skeleton,
  Table,
  useToast,
  type TableColumn,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import { useEvaluateBudget, useJobBudget } from '../api';
import { TASK_STATUS_META } from '../constants';
import type { BudgetPersonRow, BudgetTaskRow, Job, TaskStatus } from '../types';
import { describeFailure } from '../utils/errors';
import { LoadError } from './PageShell';
import { RagBadge, UsageBar } from './StatusBadges';

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm font-semibold text-text tabular-nums">{value}</dd>
      {hint ? <p className="text-2xs text-text-subtle">{hint}</p> : null}
    </div>
  );
}

/** "2:00 left" or "1:30 over". */
function leftOrOver(remaining: number, format: (value: number) => string): string {
  return remaining < 0 ? `${format(-remaining)} over` : `${format(remaining)} left`;
}

const statusLabel = (status: string | null) =>
  status && status in TASK_STATUS_META ? TASK_STATUS_META[status as TaskStatus].label : '—';

/** A job's budget against actual: hours and fee, the alerts it has raised, and where time went. */
export function BudgetPanel({ job }: { job: Job }) {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const budget = useJobBudget(job.id);
  const evaluate = useEvaluateBudget();
  const money = (pence: number) => formatMoney(pence, organization.currency);

  if (budget.isError && !budget.data) {
    return (
      <LoadError
        title="Could not load the budget"
        error={budget.error}
        onRetry={() => void budget.refetch()}
        retrying={budget.isRefetching}
      />
    );
  }
  if (!budget.data) {
    return (
      <Card>
        <Skeleton lines={4} />
      </Card>
    );
  }
  const data = budget.data;
  const hasBudget = data.budget_minutes !== null || data.budget_fee !== null;

  const taskColumns: TableColumn<BudgetTaskRow>[] = [
    {
      id: 'task',
      header: 'Task',
      card: 'title',
      cell: (row) => row.title ?? <span className="text-text-muted">No task</span>,
    },
    { id: 'status', header: 'Status', cell: (row) => statusLabel(row.status) },
    {
      id: 'hours',
      header: 'Hours',
      align: 'end',
      cell: (row) => <span className="tabular-nums">{formatMinutes(row.minutes)}</span>,
    },
    {
      id: 'budget',
      header: 'Budget',
      align: 'end',
      cell: (row) => (
        <span className="tabular-nums">
          {row.budget_minutes === null ? '—' : formatMinutes(row.budget_minutes)}
        </span>
      ),
    },
    {
      id: 'used',
      header: 'Used',
      cell: (row) => (
        <UsageBar label={`Hours budget of ${row.title ?? 'no task'}`} usageBp={row.used_bp} />
      ),
    },
    {
      id: 'value',
      header: 'Value',
      align: 'end',
      cell: (row) => <span className="tabular-nums">{money(row.value)}</span>,
    },
  ];

  const personColumns: TableColumn<BudgetPersonRow>[] = [
    { id: 'person', header: 'Person', card: 'title', cell: (row) => row.full_name },
    {
      id: 'hours',
      header: 'Hours',
      align: 'end',
      cell: (row) => <span className="tabular-nums">{formatMinutes(row.minutes)}</span>,
    },
    {
      id: 'billable',
      header: 'Billable',
      align: 'end',
      cell: (row) => <span className="tabular-nums">{formatMinutes(row.billable_minutes)}</span>,
    },
    {
      id: 'value',
      header: 'Value',
      align: 'end',
      cell: (row) => <span className="tabular-nums">{money(row.value)}</span>,
    },
  ];

  return (
    <Card padding="none">
      <CardHeader
        title="Budget"
        description="Hours and fee against what was budgeted, and where the time went."
        actions={
          <>
            {data.rag ? <RagBadge rag={data.rag} /> : null}
            {can(PERMISSIONS.jobUpdate) ? (
              <Button
                size="sm"
                loading={evaluate.isPending}
                onClick={() =>
                  evaluate.mutate(job.id, {
                    onSuccess: (result) =>
                      toast({
                        tone: 'success',
                        title: 'Budget evaluated',
                        description:
                          result.triggered.length > 0
                            ? `${String(result.triggered.length)} new alert raised.`
                            : 'No new alerts.',
                      }),
                    onError: (error) =>
                      toast({ tone: 'error', ...describeFailure(error, 'Could not evaluate') }),
                  })
                }
              >
                Re-evaluate alerts
              </Button>
            ) : null}
          </>
        }
      />
      {hasBudget ? (
        <div className="flex flex-col gap-4 border-b border-row-border px-5 py-4">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure label="Hours logged" value={formatMinutes(data.logged_minutes)} />
            <Figure
              label="Hours budget"
              value={data.budget_minutes === null ? 'None' : formatMinutes(data.budget_minutes)}
              hint={
                data.remaining_minutes === null
                  ? undefined
                  : leftOrOver(data.remaining_minutes, formatMinutes)
              }
            />
            <Figure label="Time value" value={money(data.time_value)} />
            <Figure
              label="Fee budget"
              value={data.budget_fee === null ? 'None' : money(data.budget_fee)}
              hint={data.remaining_fee === null ? undefined : leftOrOver(data.remaining_fee, money)}
            />
            {data.cost_value !== null ? (
              <>
                <Figure label="Cost" value={money(data.cost_value)} />
                <Figure
                  label="Margin"
                  value={data.margin_value === null ? '—' : money(data.margin_value)}
                  hint={data.margin_bp === null ? undefined : formatBasisPoints(data.margin_bp)}
                />
              </>
            ) : null}
          </dl>
          {data.alerts.length > 0 ? (
            <ul aria-label="Budget alerts" className="flex flex-col gap-1.5">
              {data.alerts.map((alert) => (
                <li
                  key={`${alert.kind}-${String(alert.threshold)}`}
                  className="flex flex-wrap items-center gap-2 text-sm text-text"
                >
                  <Badge tone={alert.threshold >= 100 ? 'red' : 'amber'} size="sm">
                    {String(alert.threshold)}%
                  </Badge>
                  <span>
                    {alert.kind === 'minutes' ? 'Hours budget' : 'Fee budget'} reached on{' '}
                    {formatUkDate(alert.triggered_at)} ({formatBasisPoints(alert.usage_bp)})
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <EmptyState
          icon={<Gauge className="size-6" />}
          title="No budget set"
          description="Set an hours or a fee budget on the job to be warned at 80% and 100%."
        />
      )}
      {data.by_task.length > 0 ? (
        <Table
          caption={`Time by task on ${job.number}`}
          columns={taskColumns}
          rows={data.by_task}
          rowKey={(row) => row.task_id ?? 'no-task'}
        />
      ) : null}
      {data.by_person.length > 0 ? (
        <Table
          caption={`Time by person on ${job.number}`}
          columns={personColumns}
          rows={data.by_person}
          rowKey={(row) => row.user_id}
        />
      ) : null}
    </Card>
  );
}
