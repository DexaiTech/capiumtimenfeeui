import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Input, Modal, Select, useToast, type SelectOption } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatUkDate, todayInZone } from '@/utils/dates';
import { currencySymbol, formatMoney, parsePounds } from '@/utils/money';

import {
  useCreateClientRate,
  useSetClientRateEnd,
  useStaffDirectory,
  useUpdateClientRate,
} from '../../api';
import type { ClientRateRead } from '../../types';
import { rateAudience } from './rateStatus';
import {
  CLIENT_RATE_FORM_FIELDS,
  clientRateFormSchema,
  clientRateToForm,
  EMPTY_CLIENT_RATE_FORM,
  rateEndFormSchema,
  toClientRateCreate,
  type ClientRateFormValues,
  type RateEndFormValues,
} from './schemas';

/** The rate to edit, or null to add one. */
export interface ClientRateTarget {
  clientId: string;
  rate: ClientRateRead | null;
}

export interface ClientRateDialogProps {
  target: ClientRateTarget | null;
  onClose: () => void;
}

function ClientRateForm({ target, onClose }: { target: ClientRateTarget; onClose: () => void }) {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const formId = useId();
  const staff = useStaffDirectory();
  const create = useCreateClientRate();
  const update = useUpdateClientRate();
  const editing = target.rate;
  const currency = organization.currency;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ClientRateFormValues>({
    resolver: zodResolver(clientRateFormSchema),
    defaultValues: editing ? clientRateToForm(editing) : EMPTY_CLIENT_RATE_FORM,
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<ClientRateFormValues>({ setError, fields: CLIENT_RATE_FORM_FIELDS });

  const onSubmit = handleSubmit(async (values) => {
    clearSubmitError();
    try {
      if (editing) {
        // Only the amount of a rate changes; the person and the period are fixed (end-date it instead).
        const hourlyRate = parsePounds(values.hourly_rate) ?? editing.hourly_rate;
        if (hourlyRate === editing.hourly_rate) {
          onClose();
          return;
        }
        await update.mutateAsync({ clientId: target.clientId, rateId: editing.id, hourlyRate });
        toast({
          tone: 'success',
          title: 'Rate updated',
          description: `${rateAudience(editing)}: ${formatMoney(hourlyRate, currency)} an hour`,
        });
      } else {
        const body = toClientRateCreate(values);
        await create.mutateAsync({ clientId: target.clientId, body });
        toast({
          tone: 'success',
          title: 'Rate added',
          description: formatMoney(body.hourly_rate, currency) + ' an hour',
        });
      }
      onClose();
    } catch (error) {
      handleSubmitError(error);
    }
  });

  const people: SelectOption[] = [
    { value: '', label: 'Everyone working for the client' },
    ...(staff.data ?? []).map((member) => ({ value: member.user_id, label: member.full_name })),
  ];
  if (editing?.user_id && !people.some((option) => option.value === editing.user_id)) {
    people.push({ value: editing.user_id, label: rateAudience(editing) });
  }

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
          label="Applies to"
          options={people}
          hint={
            can('member.read')
              ? 'A rate for one person takes precedence over the rate for everyone.'
              : 'Your role does not include the staff list: the rate applies to everyone.'
          }
          error={errors.user_id?.message}
          disabled={Boolean(editing)}
          {...register('user_id')}
        />
        <Input
          label={`Rate per hour (${currencySymbol(currency)})`}
          required
          inputMode="decimal"
          autoComplete="off"
          data-autofocus
          error={errors.hourly_rate?.message}
          {...register('hourly_rate')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Effective from"
            type="date"
            hint={editing ? undefined : 'Blank: the rate applies from the first day.'}
            error={errors.effective_from?.message}
            disabled={Boolean(editing)}
            {...register('effective_from')}
          />
          <Input
            label="Effective to"
            type="date"
            hint={editing ? 'Use End-date to change the last day.' : 'Blank: no end date.'}
            error={errors.effective_to?.message}
            disabled={Boolean(editing)}
            {...register('effective_to')}
          />
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
          {editing ? 'Save rate' : 'Add rate'}
        </Button>
      </div>
    </>
  );
}

/** Add a rate override for the client, or change the amount of one. */
export function ClientRateDialog({ target, onClose }: ClientRateDialogProps) {
  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={target?.rate ? 'Edit client rate' : 'Add client rate'}
      description="A charge-out rate that applies to the time recorded for this client only."
      size="md"
      closeOnBackdrop={false}
    >
      {target ? (
        <ClientRateForm key={target.rate?.id ?? 'new'} target={target} onClose={onClose} />
      ) : null}
    </Modal>
  );
}

export interface RateEndTarget {
  rate: ClientRateRead;
}

export interface RateEndDialogProps {
  target: RateEndTarget | null;
  onClose: () => void;
}

function RateEndForm({ target, onClose }: { target: RateEndTarget; onClose: () => void }) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const formId = useId();
  const setEnd = useSetClientRateEnd();
  const { rate } = target;
  const today = todayInZone(organization.timezone);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RateEndFormValues>({
    resolver: zodResolver(rateEndFormSchema),
    defaultValues: {
      effective_to:
        rate.effective_to ?? (rate.effective_from > today ? rate.effective_from : today),
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<RateEndFormValues>({ setError, fields: ['effective_to'] });

  const save = async (effectiveTo: string | null) => {
    clearSubmitError();
    try {
      await setEnd.mutateAsync({ rateId: rate.id, effectiveTo });
      toast({
        tone: 'success',
        title: effectiveTo ? 'Rate end-dated' : 'End date removed',
        description: effectiveTo
          ? `${rateAudience(rate)}: last day ${formatUkDate(effectiveTo)}`
          : rateAudience(rate),
      });
      onClose();
    } catch (error) {
      handleSubmitError(error);
    }
  };
  const onSubmit = handleSubmit((values) => save(values.effective_to));

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
        <p className="text-sm text-text-muted">
          {rateAudience(rate)}: {formatMoney(rate.hourly_rate, organization.currency)} an hour from{' '}
          {formatUkDate(rate.effective_from)}. After the last day the rate no longer applies to new
          time.
        </p>
        <Input
          label="Last day of the rate"
          required
          type="date"
          min={rate.effective_from}
          data-autofocus
          error={errors.effective_to?.message}
          {...register('effective_to')}
        />
      </form>
      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button onClick={onClose}>Cancel</Button>
        {rate.effective_to !== null ? (
          <Button onClick={() => void save(null)} disabled={setEnd.isPending}>
            Remove end date
          </Button>
        ) : null}
        <Button
          type="submit"
          form={formId}
          variant="primary"
          loading={setEnd.isPending}
          disabled={retryIn > 0}
        >
          Save end date
        </Button>
      </div>
    </>
  );
}

/** Sets the last day of a rate (`PATCH /rates/{id}`), or makes it open-ended again. */
export function RateEndDialog({ target, onClose }: RateEndDialogProps) {
  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title="End-date rate"
      size="sm"
      closeOnBackdrop={false}
    >
      {target ? <RateEndForm key={target.rate.id} target={target} onClose={onClose} /> : null}
    </Modal>
  );
}
