import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Modal, Textarea } from '@/components/ui';

import { reasonText } from '../schemas/entry';
import { toFormError } from '../utils/errors';
import { DialogActions } from './DialogActions';

interface ReasonValues {
  reason: string;
}

export interface ReasonDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  label?: string;
  hint?: string;
  submitLabel: string;
  /** What the field says when it is left empty. */
  requiredMessage: string;
  /** Sends the reason; a refusal (an `ApiError`) is shown in the dialog, which stays open. */
  onSubmit: (reason: string) => Promise<unknown>;
}

function ReasonForm({
  label = 'Reason',
  hint,
  submitLabel,
  requiredMessage,
  onSubmit,
  onClose,
}: Omit<ReasonDialogProps, 'open' | 'title' | 'description'>) {
  const formId = useId();
  const schema = useMemo(
    () => z.object({ reason: reasonText(requiredMessage) }),
    [requiredMessage],
  );
  const [sending, setSending] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ReasonValues>({ resolver: zodResolver(schema), defaultValues: { reason: '' } });
  const { submitError, handleSubmitError, clearSubmitError } = useSubmitError<ReasonValues>({
    setError,
    fields: ['reason'],
  });

  const submit = handleSubmit(async (values) => {
    clearSubmitError();
    setSending(true);
    try {
      await onSubmit(values.reason);
      onClose();
    } catch (error) {
      handleSubmitError(toFormError(error, { decision_note: 'reason' }));
      setSending(false);
    }
  });

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-4"
      >
        <Textarea
          label={label}
          rows={3}
          hint={hint}
          error={errors.reason?.message}
          {...register('reason')}
        />
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form={formId} variant="primary" loading={sending}>
          {submitLabel}
        </Button>
      </DialogActions>
    </>
  );
}

/** A dialog that asks for a reason before it acts (returning a timesheet). */
export function ReasonDialog({ open, onClose, title, description, ...form }: ReasonDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      closeOnBackdrop={false}
    >
      {open ? <ReasonForm {...form} onClose={onClose} /> : null}
    </Modal>
  );
}
