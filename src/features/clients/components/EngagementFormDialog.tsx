import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Checkbox, Input, Modal, Select, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { isApiError } from '@/services/api';
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
import type { ClientServiceRead } from '../types';

export interface EngagementTarget {
  clientId: string;
  /** The engagement to edit; null to add a service. */
  engagement: ClientServiceRead | null;
  /** Services the client already takes (left out of the picker when adding). */
  takenServiceIds: string[];
}

export interface EngagementFormDialogProps {
  target: EngagementTarget | null;
  onClose: () => void;
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
            options={FREQUENCY_OPTIONS}
            error={errors.frequency?.message}
            {...register('frequency')}
          />
          <Input
            label="Start date"
            type="date"
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
        <Checkbox label="Active" error={errors.is_active?.message} {...register('is_active')} />
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
export function EngagementFormDialog({ target, onClose }: EngagementFormDialogProps) {
  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={target?.engagement ? `Edit ${target.engagement.service_name}` : 'Add service'}
    >
      {target ? (
        <EngagementForm key={target.engagement?.id ?? 'new'} target={target} onClose={onClose} />
      ) : null}
    </Modal>
  );
}
