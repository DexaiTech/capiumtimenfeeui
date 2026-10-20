import { Pause, Pencil, Play, RotateCw, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { FormAlert } from '@/components/forms';
import {
  Badge,
  Button,
  ConfirmDialog,
  ErrorState,
  Modal,
  Pagination,
  Skeleton,
  useToast,
} from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { isApiError } from '@/services/api';
import { formatMoney } from '@/utils/money';

import {
  flattenPages,
  useDeleteSchedule,
  usePauseSchedule,
  useResumeSchedule,
  useRetryRun,
  useSchedule,
  useScheduleRuns,
  useVatOptions,
} from '../../api';
import { SCHEDULE_FREQUENCY_LABELS } from '../../constants';
import type { Schedule, ScheduleRun } from '../../types';
import { dialogError } from '../../utils/errors';
import { clientLabel, dateCell, vatLabel } from '../../utils/format';
import { formatQuantity, lineNet, parseQuantity } from '../../utils/lineMaths';
import { ScheduleStatusBadge } from '../badges';

export interface ScheduleDetailDialogProps {
  /** The schedule to show; null keeps the dialog closed. */
  scheduleId: string | null;
  onClose: () => void;
  /** Opens the form for a schedule that has not ended. */
  onEdit: (schedule: Schedule) => void;
}

type Refusal = { message: string; requestId?: string };

const quantityText = (quantity: string) => {
  const hundredths = parseQuantity(quantity);
  return hundredths === null ? quantity : formatQuantity(hundredths).replace(/\.00$/, '');
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{children}</dd>
    </div>
  );
}

function RunsTable({
  scheduleId,
  slug,
  canRetry,
}: {
  scheduleId: string;
  slug: string;
  canRetry: boolean;
}) {
  const { toast } = useToast();
  const { can } = useOrg();
  const runs = useScheduleRuns(scheduleId);
  const retry = useRetryRun();
  const [retrying, setRetrying] = useState<string | null>(null);
  const rows = flattenPages(runs.data);

  const retryRun = (run: ScheduleRun) => {
    setRetrying(run.id);
    retry.mutate(run.id, {
      onSuccess: (result) =>
        result.status === 'failed'
          ? toast({
              tone: 'warning',
              title: 'The run failed again',
              description: result.error ?? undefined,
            })
          : toast({
              tone: 'success',
              title: 'Invoice drafted',
              description: 'Review it and issue it from the invoice page.',
            }),
      onError: (error) => {
        const refusal = dialogError(error);
        toast({ tone: 'error', title: 'Could not retry the run', description: refusal.message });
      },
      onSettled: () => setRetrying(null),
    });
  };

  if (runs.isPending) return <Skeleton lines={3} />;
  if (runs.isError) {
    return (
      <ErrorState
        title="Could not load the runs"
        error={isApiError(runs.error) ? runs.error : null}
        onRetry={() => void runs.refetch()}
        retrying={runs.isRefetching}
      />
    );
  }
  if (rows.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        No run yet. The first invoice is drafted on the start date.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">Runs of the schedule</caption>
          <thead className="bg-surface-hover text-left text-xs text-text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Run date
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Result
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Invoice
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Attempts
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((run) => (
              <tr key={run.id} className="border-t border-row-border align-top">
                <td className="px-3 py-2 whitespace-nowrap">{dateCell(run.run_date)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    <Badge tone={run.status === 'failed' ? 'danger' : 'success'} size="sm" dot>
                      {run.status === 'failed' ? 'Failed' : 'Succeeded'}
                    </Badge>
                    {run.error ? <span className="text-xs text-danger">{run.error}</span> : null}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {run.invoice_id && can(P.invoiceRead) ? (
                    <Link
                      to={routes.org.invoice(slug, run.invoice_id)}
                      className="font-medium text-brand-text hover:underline"
                    >
                      {run.invoice_number ?? 'Draft invoice'}
                    </Link>
                  ) : run.invoice_id ? (
                    (run.invoice_number ?? 'Draft invoice')
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{run.attempts}</td>
                <td className="px-3 py-2 text-right">
                  {run.status === 'failed' && canRetry ? (
                    <Button
                      size="sm"
                      aria-label={`Retry the run of ${dateCell(run.run_date)}`}
                      leftIcon={<RotateCw aria-hidden="true" className="size-4" />}
                      loading={retrying === run.id}
                      disabled={retry.isPending}
                      onClick={() => retryRun(run)}
                    >
                      Retry
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        hasMore={runs.hasNextPage}
        onLoadMore={() => void runs.fetchNextPage()}
        loading={runs.isFetchingNextPage}
        count={rows.length}
        itemLabel={['run', 'runs']}
      />
    </div>
  );
}

/**
 * One schedule: its template lines, what it does and the runs so far. Pausing, resuming,
 * editing and deleting need `recurring.manage`; so does retrying a failed run. A schedule that
 * has run cannot be deleted: it is paused, or given an end date.
 */
export function ScheduleDetailDialog({ scheduleId, onClose, onEdit }: ScheduleDetailDialogProps) {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const query = useSchedule(scheduleId);
  const pause = usePauseSchedule();
  const resume = useResumeSchedule();
  const remove = useDeleteSchedule();
  const { options: vatOptions } = useVatOptions();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const schedule = query.data;
  const manage = can(P.recurringManage);
  const money = (pence: number) => formatMoney(pence, organization.currency);
  const busy = pause.isPending || resume.isPending || remove.isPending;

  const toggle = () => {
    if (!schedule) return;
    setRefusal(null);
    const active = schedule.status === 'active';
    (active ? pause : resume).mutate(schedule.id, {
      onSuccess: () =>
        toast({ tone: 'success', title: active ? 'Schedule paused' : 'Schedule resumed' }),
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  const closeDelete = () => {
    setRefusal(null);
    setConfirmDelete(false);
  };
  const doDelete = () => {
    if (!schedule) return;
    remove.mutate(schedule.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Schedule deleted' });
        closeDelete();
        onClose();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  return (
    <>
      <Modal
        open={scheduleId !== null && !confirmDelete}
        onClose={onClose}
        size="lg"
        title={schedule ? schedule.name : 'Recurring invoice'}
        description={schedule ? clientLabel(schedule.client) : undefined}
        footer={
          <>
            <Button onClick={onClose}>Close</Button>
            {schedule && manage ? (
              <>
                <Button
                  variant="danger"
                  leftIcon={<Trash2 aria-hidden="true" className="size-4" />}
                  disabled={busy}
                  onClick={() => {
                    setRefusal(null);
                    setConfirmDelete(true);
                  }}
                >
                  Delete
                </Button>
                {schedule.status !== 'ended' ? (
                  <Button
                    leftIcon={<Pencil aria-hidden="true" className="size-4" />}
                    disabled={busy}
                    onClick={() => onEdit(schedule)}
                  >
                    Edit
                  </Button>
                ) : null}
                {schedule.status === 'active' ? (
                  <Button
                    leftIcon={<Pause aria-hidden="true" className="size-4" />}
                    loading={pause.isPending}
                    disabled={busy}
                    onClick={toggle}
                  >
                    Pause
                  </Button>
                ) : null}
                {schedule.status === 'paused' ? (
                  <Button
                    variant="primary"
                    leftIcon={<Play aria-hidden="true" className="size-4" />}
                    loading={resume.isPending}
                    disabled={busy}
                    onClick={toggle}
                  >
                    Resume
                  </Button>
                ) : null}
              </>
            ) : null}
          </>
        }
      >
        {query.isPending ? (
          <div aria-busy="true" className="flex flex-col gap-3">
            <Skeleton lines={3} />
            <Skeleton shape="rect" className="h-24 w-full" />
          </div>
        ) : query.isError ? (
          <ErrorState
            title="Could not load the schedule"
            error={isApiError(query.error) ? query.error : null}
            onRetry={() => void query.refetch()}
            retrying={query.isRefetching}
          />
        ) : schedule ? (
          <div className="flex flex-col gap-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Fact label="Status">
                <ScheduleStatusBadge status={schedule.status} />
              </Fact>
              <Fact label="Frequency">{SCHEDULE_FREQUENCY_LABELS[schedule.frequency]}</Fact>
              <Fact label="Next run">{dateCell(schedule.next_run_date)}</Fact>
              <Fact label="Last run">{dateCell(schedule.last_run_on)}</Fact>
              <Fact label="Starts">{dateCell(schedule.start_date)}</Fact>
              <Fact label="Ends">{dateCell(schedule.end_date)}</Fact>
              <Fact label="Reference">{schedule.reference ?? '—'}</Fact>
              <Fact label="Net per invoice">{money(schedule.net_estimate)}</Fact>
            </dl>
            <p className="text-sm text-text-muted">
              A draft invoice is created on the start date and then each period. The schedule never
              issues an invoice: a person reviews and issues each draft from its invoice page.
              {schedule.status === 'ended'
                ? ' This schedule has ended and can no longer be changed.'
                : ''}
            </p>
            {schedule.notes ? (
              <div className="flex flex-col gap-1">
                <h3 className="text-xs text-text-muted">Notes</h3>
                <p className="text-sm whitespace-pre-line text-text">{schedule.notes}</p>
              </div>
            ) : null}
            {refusal && !confirmDelete ? (
              <FormAlert message={refusal.message} requestId={refusal.requestId} />
            ) : null}
            <section aria-labelledby="schedule-lines" className="flex flex-col gap-2">
              <h3 id="schedule-lines" className="text-sm font-semibold text-text">
                Template lines
              </h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[34rem] text-sm">
                  <caption className="sr-only">Template lines of the schedule</caption>
                  <thead className="bg-surface-hover text-left text-xs text-text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Description
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Quantity
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Unit price
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        VAT code
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Net
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.lines.map((line) => {
                      const quantity = parseQuantity(line.quantity);
                      const vat = vatOptions.find((option) => option.id === line.vat_rate_id);
                      return (
                        <tr key={line.id} className="border-t border-row-border tabular-nums">
                          <td className="px-3 py-2 font-sans">{line.description}</td>
                          <td className="px-3 py-2 text-right">{quantityText(line.quantity)}</td>
                          <td className="px-3 py-2 text-right">{money(line.unit_amount)}</td>
                          <td className="px-3 py-2 font-sans">{vat ? vatLabel(vat) : 'Default'}</td>
                          <td className="px-3 py-2 text-right">
                            {quantity === null ? '—' : money(lineNet(quantity, line.unit_amount))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
            <section aria-labelledby="schedule-runs" className="flex flex-col gap-2">
              <h3 id="schedule-runs" className="text-sm font-semibold text-text">
                Runs
              </h3>
              {schedule.failed_runs > 0 ? (
                <p className="text-sm text-text-muted">
                  A failed run drafted no invoice. Fix the cause shown, then retry it.
                </p>
              ) : null}
              <RunsTable scheduleId={schedule.id} slug={organization.slug} canRetry={manage} />
            </section>
          </div>
        ) : null}
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        onClose={closeDelete}
        onConfirm={doDelete}
        title="Delete schedule?"
        confirmLabel="Delete schedule"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          The schedule stops and its template is removed. A schedule that has already run cannot be
          deleted: pause it, or set an end date, instead.
        </p>
      </ConfirmDialog>
    </>
  );
}
