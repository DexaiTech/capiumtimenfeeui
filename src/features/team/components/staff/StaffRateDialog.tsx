import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import * as z from 'zod';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Checkbox, Input, Modal, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { todayInZone } from '@/utils/dates';
import { parsePounds } from '@/utils/money';

import { useCreateRateRule } from '../../api';
import { RATE_KIND_LABEL } from '../../constants';
import { requiredRateText } from '../../schemas/common';
import type { RateKind, StaffMember } from '../../types';
import { conflictsOf, toFormError } from '../../utils/errors';
import { formatPeriod } from '../../utils/format';
import { DialogActions } from '../DialogActions';

const schema = z.object({
  rate: requiredRateText('Enter the rate in pounds per hour, for example 95.00'),
  effective_from: z.string().min(1, 'Enter the date the rate starts'),
  close_previous: z.boolean(),
});
type Values = z.infer<typeof schema>;
const FIELDS = ['rate', 'effective_from'] as const;

export interface StaffRateDialogProps {
  /** The person the rate is for; null keeps the dialog closed. */
  staff: StaffMember | null;
  kind: RateKind;
  onClose: () => void;
}

function RateForm({
  staff,
  kind,
  onClose,
}: {
  staff: StaffMember;
  kind: RateKind;
  onClose: () => void;
}) {
  const { organization } = useOrg();
  const create = useCreateRateRule();
  const { toast } = useToast();
  const formId = useId();
  const label = kind === 'cost' ? 'cost rate' : 'charge-out rate';
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      rate: '',
      effective_from: todayInZone(organization.timezone),
      close_previous: true,
    },
  });
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;
  const { submitError, retryIn, handleSubmitError, clearSubmitError } = useSubmitError<Values>({
    setError,
    fields: FIELDS,
  });
  const failure = create.error;

  const onSubmit = handleSubmit(async (values) => {
    clearSubmitError();
    const pence = parsePounds(values.rate);
    if (pence === null) return;
    try {
      await create.mutateAsync({
        kind,
        user_id: staff.id,
        rate: pence,
        effective_from: values.effective_from,
        close_previous: values.close_previous,
      });
    } catch (error) {
      handleSubmitError(toFormError(error));
      return;
    }
    toast({ tone: 'success', title: `${staff.full_name}: ${label} saved` });
    onClose();
  });

  const conflicts = conflictsOf(failure);

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Rate (£ per hour)"
            required
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            error={errors.rate?.message}
            {...register('rate')}
          />
          <Input
            label="Starts on"
            required
            type="date"
            error={errors.effective_from?.message}
            {...register('effective_from')}
          />
        </div>
        <Controller
          control={control}
          name="close_previous"
          render={({ field }) => (
            <Checkbox
              label="End the current rate the day before"
              description="Otherwise a rate that is already running for this person stops the new one (409)."
              checked={field.value}
              onChange={(event) => field.onChange(event.target.checked)}
            />
          )}
        />
        {conflicts.length > 0 ? (
          <ul aria-label="Rates in the way" className="list-disc pl-5 text-sm text-text">
            {conflicts.map((conflict) => (
              <li key={conflict.id}>
                {formatPeriod(conflict.effective_from, conflict.effective_to)}
              </li>
            ))}
          </ul>
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
          loading={isSubmitting}
          disabled={retryIn > 0}
        >
          Save rate
        </Button>
      </DialogActions>
    </>
  );
}

/** "Set a cost rate / charge-out rate" for one person, from their own page (`rate.manage`). */
export function StaffRateDialog({ staff, kind, onClose }: StaffRateDialogProps) {
  return (
    <Modal
      open={staff !== null}
      onClose={onClose}
      title={`${staff?.full_name ?? ''}: new ${RATE_KIND_LABEL[kind].toLowerCase()}`}
      description="The rate applies from the date you choose. Time already recorded keeps its rate until you re-rate it."
      closeOnBackdrop={false}
    >
      {staff ? (
        <RateForm key={`${staff.id}-${kind}`} staff={staff} kind={kind} onClose={onClose} />
      ) : null}
    </Modal>
  );
}
