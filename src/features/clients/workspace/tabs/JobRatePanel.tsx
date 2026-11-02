import { useId, useState } from 'react';
import { Link } from 'react-router';

import { FormAlert } from '@/components/forms';
import { Button, FormPanel, Input, useToast } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { isApiError } from '@/services/api';
import { cn } from '@/utils/cn';
import { currencySymbol, formatMoney, parsePounds, penceToPoundsInput } from '@/utils/money';

import { useSetJobRate } from '../../api';
import { rerateLink, taskRateText } from '../jobRates';
import type { JobRate, JobRow } from '../types';

type Choice = 'task' | 'client';

export interface JobRateTarget {
  job: JobRow;
  rate: JobRate | undefined;
}

function ChoiceOption({
  name,
  value,
  checked,
  onChange,
  label,
  description,
}: {
  name: string;
  value: Choice;
  checked: boolean;
  onChange: (value: Choice) => void;
  label: string;
  description: string;
}) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5',
        checked ? 'border-primary bg-primary-soft' : 'border-border bg-surface',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-text">{label}</span>
        <span className="text-xs text-text-muted">{description}</span>
      </span>
    </label>
  );
}

function JobRateForm({ target, onClose }: { target: JobRateTarget; onClose: () => void }) {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const formId = useId();
  const name = useId();
  const save = useSetJobRate();
  const { job, rate } = target;
  const currency = organization.currency;
  const [choice, setChoice] = useState<Choice>(job.hourly_rate === null ? 'task' : 'client');
  const [amount, setAmount] = useState(penceToPoundsInput(job.hourly_rate, currency));
  const [fieldError, setFieldError] = useState<string>();
  const [failure, setFailure] = useState<{ message: string; requestId?: string }>();

  const task = rate?.task_rate ?? null;
  const taskDescription = task
    ? `${taskRateText(task, currency)}: the rate set against ${job.service_name ?? 'the service'}.`
    : job.service_name
      ? `No task rate is set for ${job.service_name}: each person's charge-out rate applies.`
      : "The job has no service: each person's charge-out rate applies.";
  const rule = rate?.client_rule ?? null;

  const submit = async () => {
    setFailure(undefined);
    let hourlyRate: number | null = null;
    if (choice === 'client') {
      const pence = parsePounds(amount, currency);
      if (amount.trim() === '' || pence === null || pence < 0) {
        setFieldError('Enter an hourly rate in pounds, for example 95 or 120.50');
        return;
      }
      hourlyRate = pence;
    }
    setFieldError(undefined);
    if (hourlyRate === job.hourly_rate) {
      onClose();
      return;
    }
    try {
      await save.mutateAsync({ jobId: job.id, hourlyRate });
      toast({
        tone: 'success',
        title: hourlyRate === null ? 'Back to the task rate' : 'Client rate saved',
        description:
          hourlyRate === null
            ? `${job.number} follows the task rate.`
            : `${job.number}: ${formatMoney(hourlyRate, currency)} an hour.`,
      });
      onClose();
    } catch (error) {
      setFailure(
        isApiError(error)
          ? { message: error.message, requestId: error.requestId }
          : { message: 'The rate could not be saved. Please try again.' },
      );
    }
  };

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-4"
      >
        {failure ? <FormAlert message={failure.message} requestId={failure.requestId} /> : null}
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-text">Rate for this job</legend>
          <ChoiceOption
            name={name}
            value="task"
            checked={choice === 'task'}
            onChange={setChoice}
            label="Use the task rate"
            description={taskDescription}
          />
          <ChoiceOption
            name={name}
            value="client"
            checked={choice === 'client'}
            onChange={setChoice}
            label="Agree a custom client rate"
            description="The rate agreed with the client for this job. Billing uses it for new time."
          />
        </fieldset>
        {choice === 'client' ? (
          <Input
            label={`Client rate per hour (${currencySymbol(currency)})`}
            required
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            error={fieldError}
          />
        ) : null}
        {rule ? (
          <p className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-text">
            A client rate of {formatMoney(rule.rate, currency)} an hour for{' '}
            {rule.level === 'client' ? 'all work' : (job.service_name ?? 'this service')} is set in
            the client&apos;s Settings → Rates. It applies before the job&apos;s own rate.
          </p>
        ) : null}
        <p className="text-sm text-text-muted">
          Time already recorded keeps the rate it was priced at.{' '}
          {can(PERMISSIONS.rateManage) && job.wip_value > 0 ? (
            <>
              To bill this job&apos;s unbilled time at the new rate,{' '}
              <Link
                to={rerateLink(organization.slug, job)}
                className="font-medium text-brand-text hover:underline"
              >
                re-rate it
              </Link>{' '}
              after saving.
            </>
          ) : (
            'Unbilled time moves to the new rate when it is re-rated.'
          )}
        </p>
      </form>
      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form={formId} variant="primary" loading={save.isPending}>
          Save rate
        </Button>
      </div>
    </>
  );
}

export interface JobRatePanelProps {
  target: JobRateTarget | null;
  onClose: () => void;
}

/** Choose between the task rate and a custom client rate for one of the client's jobs (APT54). */
export function JobRatePanel({ target, onClose }: JobRatePanelProps) {
  return (
    <FormPanel
      open={target !== null}
      onClose={onClose}
      title={target ? `Rate for ${target.job.number}` : 'Rate'}
      description={
        target
          ? `${target.job.name}. A job follows the task rate until you agree a custom rate with the client.`
          : undefined
      }
    >
      {target ? <JobRateForm key={target.job.id} target={target} onClose={onClose} /> : null}
    </FormPanel>
  );
}
