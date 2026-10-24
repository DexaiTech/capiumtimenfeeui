import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Checkbox, Input, FormPanel, Select, useToast } from '@/components/ui';
import { useVatCodes, type VatCode } from '@/features/team';
import { formatBasisPoints } from '@/utils/money';

import { useSaveExpenseType } from '../api';
import { LIMITS } from '../constants';
import { expenseTypeSchema, type ExpenseTypeValues } from '../schemas/forms';
import type { ExpenseType, ExpenseTypeCreate, ExpenseTypeUpdate } from '../types';
import { toFormError } from '../utils/errors';
import { DialogActions } from './DialogActions';

const FIELDS = [
  'name',
  'code',
  'default_vat_rate_id',
  'is_mileage',
  'default_billable',
  'is_active',
] as const;

/** The live VAT codes, and the one the type already has. */
function vatOptions(codes: VatCode[] | undefined, current: string | null) {
  const live = (codes ?? []).filter((code) => !code.is_archived || code.id === current);
  return [
    { value: '', label: 'No default VAT code' },
    ...live.map((code) => ({
      value: code.id,
      label: `${code.name} (${formatBasisPoints(code.rate_bp)})`,
    })),
  ];
}

export interface ExpenseTypeFormPanelProps {
  /** The type to change, null to add one. */
  type: ExpenseType | null;
  open: boolean;
  onClose: () => void;
}

function TypeForm({ type, onClose }: { type: ExpenseType | null; onClose: () => void }) {
  const save = useSaveExpenseType();
  const { toast } = useToast();
  const formId = useId();
  const vatCodes = useVatCodes();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isDirty },
  } = useForm<ExpenseTypeValues>({
    resolver: zodResolver(expenseTypeSchema),
    defaultValues: {
      name: type?.name ?? '',
      code: type?.code ?? '',
      default_vat_rate_id: type?.default_vat_rate_id ?? '',
      is_mileage: type?.is_mileage ?? false,
      default_billable: type?.default_billable ?? true,
      is_active: type?.is_active ?? true,
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<ExpenseTypeValues>({ setError, fields: FIELDS });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const code = values.code.toUpperCase();
    const vat = values.default_vat_rate_id || null;
    const onError = (error: unknown) => handleSubmitError(toFormError(error));

    if (!type) {
      const body: ExpenseTypeCreate = {
        name: values.name,
        code,
        is_mileage: values.is_mileage,
        default_billable: values.default_billable,
        is_active: values.is_active,
      };
      if (vat) body.default_vat_rate_id = vat;
      save.mutate(
        { mode: 'create', body },
        {
          onSuccess: () => {
            toast({ tone: 'success', title: `${values.name} added` });
            onClose();
          },
          onError,
        },
      );
      return;
    }

    // PATCH is partial: send only what changed (null clears the default VAT code).
    const changes: ExpenseTypeUpdate = {};
    if (values.name !== type.name) changes.name = values.name;
    if (code !== type.code) changes.code = code;
    if (vat !== type.default_vat_rate_id) changes.default_vat_rate_id = vat;
    if (values.is_mileage !== type.is_mileage) changes.is_mileage = values.is_mileage;
    if (values.default_billable !== type.default_billable) {
      changes.default_billable = values.default_billable;
    }
    if (values.is_active !== type.is_active) changes.is_active = values.is_active;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    save.mutate(
      { mode: 'update', typeId: type.id, body: changes },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: `${values.name} saved` });
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
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <Input
            label="Name"
            required
            autoComplete="off"
            maxLength={LIMITS.typeName}
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="Code"
            required
            autoComplete="off"
            maxLength={LIMITS.typeCode}
            error={errors.code?.message}
            {...register('code')}
          />
        </div>
        <Select
          label="Default VAT code"
          options={vatOptions(vatCodes.data, type?.default_vat_rate_id ?? null)}
          hint="Prices the VAT of an expense that gives only its net or gross amount."
          error={errors.default_vat_rate_id?.message}
          {...register('default_vat_rate_id')}
        />
        <Controller
          control={control}
          name="is_mileage"
          render={({ field }) => (
            <Checkbox
              label="Priced from miles"
              description={
                type?.is_used
                  ? 'Expenses use this type, so this cannot change.'
                  : 'The amount is the miles driven times the practice mileage rate.'
              }
              checked={field.value}
              disabled={type?.is_used ?? false}
              onChange={(event) => field.onChange(event.target.checked)}
            />
          )}
        />
        <Controller
          control={control}
          name="default_billable"
          render={({ field }) => (
            <Checkbox
              label="Billable by default"
              description="An expense of this type for a client starts as billable."
              checked={field.value}
              onChange={(event) => field.onChange(event.target.checked)}
            />
          )}
        />
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <Checkbox
              label="Active"
              description="An inactive type cannot be chosen for a new expense; the ones that use it keep it."
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
          disabled={(type !== null && !isDirty) || retryIn > 0}
        >
          {type ? 'Save expense type' : 'Add expense type'}
        </Button>
      </DialogActions>
    </>
  );
}

/** Add an expense type, or change one: its code, default VAT, mileage pricing and status. */
export function ExpenseTypeFormPanel({ type, open, onClose }: ExpenseTypeFormPanelProps) {
  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title={type ? 'Edit expense type' : 'Add expense type'}
      description={
        type
          ? `${type.name} · ${type.code}`
          : 'What an expense is for: travel, mileage, a hotel, postage.'
      }
    >
      {open ? <TypeForm key={type?.id ?? 'new'} type={type} onClose={onClose} /> : null}
    </FormPanel>
  );
}
