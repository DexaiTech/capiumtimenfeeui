import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Input, Modal, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatUkDate, todayInZone } from '@/utils/dates';

import { useEndOvertimeRate } from '../../api';
import { endDateSchema, type EndDateValues } from '../../schemas/rate';
import type { OvertimeRate } from '../../types';
import { toFormError } from '../../utils/errors';
import { formatOvertimeRate, overtimeSubject } from '../../utils/format';
import { DialogActions } from '../DialogActions';

const FIELDS = ['effective_to'] as const;

function EndForm({ rate, onClose }: { rate: OvertimeRate; onClose: () => void }) {
  const { organization } = useOrg();
  const end = useEndOvertimeRate();
  const { toast } = useToast();
  const formId = useId();
  const today = todayInZone(organization.timezone);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EndDateValues>({
    resolver: zodResolver(endDateSchema),
    defaultValues: {
      // Today when the rate has already started, else the day it starts.
      effective_to:
        rate.effective_to ?? (today >= rate.effective_from ? today : rate.effective_from),
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<EndDateValues>({ setError, fields: FIELDS });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    if (values.effective_to < rate.effective_from) {
      setError('effective_to', {
        message: `The rate starts on ${formatUkDate(rate.effective_from)}; it can't end before that`,
      });
      return;
    }
    end.mutate(
      { rateId: rate.id, effectiveTo: values.effective_to },
      {
        onSuccess: () => {
          toast({
            tone: 'success',
            title: `Overtime rate ends on ${formatUkDate(values.effective_to)}`,
          });
          onClose();
        },
        onError: (error) => handleSubmitError(toFormError(error)),
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
        <p className="text-sm text-text-muted">
          <strong className="font-medium text-text">{overtimeSubject(rate)}</strong> at{' '}
          {formatOvertimeRate(rate)}, from {formatUkDate(rate.effective_from)}. The rate applies up
          to and including the last day you choose.
        </p>
        <Input
          label="Last day of the rate"
          required
          type="date"
          min={rate.effective_from}
          error={errors.effective_to?.message}
          {...register('effective_to')}
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
          loading={end.isPending}
          disabled={retryIn > 0}
        >
          End-date rate
        </Button>
      </DialogActions>
    </>
  );
}

export interface EndOvertimeRateDialogProps {
  /** The rate to end; null while the dialog is closed. */
  rate: OvertimeRate | null;
  onClose: () => void;
}

/** Sets the last day an overtime rate applies (the `EndDateDialog` of the overtime rates). */
export function EndOvertimeRateDialog({ rate, onClose }: EndOvertimeRateDialogProps) {
  return (
    <Modal
      open={rate !== null}
      onClose={onClose}
      title="End-date rate"
      description={rate ? `Overtime rate · ${overtimeSubject(rate)}` : undefined}
      size="md"
      closeOnBackdrop={false}
    >
      {rate ? <EndForm key={rate.id} rate={rate} onClose={onClose} /> : null}
    </Modal>
  );
}
