import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Input, Modal, Textarea, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { addDays, formatUkDate, todayInZone } from '@/utils/dates';

import { useLockPeriod } from '../../api/adminHooks';
import { lockSchema, REASON_MAX, type LockValues } from '../../schemas/admin';
import { lastMonthEnd } from '../../utils/periodLock';
import { DialogActions } from '../DialogActions';

const FIELDS = ['locked_through', 'reason'] as const;

function LockForm({ currentLock, onClose }: { currentLock: string | null; onClose: () => void }) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const lock = useLockPeriod();
  const formId = useId();
  const today = todayInZone(organization.timezone);
  const suggested = lastMonthEnd(today);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LockValues>({
    resolver: zodResolver(lockSchema(currentLock, today)),
    defaultValues: {
      // The usual choice: close the month that has just ended.
      locked_through: currentLock === null || suggested > currentLock ? suggested : '',
      reason: '',
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } = useSubmitError<LockValues>({
    setError,
    fields: FIELDS,
  });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    lock.mutate(
      { locked_through: values.locked_through, reason: values.reason || null },
      {
        onSuccess: () => {
          toast({
            tone: 'success',
            title: `Period locked through ${formatUkDate(values.locked_through)}`,
          });
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
        <Input
          label="Lock through"
          type="date"
          min={currentLock ? addDays(currentLock, 1) : undefined}
          max={today}
          hint={
            currentLock
              ? `Now locked through ${formatUkDate(currentLock)}. Choose a later day, up to today.`
              : 'The last day to close, up to today. That day is locked too.'
          }
          error={errors.locked_through?.message}
          {...register('locked_through')}
        />
        <Textarea
          label="Reason (optional)"
          rows={3}
          maxLength={REASON_MAX}
          hint="Kept in the history, for example “March VAT return filed”."
          error={errors.reason?.message}
          {...register('reason')}
        />
        <p className="text-sm text-text-muted">
          The lock applies to everybody, the Owner included. To change closed data a period has to
          be reopened first, with a reason.
        </p>
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
          loading={lock.isPending}
          disabled={retryIn > 0}
        >
          Lock period
        </Button>
      </DialogActions>
    </>
  );
}

export interface LockDialogProps {
  open: boolean;
  onClose: () => void;
  /** The day the practice is locked through now, or null. */
  currentLock: string | null;
}

/** Lock time, expenses and WIP up to a day. The lock only moves forward. */
export function LockDialog({ open, onClose, currentLock }: LockDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lock a period"
      description="Time, expenses and WIP dated on or before the day you choose can no longer be created, changed or deleted."
      size="md"
      closeOnBackdrop={false}
    >
      {open ? <LockForm currentLock={currentLock} onClose={onClose} /> : null}
    </Modal>
  );
}
