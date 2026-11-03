import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import * as z from 'zod';

import { FormAlert, useSubmitError } from '@/components/forms';
import {
  Button,
  Checkbox,
  Input,
  FormPanel,
  useToast,
  type ConfirmDialogError,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { todayInZone } from '@/utils/dates';
import { parsePounds } from '@/utils/money';

import { useCreateRateRule, useRateImpact } from '../../api';
import { RATE_KIND_LABEL } from '../../constants';
import { requiredRateText } from '../../schemas/common';
import type { RateImpact, RateKind, RateRuleCreate, StaffMember } from '../../types';
import { conflictsOf, dialogError, toFormError } from '../../utils/errors';
import { formatPeriod, formatRate } from '../../utils/format';
import { DialogActions } from '../DialogActions';
import { RateImpactDialog } from '../rates/RateImpactDialog';

const schema = z.object({
  rate: requiredRateText('Enter the rate in pounds per hour, for example 95.00'),
  effective_from: z.string().min(1, 'Enter the date the rate starts'),
  close_previous: z.boolean(),
});
type Values = z.infer<typeof schema>;
const FIELDS = ['rate', 'effective_from'] as const;

export interface StaffRatePanelProps {
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
  const impact = useRateImpact();
  // A save that changes other rates or re-prices time waits here for the pop-up's answer.
  const [pending, setPending] = useState<{ body: RateRuleCreate; impact: RateImpact } | null>(null);
  const [refusal, setRefusal] = useState<ConfirmDialogError | null>(null);
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
  const failure = impact.error ?? create.error;

  const saved = () => {
    toast({ tone: 'success', title: `${staff.full_name}: ${label} saved` });
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    clearSubmitError();
    const pence = parsePounds(values.rate);
    if (pence === null) return;
    const body: RateRuleCreate = {
      kind,
      user_id: staff.id,
      rate: pence,
      effective_from: values.effective_from,
      close_previous: values.close_previous,
    };
    try {
      // Asked first: the rates around the new one and the time it would re-price.
      const found = await impact.mutateAsync(body);
      if (found.needs_confirmation) {
        setRefusal(null);
        setPending({ body, impact: found });
        return;
      }
      await create.mutateAsync(body);
    } catch (error) {
      handleSubmitError(toFormError(error));
      return;
    }
    saved();
  });

  const confirm = () => {
    if (!pending) return;
    setRefusal(null);
    create.mutate(
      { ...pending.body, confirm_impact: true },
      { onSuccess: saved, onError: (error) => setRefusal(dialogError(error)) },
    );
  };

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
              description="Otherwise you are asked before a rate that is already running for this person ends."
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
      <RateImpactDialog
        impact={pending?.impact ?? null}
        subject={`${staff.full_name}'s new ${label} of ${formatRate(pending?.body.rate)}`}
        onConfirm={confirm}
        onClose={() => setPending(null)}
        loading={create.isPending}
        error={refusal}
      />
    </>
  );
}

/** "Set a cost rate / charge-out rate" for one person, from their own page (`rate.manage`). */
export function StaffRatePanel({ staff, kind, onClose }: StaffRatePanelProps) {
  return (
    <FormPanel
      open={staff !== null}
      onClose={onClose}
      title={`${staff?.full_name ?? ''}: new ${RATE_KIND_LABEL[kind].toLowerCase()}`}
      description="The rate applies from the date you choose. Time already recorded keeps its rate until you re-rate it."
    >
      {staff ? (
        <RateForm key={`${staff.id}-${kind}`} staff={staff} kind={kind} onClose={onClose} />
      ) : null}
    </FormPanel>
  );
}
