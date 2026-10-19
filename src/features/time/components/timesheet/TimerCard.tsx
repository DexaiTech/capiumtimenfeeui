import { Pause, Play, Square, Timer as TimerIcon, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { FormAlert } from '@/components/forms';
import {
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { ClientPicker, JobPicker, useActivityTypes, useServices } from '@/features/team';
import { formatUkDate } from '@/utils/dates';
import { formatMinutes, roundUpToIncrement } from '@/utils/minutes';

import { useClientRef, useJobRefs, useTimer, useTimerActions } from '../../api';
import type { Timer } from '../../types';
import { activityOptions } from '../../utils/activities';
import { describeFailure, dialogError } from '../../utils/errors';
import { formatClock, refLabel } from '../../utils/format';
import { DialogActions } from '../DialogActions';

/** What the job picker hands over (the shape of `GET /jobs`). */
interface PickedJob {
  id: string;
  number: string;
  name: string;
  client_id: string;
  client_code: string;
  client_name: string;
  service_id: string | null;
  service_name: string | null;
}

type Refusal = { message: string; requestId?: string };

/** Counts the seconds of a running timer from the value the API last reported. */
function ElapsedClock({ base, running }: { base: number; running: boolean }) {
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTicks((current) => current + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  return (
    <span role="timer" aria-label="Elapsed time" className="tabular-nums">
      {formatClock(base + ticks)}
    </span>
  );
}

function StartTimerForm({ onClose }: { onClose: () => void }) {
  const { can } = useOrg();
  const { start } = useTimerActions();
  const { toast } = useToast();
  const formId = useId();
  const [client, setClient] = useState<{ id: string; label: string } | null>(null);
  const [job, setJob] = useState<PickedJob | null>(null);
  const [activityId, setActivityId] = useState('');
  const [description, setDescription] = useState('');
  const [billableChoice, setBillableChoice] = useState<boolean | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  const activities = useActivityTypes();
  const services = useServices();
  const jobRefs = useJobRefs(job ? [job.id] : [], can(PERMISSIONS.jobRead));
  const activity = activities.data?.find((item) => item.id === activityId);
  const clientId = client?.id ?? job?.client_id ?? null;
  const billable =
    billableChoice ??
    (clientId !== null &&
      activity?.is_chargeable !== false &&
      (job ? jobRefs.get(job.id)?.billing_basis !== 'non_billable' : true));

  const submit = () => {
    setRefusal(null);
    start.mutate(
      {
        ...(clientId ? { client_id: clientId } : {}),
        ...(job ? { job_id: job.id } : {}),
        ...(activityId ? { activity_code_id: activityId } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(billableChoice !== null ? { is_billable: billableChoice } : {}),
      },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: 'Timer started' });
          onClose();
        },
        onError: (error) => setRefusal(dialogError(error)),
      },
    );
  };

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        {can(PERMISSIONS.clientRead) ? (
          <ClientPicker
            label="Client"
            value={clientId}
            valueLabel={client?.label ?? job?.client_name}
            placeholder="No client (internal time)"
            onChange={(id, item) => {
              setClient(item ? { id: item.id, label: item.label } : null);
              if (job && job.client_id !== id) setJob(null);
            }}
          />
        ) : null}
        {can(PERMISSIONS.jobRead) ? (
          <JobPicker
            label="Job"
            value={job?.id ?? null}
            valueJob={job ?? undefined}
            clientId={clientId}
            placeholder="No job"
            onChange={(picked) => {
              setJob(picked);
              if (picked) {
                setClient({ id: picked.client_id, label: picked.client_name });
                const allowed = activityOptions(
                  activities.data,
                  services.data,
                  picked.service_id,
                  null,
                );
                if (activityId && !allowed.some((option) => option.value === activityId)) {
                  setActivityId('');
                }
              }
            }}
          />
        ) : null}
        <Select
          label="Activity"
          options={activityOptions(activities.data, services.data, job?.service_id ?? null, null)}
          value={activityId}
          onChange={(event) => setActivityId(event.target.value)}
        />
        <Input
          label="Description"
          autoComplete="off"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={2000}
        />
        <Checkbox
          label="Billable"
          description={
            billableChoice === null
              ? 'Worked out from the client, job and activity until you change it.'
              : undefined
          }
          checked={billable}
          onChange={(event) => setBillableChoice(event.target.checked)}
        />
        {refusal ? <FormAlert message={refusal.message} requestId={refusal.requestId} /> : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form={formId} variant="primary" loading={start.isPending}>
          Start timer
        </Button>
      </DialogActions>
    </>
  );
}

function StopTimerForm({ timer, onClose }: { timer: Timer; onClose: () => void }) {
  const { organization } = useOrg();
  const { stop } = useTimerActions();
  const { toast } = useToast();
  const formId = useId();
  const [description, setDescription] = useState(timer.description ?? '');
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  const minutes = roundUpToIncrement(
    Math.max(1, Math.ceil(timer.elapsed_seconds / 60)),
    organization.time_increment_minutes,
  );

  const submit = () => {
    setRefusal(null);
    const text = description.trim();
    // The timer's own description is kept unless it was changed here.
    const changed = text !== (timer.description ?? '');
    stop.mutate(changed ? text : undefined, {
      onSuccess: (entry) => {
        toast({
          tone: 'success',
          title: 'Timer stopped',
          description: `${formatMinutes(entry.minutes)} was saved to ${formatUkDate(entry.entry_date)}.`,
        });
        onClose();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-text-muted">
          {formatClock(timer.elapsed_seconds)} on the timer, started on{' '}
          {formatUkDate(timer.started_on)}. It is saved as a time entry of about{' '}
          {formatMinutes(minutes)} (rounded up to steps of{' '}
          {formatMinutes(organization.time_increment_minutes)}).
        </p>
        <Textarea
          label="Description"
          rows={2}
          value={description}
          maxLength={2000}
          onChange={(event) => setDescription(event.target.value)}
        />
        {refusal ? <FormAlert message={refusal.message} requestId={refusal.requestId} /> : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Keep running</Button>
        <Button type="submit" form={formId} variant="primary" loading={stop.isPending}>
          Stop and save
        </Button>
      </DialogActions>
    </>
  );
}

/**
 * The timer: start it on a client, job and activity, pause and resume, and stop it to save the
 * time as an entry (the description can be changed then) or discard it. There is one timer per
 * person; the API cannot change its client or job once it runs.
 */
export function TimerCard() {
  const { can } = useOrg();
  const { toast } = useToast();
  const timerQuery = useTimer();
  const { pause, resume, discard } = useTimerActions();
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState<Refusal | null>(null);

  const timer = timerQuery.data ?? null;
  const jobRefs = useJobRefs(timer?.job_id ? [timer.job_id] : [], can(PERMISSIONS.jobRead));
  const clientRef = useClientRef(timer?.client_id, can(PERMISSIONS.clientRead));
  const activities = useActivityTypes();

  const job = timer?.job_id ? jobRefs.get(timer.job_id) : undefined;
  const clientName =
    clientRef.data?.name ?? job?.client_name ?? (timer?.client_id ? 'Selected client' : null);
  const activityName = activities.data?.find((item) => item.id === timer?.activity_code_id)?.name;
  const parts = [
    clientName,
    job ? refLabel({ code: job.number, name: job.name }) : timer?.job_id ? 'Selected job' : null,
    activityName,
  ].filter(Boolean);

  const failed = (title: string) => (error: unknown) => {
    const notice = describeFailure(error, title);
    toast({ tone: 'error', title: notice.title, description: notice.description });
  };

  if (timerQuery.isPending) {
    return (
      <Card padding="sm" aria-label="Timer" aria-busy="true">
        <Skeleton className="h-8 w-full" shape="rect" />
      </Card>
    );
  }

  return (
    <Card padding="sm" aria-label="Timer" className="flex flex-wrap items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-text"
      >
        <TimerIcon className="size-5" />
      </span>

      {timerQuery.isError ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <p role="alert" className="text-sm text-danger">
            The timer could not be loaded.
          </p>
          <Button size="sm" onClick={() => void timerQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : timer ? (
        <>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="flex items-baseline gap-2 text-xl font-semibold text-text">
              <ElapsedClock
                key={timerQuery.dataUpdatedAt}
                base={timer.elapsed_seconds}
                running={timer.is_running}
              />
              <span className="text-xs font-medium text-text-muted">
                {timer.is_running ? 'Running' : 'Paused'}
              </span>
            </p>
            <p className="truncate text-xs text-text-muted">
              {parts.length > 0 ? parts.join(' · ') : 'No client, job or activity'}
              {timer.description ? ` · ${timer.description}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {timer.is_running ? (
              <Button
                size="sm"
                leftIcon={<Pause className="size-4" aria-hidden="true" />}
                loading={pause.isPending}
                onClick={() => pause.mutate(undefined, { onError: failed('Could not pause') })}
              >
                Pause
              </Button>
            ) : (
              <Button
                size="sm"
                leftIcon={<Play className="size-4" aria-hidden="true" />}
                loading={resume.isPending}
                onClick={() => resume.mutate(undefined, { onError: failed('Could not resume') })}
              >
                Resume
              </Button>
            )}
            <Button
              size="sm"
              variant="brand-outline"
              leftIcon={<Square className="size-4" aria-hidden="true" />}
              onClick={() => setStopping(true)}
            >
              Stop
            </Button>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Trash2 className="size-4" aria-hidden="true" />}
              onClick={() => {
                setDiscardError(null);
                setDiscarding(true);
              }}
            >
              Discard
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-sm font-medium text-text">No timer running</p>
            <p className="text-xs text-text-muted">
              Start the timer when you begin and stop it to save the time as an entry.
            </p>
          </div>
          <Button
            size="sm"
            variant="brand-outline"
            leftIcon={<Play className="size-4" aria-hidden="true" />}
            onClick={() => setStarting(true)}
          >
            Start timer
          </Button>
        </>
      )}

      <Modal
        open={starting}
        onClose={() => setStarting(false)}
        title="Start the timer"
        description="It keeps counting until you stop it, even if you leave this page."
        closeOnBackdrop={false}
      >
        {starting ? <StartTimerForm onClose={() => setStarting(false)} /> : null}
      </Modal>
      <Modal
        open={stopping && timer !== null}
        onClose={() => setStopping(false)}
        title="Stop the timer"
        size="sm"
        closeOnBackdrop={false}
      >
        {stopping && timer ? (
          <StopTimerForm timer={timer} onClose={() => setStopping(false)} />
        ) : null}
      </Modal>
      <ConfirmDialog
        open={discarding}
        onClose={() => setDiscarding(false)}
        onConfirm={() =>
          discard.mutate(undefined, {
            onSuccess: () => {
              toast({ tone: 'success', title: 'Timer discarded' });
              setDiscarding(false);
            },
            onError: (error) => setDiscardError(dialogError(error)),
          })
        }
        title="Discard the timer?"
        confirmLabel="Discard timer"
        loading={discard.isPending}
        error={discardError}
      >
        <p>The time counted so far is not saved anywhere.</p>
      </ConfirmDialog>
    </Card>
  );
}
