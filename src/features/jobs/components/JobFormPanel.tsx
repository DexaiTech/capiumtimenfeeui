import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import {
  Button,
  DateField,
  DurationInput,
  Input,
  FormPanel,
  FormSection,
  Select,
  Switch,
  Textarea,
  useToast,
  type SelectOption,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { ClientPicker, useServices, useServiceTaskTemplates, type Service } from '@/features/team';
import { penceToPoundsInput } from '@/utils/money';

import { useCreateJob, useMembers, useUpdateJob } from '../api';
import { BILLING_BASIS_LABEL, LIMITS } from '../constants';
import { jobDefaults, jobSchema, toJobInput, toJobUpdate, type JobValues } from '../schemas/job';
import { BILLING_BASES, type Job } from '../types';
import { toFormError } from '../utils/errors';
import { jobLabel } from '../utils/format';
import { DialogActions } from './DialogActions';

const FIELDS = [
  'client_id',
  'name',
  'description',
  'service_id',
  'billing_basis',
  'fixed_fee',
  'hourly_rate',
  'budget_minutes',
  'budget_fee',
  'start_date',
  'due_date',
  'period_start',
  'period_end',
  'partner_user_id',
  'manager_user_id',
  'status',
] as const;

const BASIS_OPTIONS: ReadonlyArray<SelectOption> = BILLING_BASES.map((basis) => ({
  value: basis,
  label: BILLING_BASIS_LABEL[basis],
}));

const START_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: 'planned', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
];

export interface JobFormPanelProps {
  open: boolean;
  onClose: () => void;
  /** The job to edit; null starts a new one. */
  job: Job | null;
  /** The client a new job is for, when the dialog is opened from a client. */
  clientId?: string;
  onSaved: (job: Job) => void;
}

interface JobFormProps extends Omit<JobFormPanelProps, 'open'> {
  formId: string;
}

function JobForm({ job, clientId, onClose, onSaved, formId }: JobFormProps) {
  const { can } = useOrg();
  const { toast } = useToast();
  const create = useCreateJob();
  const update = useUpdateJob();
  const members = useMembers();
  const services = useServices();
  const managed = job?.pm_job_id != null;

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors, isDirty },
  } = useForm<JobValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: jobDefaults(job, clientId),
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } = useSubmitError<JobValues>({
    setError,
    fields: FIELDS,
  });
  const [basis, clientValue, budgetMinutes, serviceValue, startDate] = useWatch({
    control,
    name: ['billing_basis', 'client_id', 'budget_minutes', 'service_id', 'start_date'],
  });

  // A new job can start with the default tasks of its service: offered (on) when it has some.
  const [addDefaultTasks, setAddDefaultTasks] = useState(true);
  const defaultTaskCount = job
    ? 0
    : (services.data?.find((entry) => entry.id === serviceValue)?.task_template_count ?? 0);
  const offersDefaultTasks = defaultTaskCount > 0;
  const defaultTasks = useServiceTaskTemplates(serviceValue, { enabled: offersDefaultTasks });

  const memberOptions = (current: string): SelectOption[] => {
    const options: SelectOption[] = [
      { value: '', label: 'None' },
      ...(members.data ?? []).map((member) => ({ value: member.user_id, label: member.full_name })),
    ];
    if (current && !options.some((option) => option.value === current)) {
      options.push({ value: current, label: 'Former member' });
    }
    return options;
  };

  const serviceOptions = (current: string): SelectOption[] => [
    { value: '', label: 'No service' },
    ...(services.data ?? [])
      .filter((service) => service.is_active || service.id === current)
      .map((service) => ({
        value: service.id,
        label: service.is_active ? service.name : `${service.name} (inactive)`,
      })),
  ];

  /** A new job takes the billing basis and the fee of its service until the person sets them. */
  const onServiceChange = (serviceId: string) => {
    setValue('service_id', serviceId, { shouldDirty: true });
    if (job) return;
    const service: Service | undefined = services.data?.find((entry) => entry.id === serviceId);
    if (!service) return;
    const next = !service.default_billable
      ? 'non_billable'
      : service.billing_basis === 'fixed'
        ? 'fixed'
        : 'hourly';
    setValue('billing_basis', next, { shouldDirty: true });
    if (next === 'fixed' && service.default_fee !== null && getValues('fixed_fee') === '') {
      setValue('fixed_fee', penceToPoundsInput(service.default_fee), { shouldDirty: true });
    }
  };

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const onError = (error: unknown) => handleSubmitError(toFormError(error));
    if (!job) {
      const input = toJobInput(values);
      if (offersDefaultTasks && addDefaultTasks) input.add_default_tasks = true;
      create.mutate(input, {
        onSuccess: (created) => {
          toast({ tone: 'success', title: 'Job created', description: jobLabel(created) });
          onSaved(created);
        },
        onError,
      });
      return;
    }
    const body = toJobUpdate(values, job);
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    update.mutate(
      { jobId: job.id, body },
      {
        onSuccess: (saved) => {
          toast({ tone: 'success', title: 'Job saved', description: jobLabel(saved) });
          onSaved(saved);
        },
        onError,
      },
    );
  });

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        {managed ? (
          <p className="rounded-md bg-surface-sunken px-3 py-2 text-xs text-text-muted">
            This job is linked to an external job: its name, service, manager, partner and dates are
            managed there.
          </p>
        ) : null}
        <p className="text-xs text-text-muted">Fields marked with a red star are required.</p>
        <FormSection title="The job" className="flex flex-col gap-4">
          {job ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-text">Client</span>
              <span className="text-sm text-text">
                {job.client_name} <span className="text-text-muted">({job.client_code})</span>
              </span>
            </div>
          ) : can('client.read') ? (
            <ClientPicker
              label="Client"
              required
              value={clientValue || null}
              onChange={(id) => setValue('client_id', id ?? '', { shouldDirty: true })}
              error={errors.client_id?.message}
            />
          ) : (
            <p className="text-sm text-text-muted">
              Your role cannot choose a client, so it cannot start a job from here.
            </p>
          )}
          <Input
            label="Job name"
            required
            autoComplete="off"
            maxLength={LIMITS.jobName}
            disabled={managed}
            error={errors.name?.message}
            {...register('name')}
          />
          <Textarea
            label="Description"
            rows={2}
            maxLength={LIMITS.jobDescription}
            error={errors.description?.message}
            {...register('description')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="service_id"
              render={({ field }) => (
                <Select
                  label="Service"
                  options={serviceOptions(field.value)}
                  value={field.value}
                  disabled={managed}
                  onChange={(event) => onServiceChange(event.target.value)}
                  error={errors.service_id?.message}
                />
              )}
            />
            <Select
              label="Billing"
              options={BASIS_OPTIONS}
              error={errors.billing_basis?.message}
              {...register('billing_basis')}
            />
          </div>
        </FormSection>
        <FormSection
          title="Fees and budget"
          description="Optional. Left empty, the service and the practice's rates apply."
          className="grid gap-4 sm:grid-cols-2"
        >
          {basis === 'fixed' ? (
            <Input
              label="Fixed fee (£)"
              inputMode="decimal"
              autoComplete="off"
              hint="Left empty, the service's default fee is used."
              error={errors.fixed_fee?.message}
              {...register('fixed_fee')}
            />
          ) : null}
          {basis === 'hourly' ? (
            <Input
              label="Hourly rate for this job (£)"
              inputMode="decimal"
              autoComplete="off"
              hint="Leave empty to use the rates of the practice."
              error={errors.hourly_rate?.message}
              {...register('hourly_rate')}
            />
          ) : null}
          <DurationInput
            label="Hours budget"
            value={budgetMinutes}
            hint="For example 40:00 or 12.5"
            error={errors.budget_minutes?.message}
            onCommit={(minutes) =>
              setValue('budget_minutes', minutes, { shouldDirty: true, shouldValidate: true })
            }
          />
          <Input
            label="Fee budget (£)"
            inputMode="decimal"
            autoComplete="off"
            error={errors.budget_fee?.message}
            {...register('budget_fee')}
          />
        </FormSection>
        <FormSection title="Dates" className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="start_date"
            render={({ field }) => (
              <DateField
                label="Start date"
                value={field.value || null}
                disabled={managed}
                onChange={(value) => field.onChange(value ?? '')}
                error={errors.start_date?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="due_date"
            render={({ field }) => (
              <DateField
                label="Due date"
                value={field.value || null}
                disabled={managed}
                onChange={(value) => field.onChange(value ?? '')}
                error={errors.due_date?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="period_start"
            render={({ field }) => (
              <DateField
                label="Period start"
                value={field.value || null}
                hint="The period of the work, for example the accounting year."
                onChange={(value) => field.onChange(value ?? '')}
                error={errors.period_start?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="period_end"
            render={({ field }) => (
              <DateField
                label="Period end"
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? '')}
                error={errors.period_end?.message}
              />
            )}
          />
        </FormSection>
        <FormSection
          title="People"
          description="The manager runs the job; the partner is responsible for the client."
          className="grid gap-4 sm:grid-cols-2"
        >
          <Controller
            control={control}
            name="manager_user_id"
            render={({ field }) => (
              <Select
                label="Manager"
                options={memberOptions(field.value)}
                value={field.value}
                disabled={managed}
                onChange={(event) => field.onChange(event.target.value)}
                error={errors.manager_user_id?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="partner_user_id"
            render={({ field }) => (
              <Select
                label="Partner"
                options={memberOptions(field.value)}
                value={field.value}
                disabled={managed}
                onChange={(event) => field.onChange(event.target.value)}
                error={errors.partner_user_id?.message}
              />
            )}
          />
        </FormSection>
        {offersDefaultTasks ? (
          <div className="flex flex-col gap-1 rounded-md border border-border px-3 py-1">
            <Switch
              checked={addDefaultTasks}
              onChange={setAddDefaultTasks}
              label={`Add this service's ${String(defaultTaskCount)} default ${defaultTaskCount === 1 ? 'task' : 'tasks'}`}
              description="They are added to the job when it is created, in this order, assigned to the people on the job."
            />
            {addDefaultTasks ? (
              <div className="pb-2">
                {defaultTasks.isPending ? (
                  <p className="text-xs text-text-muted">Loading the tasks…</p>
                ) : defaultTasks.isError ? (
                  <p className="text-xs text-text-muted">The list of tasks could not be loaded.</p>
                ) : (
                  <>
                    <ol className="list-decimal pl-5 text-sm text-text">
                      {defaultTasks.data.map((entry) => (
                        <li key={entry.id}>{entry.title}</li>
                      ))}
                    </ol>
                    {defaultTasks.data.some((entry) => entry.due_offset_days !== null) ? (
                      <p className="mt-1 text-xs text-text-muted">
                        {startDate
                          ? 'Tasks with a due date fall that many days after the start date of the job.'
                          : 'Set a start date to give these tasks due dates: without one, they have none.'}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        {job ? null : (
          <Select
            label="Starts as"
            options={START_OPTIONS}
            error={errors.status?.message}
            {...register('status')}
          />
        )}
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          loading={create.isPending || update.isPending}
          disabled={(job !== null && !isDirty) || retryIn > 0}
        >
          {job ? 'Save job' : 'Create job'}
        </Button>
      </DialogActions>
    </>
  );
}

/** Start a job for a client, or change the details of one (its status has its own action). */
export function JobFormPanel({ open, onClose, ...rest }: JobFormPanelProps) {
  const formId = useId();
  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title={rest.job ? 'Edit job' : 'New job'}
      description={rest.job ? jobLabel(rest.job) : undefined}
    >
      {open ? (
        <JobForm key={rest.job?.id ?? 'new'} formId={formId} onClose={onClose} {...rest} />
      ) : null}
    </FormPanel>
  );
}
