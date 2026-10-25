import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Checkbox, Input, FormPanel, Select, Switch, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { isApiError } from '@/services/api';
import { todayInZone } from '@/utils/dates';
import { currencySymbol, formatMoney, penceToPoundsInput } from '@/utils/money';

import { useCreateEngagement, useServiceOptions, useUpdateEngagement } from '../api';
import { FREQUENCY_OPTIONS } from '../constants';
import {
  EMPTY_ENGAGEMENT_FORM,
  ENGAGEMENT_FORM_FIELDS,
  engagementFormSchema,
  engagementToForm,
  toEngagementPayload,
  type EngagementFormValues,
} from '../schemas';
import type { ClientServiceRead, ClientServiceUpdate } from '../types';
import { nextJobHint } from '../utils/jobPeriods';

export interface EngagementTarget {
  clientId: string;
  /** The engagement to edit; null to add a service. */
  engagement: ClientServiceRead | null;
  /** Services the client already takes (left out of the picker when adding). */
  takenServiceIds: string[];
}

export interface EngagementFormPanelProps {
  target: EngagementTarget | null;
  onClose: () => void;
}

/** The automation fields of an edit that differ from what the engagement has. */
function changedAutomation(
  engagement: ClientServiceRead,
  payload: ReturnType<typeof toEngagementPayload>,
): Pick<ClientServiceUpdate, 'auto_create_jobs' | 'job_lead_days'> {
  const changes: Pick<ClientServiceUpdate, 'auto_create_jobs' | 'job_lead_days'> = {};
  if (payload.auto_create_jobs !== engagement.auto_create_jobs) {
    changes.auto_create_jobs = payload.auto_create_jobs;
  }
  if (payload.job_lead_days !== undefined && payload.job_lead_days !== engagement.job_lead_days) {
    changes.job_lead_days = payload.job_lead_days;
  }
  return changes;
}

function EngagementForm({ target, onClose }: { target: EngagementTarget; onClose: () => void }) {
  const { organization } = useOrg();
  const currency = organization.currency;
  const { toast } = useToast();
  const formId = useId();
  const services = useServiceOptions();
  const create = useCreateEngagement();
  const update = useUpdateEngagement();
  const editing = target.engagement;

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<EngagementFormValues>({
    resolver: zodResolver(engagementFormSchema),
    defaultValues: editing
      ? engagementToForm(editing, (pence) => penceToPoundsInput(pence, currency))
      : EMPTY_ENGAGEMENT_FORM,
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<EngagementFormValues>({ setError, fields: ENGAGEMENT_FORM_FIELDS });

  const serviceId = useWatch({ control, name: 'service_id' });
  const [frequency, startDate, endDate, autoCreate, leadDays] = useWatch({
    control,
    name: ['frequency', 'start_date', 'end_date', 'auto_create_jobs', 'job_lead_days'],
  });
  const hint = autoCreate
    ? nextJobHint({
        frequency,
        startDate,
        endDate,
        leadDays: /^\d+$/.test(leadDays.trim()) ? Number(leadDays) : 0,
        today: todayInZone(organization.timezone),
      })
    : null;
  const chosen = (services.data ?? []).find((service) => service.id === serviceId);

  const onSubmit = handleSubmit(async (values) => {
    clearSubmitError();
    const payload = toEngagementPayload(values);
    try {
      if (editing) {
        // The service of an engagement cannot change (delete and re-add instead).
        const body = {
          fee: payload.fee,
          frequency: payload.frequency,
          start_date: payload.start_date,
          end_date: payload.end_date,
          is_active: payload.is_active,
          ...changedAutomation(editing, payload),
        };
        await update.mutateAsync({ clientId: target.clientId, engagementId: editing.id, body });
        toast({ tone: 'success', title: 'Service updated', description: editing.service_name });
      } else {
        await create.mutateAsync({ clientId: target.clientId, body: payload });
        toast({ tone: 'success', title: 'Service added', description: chosen?.name });
      }
      onClose();
    } catch (error) {
      if (isApiError(error) && error.code === 'CLIENT_SERVICE_EXISTS') {
        setError('service_id', { type: 'server', message: error.message }, { shouldFocus: true });
        return;
      }
      handleSubmitError(error);
    }
  });

  const serviceOptions = editing
    ? [{ value: editing.service_id, label: `${editing.service_code} · ${editing.service_name}` }]
    : (services.data ?? [])
        .filter((service) => service.is_active && !target.takenServiceIds.includes(service.id))
        .map((service) => ({ value: service.id, label: `${service.code} · ${service.name}` }));

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
        <Select
          label="Service"
          required
          options={serviceOptions}
          placeholder={services.isPending ? 'Loading services…' : 'Choose a service'}
          disabled={Boolean(editing)}
          error={errors.service_id?.message}
          {...register('service_id')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={`Agreed fee (${currencySymbol(currency)})`}
            inputMode="decimal"
            hint={
              chosen?.default_fee !== null && chosen?.default_fee !== undefined
                ? `Blank uses the service default of ${formatMoney(chosen.default_fee, currency)}.`
                : 'Blank uses the service default fee.'
            }
            error={errors.fee?.message}
            {...register('fee')}
          />
          <Select
            label="Frequency"
            hint="How often this work repeats. One-off means it does not."
            options={FREQUENCY_OPTIONS}
            error={errors.frequency?.message}
            {...register('frequency')}
          />
          <Input
            label="Start date"
            type="date"
            hint="When the first period starts. Needed to create jobs automatically."
            required={autoCreate}
            error={errors.start_date?.message}
            {...register('start_date')}
          />
          <Input
            label="End date"
            type="date"
            error={errors.end_date?.message}
            {...register('end_date')}
          />
        </div>
        <Checkbox
          label="Active"
          description="Turn off to stop work on this service without removing it."
          error={errors.is_active?.message}
          {...register('is_active')}
        />
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <Controller
            control={control}
            name="auto_create_jobs"
            render={({ field }) => (
              <Switch
                label="Create the jobs automatically"
                description="A job, with the service's default tasks, is created before each period starts."
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {autoCreate ? (
            <>
              <Input
                label="Create each job N days before its period starts"
                required
                inputMode="numeric"
                error={errors.job_lead_days?.message}
                {...register('job_lead_days')}
              />
              {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
            </>
          ) : null}
        </div>
      </form>
      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          loading={create.isPending || update.isPending}
          disabled={retryIn > 0}
        >
          {editing ? 'Save service' : 'Add service'}
        </Button>
      </div>
    </>
  );
}

/** Add a service to a client (engagement) or change its fee, frequency and dates. */
export function EngagementFormPanel({ target, onClose }: EngagementFormPanelProps) {
  return (
    <FormPanel
      open={target !== null}
      onClose={onClose}
      title={target?.engagement ? `Edit ${target.engagement.service_name}` : 'Add service'}
    >
      {target ? (
        <EngagementForm key={target.engagement?.id ?? 'new'} target={target} onClose={onClose} />
      ) : null}
    </FormPanel>
  );
}
