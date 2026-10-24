import { zodResolver } from '@hookform/resolvers/zod';
import { useId, type ChangeEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Checkbox, Input, FormPanel, Select, useToast } from '@/components/ui';

import { useCreateVatRate, useUpdateVatRate } from '../../api/billingHooks';
import type { VatRate, VatRateCreate, VatRateUpdate } from '../../billingTypes';
import { vatRateSchema, type VatRateValues } from '../../schemas/billing';
import { toBillingFormError } from '../../utils/billingErrors';
import {
  bpToPercentInput,
  parsePercentToBp,
  VAT_CODE_OPTIONS,
  ZERO_RATE_CODES,
} from '../../utils/vat';
import { DialogActions } from '../DialogActions';

const FIELDS = ['name', 'code', 'rate', 'is_default'] as const;
/** API field → form field, for 422 details. */
const FIELD_NAMES = { rate_bp: 'rate' };

export interface VatRateFormPanelProps {
  /** The VAT code to change, null to add one. */
  rate: VatRate | null;
  open: boolean;
  onClose: () => void;
}

function VatRateForm({ rate, onClose }: { rate: VatRate | null; onClose: () => void }) {
  const create = useCreateVatRate();
  const update = useUpdateVatRate();
  const { toast } = useToast();
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm<VatRateValues>({
    resolver: zodResolver(vatRateSchema),
    defaultValues: {
      name: rate?.name ?? '',
      code: rate?.code ?? 'standard',
      rate: rate ? bpToPercentInput(rate.rate_bp) : '',
      is_default: false,
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<VatRateValues>({ setError, fields: FIELDS });
  const code = useWatch({ control, name: 'code' });
  // Zero rated, exempt and outside scope charge no VAT: their rate is 0% and not typed.
  const rateLocked = ZERO_RATE_CODES.has(code);
  const saving = create.isPending || update.isPending;

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const rateBp = parsePercentToBp(values.rate) ?? 0;
    const onError = (error: unknown) => handleSubmitError(toBillingFormError(error, FIELD_NAMES));

    if (!rate) {
      const body: VatRateCreate = { name: values.name, code: values.code, rate_bp: rateBp };
      if (values.is_default) body.is_default = true;
      create.mutate(body, {
        onSuccess: (created) => {
          toast({ tone: 'success', title: `${created.name} added` });
          onClose();
        },
        onError,
      });
      return;
    }

    // PATCH is partial: send only what changed.
    const changes: VatRateUpdate = {};
    if (values.name !== rate.name) changes.name = values.name;
    if (values.code !== rate.code) changes.code = values.code;
    if (rateBp !== rate.rate_bp) changes.rate_bp = rateBp;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    update.mutate(
      { rateId: rate.id, body: changes },
      {
        onSuccess: (saved) => {
          toast({ tone: 'success', title: `${saved.name} saved` });
          onClose();
        },
        onError,
      },
    );
  });

  const onCodeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (ZERO_RATE_CODES.has(event.target.value)) {
      setValue('rate', '0', { shouldDirty: true, shouldValidate: true });
    }
  };

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <Input
          label="Name"
          required
          autoComplete="off"
          hint="Shown wherever a VAT code is chosen, for example Standard 20%."
          error={errors.name?.message}
          {...register('name')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Code"
            options={VAT_CODE_OPTIONS}
            error={errors.code?.message}
            {...register('code', { onChange: onCodeChange })}
          />
          <Input
            label="Rate (%)"
            required={!rateLocked}
            inputMode="decimal"
            autoComplete="off"
            disabled={rateLocked}
            hint={
              rateLocked
                ? 'Zero rated, exempt and outside scope always charge 0%.'
                : rate
                  ? 'Issued invoices keep the rate they were issued with; the new rate applies from now on.'
                  : 'For example 20, or 5.5. At most two decimals.'
            }
            error={errors.rate?.message}
            {...register('rate')}
          />
        </div>
        {rate ? null : (
          <Checkbox
            label="Make this the default VAT code"
            description="Used when nothing more specific applies. The current default is unset."
            {...register('is_default')}
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
          loading={saving}
          disabled={(rate !== null && !isDirty) || retryIn > 0}
        >
          {rate ? 'Save VAT code' : 'Add VAT code'}
        </Button>
      </DialogActions>
    </>
  );
}

/** Add a VAT code, or change one: its name, code (treatment) and rate. */
export function VatRateFormPanel({ rate, open, onClose }: VatRateFormPanelProps) {
  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title={rate ? 'Edit VAT code' : 'Add VAT code'}
      description={
        rate
          ? rate.name
          : 'A VAT treatment and rate that invoice lines, services and expenses can use.'
      }
    >
      {open ? <VatRateForm key={rate?.id ?? 'new'} rate={rate} onClose={onClose} /> : null}
    </FormPanel>
  );
}
