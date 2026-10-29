import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Modal, Textarea, useToast } from '@/components/ui';
import type { IsoDate } from '@/types/api';
import { formatUkDate } from '@/utils/dates';

import { useReopenPeriod } from '../../api/adminHooks';
import { REASON_MAX, unlockSchema, type UnlockValues } from '../../schemas/admin';
import { DialogActions } from '../DialogActions';

const FIELDS = ['reason'] as const;

/** What the dialog needs of a locked period: a `LockedPeriod` or a locked row of the grid. */
export interface ReopenTarget {
  /** The lock to unlock. */
  id: string;
  label: string;
  start_date: IsoDate;
  end_date: IsoDate;
}

function UnlockForm({ period, onClose }: { period: ReopenTarget; onClose: () => void }) {
  const { toast } = useToast();
  const unlock = useReopenPeriod();
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<UnlockValues>({
    resolver: zodResolver(unlockSchema),
    defaultValues: { reason: '' },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<UnlockValues>({ setError, fields: FIELDS });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    unlock.mutate(
      { lock_id: period.id, reason: values.reason },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: `${period.label} unlocked` });
          onClose();
        },
        onError: handleSubmitError,
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
          {period.label} runs {formatUkDate(period.start_date)} to {formatUkDate(period.end_date)}.
          Once it is unlocked, time, expenses and WIP dated inside it can be changed again. Lock it
          again when you are done.
        </p>
        <Textarea
          label="Reason"
          required
          rows={3}
          maxLength={REASON_MAX}
          hint="Required. It is kept in the history with your name."
          error={errors.reason?.message}
          {...register('reason')}
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
          loading={unlock.isPending}
          disabled={retryIn > 0}
        >
          Unlock period
        </Button>
      </DialogActions>
    </>
  );
}

export interface ReopenDialogProps {
  /** The locked period to unlock; the dialog is closed while it is null. */
  period: ReopenTarget | null;
  onClose: () => void;
}

/** Unlock one locked period so its days can be changed, saying why. */
export function ReopenDialog({ period, onClose }: ReopenDialogProps) {
  return (
    <Modal
      open={period !== null}
      onClose={onClose}
      title={period ? `Unlock ${period.label}` : 'Unlock a period'}
      description="Opens this period again. Other locked periods stay locked."
      size="md"
      closeOnBackdrop={false}
    >
      {period ? <UnlockForm period={period} onClose={onClose} /> : null}
    </Modal>
  );
}
