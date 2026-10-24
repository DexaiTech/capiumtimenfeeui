import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Checkbox, Input, Modal, Select, Textarea, useToast } from '@/components/ui';

import { useCreateActivityType, useUpdateActivityType, useVatCodes } from '../../api';
import { activityTypeSchema, type ActivityTypeValues } from '../../schemas/catalogue';
import type { ActivityType, ActivityTypeCreate, ActivityTypeUpdate } from '../../types';
import { toFormError } from '../../utils/errors';
import { vatOptions } from './vat';
import { DialogActions } from '../DialogActions';

const FIELDS = ['code', 'name', 'is_chargeable', 'vat_rate_id', 'invoice_description'] as const;

export interface ActivityTypeFormDialogProps {
  /** The activity type to change, null to add one. */
  activityType: ActivityType | null;
  /** Names of the services that limit time to this type, shown while editing. */
  linkedServices?: ReadonlyArray<string>;
  open: boolean;
  onClose: () => void;
}

function ActivityTypeForm({
  activityType,
  linkedServices = [],
  onClose,
}: {
  activityType: ActivityType | null;
  linkedServices?: ReadonlyArray<string>;
  onClose: () => void;
}) {
  const create = useCreateActivityType();
  const update = useUpdateActivityType();
  const { toast } = useToast();
  const formId = useId();
  const vatCodes = useVatCodes();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isDirty },
  } = useForm<ActivityTypeValues>({
    resolver: zodResolver(activityTypeSchema),
    defaultValues: {
      code: activityType?.code ?? '',
      name: activityType?.name ?? '',
      is_chargeable: activityType?.is_chargeable ?? true,
      vat_rate_id: activityType?.vat_rate_id ?? '',
      invoice_description: activityType?.invoice_description ?? '',
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<ActivityTypeValues>({ setError, fields: FIELDS });
  const saving = create.isPending || update.isPending;

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const code = values.code.toUpperCase();
    const vat = values.vat_rate_id || null;
    const invoiceText = values.invoice_description || null;
    const onError = (error: unknown) => handleSubmitError(toFormError(error));

    if (!activityType) {
      const body: ActivityTypeCreate = {
        code,
        name: values.name,
        is_chargeable: values.is_chargeable,
      };
      if (vat) body.vat_rate_id = vat;
      if (invoiceText) body.invoice_description = invoiceText;
      create.mutate(body, {
        onSuccess: (created) => {
          toast({ tone: 'success', title: `${created.name} added` });
          onClose();
        },
        onError,
      });
      return;
    }

    // PATCH is partial: send only what changed (null clears the optional fields).
    const changes: ActivityTypeUpdate = {};
    if (code !== activityType.code) changes.code = code;
    if (values.name !== activityType.name) changes.name = values.name;
    if (values.is_chargeable !== activityType.is_chargeable) {
      changes.is_chargeable = values.is_chargeable;
    }
    if (vat !== activityType.vat_rate_id) changes.vat_rate_id = vat;
    if (invoiceText !== activityType.invoice_description) {
      changes.invoice_description = invoiceText;
    }
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    update.mutate(
      { activityId: activityType.id, body: changes },
      {
        onSuccess: (saved) => {
          toast({ tone: 'success', title: `${saved.name} saved` });
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
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="Code"
            required
            autoComplete="off"
            maxLength={12}
            error={errors.code?.message}
            {...register('code')}
          />
        </div>
        <Controller
          control={control}
          name="is_chargeable"
          render={({ field }) => (
            <Checkbox
              label="Billable by default"
              description="Time recorded against this type is billable unless it is changed. Untick for internal time."
              checked={field.value}
              onChange={(event) => field.onChange(event.target.checked)}
            />
          )}
        />
        <Select
          label="VAT code"
          options={vatOptions(vatCodes.data, activityType?.vat_rate_id ?? null)}
          error={errors.vat_rate_id?.message}
          {...register('vat_rate_id')}
        />
        <Textarea
          label="Invoice description"
          rows={2}
          hint="The wording suggested for the line of an invoice."
          error={errors.invoice_description?.message}
          {...register('invoice_description')}
        />
        {activityType ? (
          <p className="text-xs text-text-muted">
            {linkedServices.length > 0
              ? `Time on jobs of ${linkedServices.join(', ')} may only use the activity types those services list. `
              : 'No service limits its time to this activity type. '}
            Link activity types to a service on the Services page.
          </p>
        ) : null}
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
          disabled={(activityType !== null && !isDirty) || retryIn > 0}
        >
          {activityType ? 'Save activity type' : 'Add activity type'}
        </Button>
      </DialogActions>
    </>
  );
}

/** Add an activity type, or change one: whether its time is billable by default, VAT and invoice wording. */
export function ActivityTypeFormDialog({
  activityType,
  linkedServices,
  open,
  onClose,
}: ActivityTypeFormDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={activityType ? 'Edit activity type' : 'Add activity type'}
      description={
        activityType
          ? `${activityType.name} · ${activityType.code}`
          : 'What a piece of time was spent on. It decides whether the time is billable by default.'
      }
      size="lg"
      closeOnBackdrop={false}
    >
      {open ? (
        <ActivityTypeForm
          key={activityType?.id ?? 'new'}
          activityType={activityType}
          linkedServices={linkedServices}
          onClose={onClose}
        />
      ) : null}
    </Modal>
  );
}
