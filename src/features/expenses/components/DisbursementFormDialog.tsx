import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Checkbox, DateField, Input, Modal, Select, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { ClientPicker, JobPicker, useVatCodes, type VatCode } from '@/features/team';
import { todayInZone } from '@/utils/dates';
import { formatBasisPoints, parsePounds, penceToPoundsInput } from '@/utils/money';

import { useSaveDisbursement } from '../api';
import { LIMITS } from '../constants';
import { disbursementSchema, type DisbursementValues } from '../schemas/forms';
import type { Disbursement, DisbursementCreate, DisbursementUpdate } from '../types';
import { toFormError } from '../utils/errors';
import { DialogActions } from './DialogActions';

const FIELDS = [
  'client_id',
  'job_id',
  'incurred_on',
  'description',
  'supplier',
  'amount',
  'vat_rate_id',
  'is_billable',
] as const;

function vatChoices(codes: VatCode[] | undefined, current: string | null) {
  const live = (codes ?? []).filter((code) => !code.is_archived || code.id === current);
  return [
    { value: '', label: 'The practice default VAT code' },
    ...live.map((code) => ({
      value: code.id,
      label: `${code.name} (${formatBasisPoints(code.rate_bp)})`,
    })),
  ];
}

export interface DisbursementFormDialogProps {
  /** The disbursement to change, null to record one. */
  disbursement: Disbursement | null;
  /** The client and job names to show for a disbursement being edited. */
  names?: { client?: string; job?: { number: string; name: string } };
  open: boolean;
  onClose: () => void;
}

function DisbursementForm({
  disbursement,
  names,
  onClose,
}: Omit<DisbursementFormDialogProps, 'open'>) {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const save = useSaveDisbursement();
  const vatCodes = useVatCodes();
  const formId = useId();
  const today = todayInZone(organization.timezone);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm<DisbursementValues>({
    resolver: zodResolver(disbursementSchema),
    defaultValues: {
      client_id: disbursement?.client_id ?? '',
      job_id: disbursement?.job_id ?? '',
      incurred_on: disbursement?.incurred_on ?? today,
      description: disbursement?.description ?? '',
      supplier: disbursement?.supplier ?? '',
      amount: penceToPoundsInput(disbursement?.amount),
      vat_rate_id: disbursement?.vat_rate_id ?? '',
      is_billable: disbursement?.is_billable ?? true,
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<DisbursementValues>({ setError, fields: FIELDS });
  const [clientId, jobId] = useWatch({ control, name: ['client_id', 'job_id'] });

  const job = useMemo(
    () =>
      disbursement?.job_id && names?.job && disbursement.client_id
        ? {
            id: disbursement.job_id,
            number: names.job.number,
            name: names.job.name,
            client_id: disbursement.client_id,
            client_code: '',
            client_name: names.client ?? '',
            service_id: null,
            service_name: null,
          }
        : undefined,
    [disbursement, names],
  );

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const amount = parsePounds(values.amount) ?? 0;
    const onError = (error: unknown) => handleSubmitError(toFormError(error));

    if (!disbursement) {
      const body: DisbursementCreate = {
        client_id: values.client_id,
        incurred_on: values.incurred_on,
        description: values.description,
        amount,
        is_billable: values.is_billable,
      };
      if (values.job_id) body.job_id = values.job_id;
      if (values.supplier) body.supplier = values.supplier;
      if (values.vat_rate_id) body.vat_rate_id = values.vat_rate_id;
      save.mutate(
        { mode: 'create', body },
        {
          onSuccess: () => {
            toast({ tone: 'success', title: 'Disbursement recorded' });
            onClose();
          },
          onError,
        },
      );
      return;
    }

    // PATCH is partial: send only what changed (null clears the job and the VAT code).
    const changes: DisbursementUpdate = {};
    if (values.client_id !== disbursement.client_id) changes.client_id = values.client_id;
    const job = values.job_id || null;
    if (job !== disbursement.job_id) changes.job_id = job;
    if (values.incurred_on !== disbursement.incurred_on) changes.incurred_on = values.incurred_on;
    if (values.description !== disbursement.description) changes.description = values.description;
    const supplier = values.supplier || null;
    if (supplier !== disbursement.supplier) changes.supplier = supplier;
    if (amount !== disbursement.amount) changes.amount = amount;
    const vat = values.vat_rate_id || null;
    if (vat !== disbursement.vat_rate_id) changes.vat_rate_id = vat;
    if (values.is_billable !== disbursement.is_billable) changes.is_billable = values.is_billable;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    save.mutate(
      { mode: 'update', id: disbursement.id, body: changes },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: 'Disbursement saved' });
          onClose();
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
        <div className="grid gap-4 sm:grid-cols-2">
          <ClientPicker
            label="Client"
            value={clientId || null}
            valueLabel={names?.client}
            onChange={(id) => {
              setValue('client_id', id ?? '', { shouldDirty: true, shouldValidate: true });
              setValue('job_id', '', { shouldDirty: true });
            }}
            error={errors.client_id?.message}
          />
          {can('job.read') ? (
            <JobPicker
              label="Job"
              clearable
              clientId={clientId || null}
              value={jobId || null}
              valueJob={job}
              disabled={clientId === ''}
              onChange={(picked) => setValue('job_id', picked?.id ?? '', { shouldDirty: true })}
              error={errors.job_id?.message}
            />
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="incurred_on"
            render={({ field }) => (
              <DateField
                label="Date"
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? '')}
                error={errors.incurred_on?.message}
              />
            )}
          />
          <Input
            label="Supplier"
            autoComplete="off"
            maxLength={LIMITS.supplier}
            error={errors.supplier?.message}
            {...register('supplier')}
          />
        </div>
        <Input
          label="Description"
          autoComplete="off"
          maxLength={LIMITS.description}
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Amount before VAT (£)"
            inputMode="decimal"
            autoComplete="off"
            hint="What is recharged to the client."
            error={errors.amount?.message}
            {...register('amount')}
          />
          <Select
            label="VAT code"
            options={vatChoices(vatCodes.data, disbursement?.vat_rate_id ?? null)}
            error={errors.vat_rate_id?.message}
            {...register('vat_rate_id')}
          />
        </div>
        <Controller
          control={control}
          name="is_billable"
          render={({ field }) => (
            <Checkbox
              label="Billable to the client"
              description="A billable disbursement is work in progress until it is invoiced."
              checked={field.value}
              onChange={(event) => field.onChange(event.target.checked)}
            />
          )}
        />
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
          loading={save.isPending}
          disabled={(disbursement !== null && !isDirty) || retryIn > 0}
        >
          {disbursement ? 'Save disbursement' : 'Record disbursement'}
        </Button>
      </DialogActions>
    </>
  );
}

/** Record a disbursement (a cost paid for a client, to recharge), or change one that is unbilled. */
export function DisbursementFormDialog({
  disbursement,
  names,
  open,
  onClose,
}: DisbursementFormDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={disbursement ? 'Edit disbursement' : 'Record disbursement'}
      description="A cost paid on a client's behalf, to recharge to them."
      size="lg"
      closeOnBackdrop={false}
    >
      {open ? (
        <DisbursementForm
          key={disbursement?.id ?? 'new'}
          disbursement={disbursement}
          names={names}
          onClose={onClose}
        />
      ) : null}
    </Modal>
  );
}
