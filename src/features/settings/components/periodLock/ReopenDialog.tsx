import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Input, Modal, SegmentedControl, Textarea, useToast } from '@/components/ui';
import { dayBefore, formatUkDate } from '@/utils/dates';

import { useReopenPeriod } from '../../api/adminHooks';
import {
  reopenSchema,
  REASON_MAX,
  type ReopenValues,
  type REOPEN_MODES,
} from '../../schemas/admin';
import { DialogActions } from '../DialogActions';

const FIELDS = ['reopen_to', 'reason'] as const;

const MODES: ReadonlyArray<{ value: (typeof REOPEN_MODES)[number]; label: string }> = [
  { value: 'to_date', label: 'Move the lock back' },
  { value: 'remove', label: 'Remove the lock' },
];

function ReopenForm({ currentLock, onClose }: { currentLock: string; onClose: () => void }) {
  const { toast } = useToast();
  const reopen = useReopenPeriod();
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<ReopenValues>({
    resolver: zodResolver(reopenSchema(currentLock)),
    defaultValues: { mode: 'to_date', reopen_to: '', reason: '' },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<ReopenValues>({ setError, fields: FIELDS });
  const mode = useWatch({ control, name: 'mode' });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const target = values.mode === 'remove' ? null : values.reopen_to;
    reopen.mutate(
      { reopen_to: target, reason: values.reason },
      {
        onSuccess: () => {
          toast({
            tone: 'success',
            title: target ? `Period reopened to ${formatUkDate(target)}` : 'Lock removed',
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
        <SegmentedControl
          label="What to reopen"
          options={MODES}
          value={mode}
          onChange={(value) => setValue('mode', value, { shouldValidate: false })}
        />
        {mode === 'to_date' ? (
          <Input
            label="New last locked day"
            required
            type="date"
            max={dayBefore(currentLock)}
            hint={`Now locked through ${formatUkDate(currentLock)}. Days after the one you choose are open again.`}
            error={errors.reopen_to?.message}
            {...register('reopen_to')}
          />
        ) : (
          <p className="text-sm text-text-muted">
            Nothing will be locked: every day is open again, back to the first.
          </p>
        )}
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
          loading={reopen.isPending}
          disabled={retryIn > 0}
        >
          Reopen period
        </Button>
      </DialogActions>
    </>
  );
}

export interface ReopenDialogProps {
  open: boolean;
  onClose: () => void;
  /** The day the practice is locked through now. */
  currentLock: string;
}

/** Move the lock back to an earlier day, or remove it, saying why. */
export function ReopenDialog({ open, onClose, currentLock }: ReopenDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reopen a period"
      description="Moves the lock back so the days after it can be changed again."
      size="md"
      closeOnBackdrop={false}
    >
      {open ? <ReopenForm currentLock={currentLock} onClose={onClose} /> : null}
    </Modal>
  );
}
