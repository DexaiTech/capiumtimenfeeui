import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useMemo, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Modal, Textarea } from '@/components/ui';

import { reasonSchema, type ReasonValues } from '../schemas/forms';
import { toFormError } from '../utils/errors';
import { DialogActions } from './DialogActions';

export interface ReasonDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  /** Label of the reason field. */
  label: string;
  hint?: ReactNode;
  /** Whether the action refuses an empty reason (a void, a rejection, a reversal). */
  required?: boolean;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  /** Runs the action; rejects with the API error, which the dialog shows and stays open. */
  onSubmit: (reason: string) => Promise<unknown>;
  /** What the action does, above the field. */
  children?: ReactNode;
}

function ReasonForm({
  label,
  hint,
  required = true,
  confirmLabel,
  tone = 'danger',
  onSubmit,
  onClose,
  children,
}: Omit<ReasonDialogProps, 'open' | 'title' | 'description'>) {
  const formId = useId();
  const schema = useMemo(() => reasonSchema(required), [required]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ReasonValues>({ resolver: zodResolver(schema), defaultValues: { reason: '' } });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } = useSubmitError<ReasonValues>(
    { setError, fields: ['reason'] },
  );

  const submit = handleSubmit(async (values) => {
    clearSubmitError();
    try {
      await onSubmit(values.reason);
      onClose();
    } catch (error) {
      handleSubmitError(toFormError(error));
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
        {children ? <div className="text-sm text-text-muted">{children}</div> : null}
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
        <Button
          type="submit"
          form={formId}
          variant={tone === 'danger' ? 'danger' : 'primary'}
          loading={isSubmitting}
          disabled={retryIn > 0}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </>
  );
}

/**
 * A confirmation that asks why: voiding an invoice, rejecting one, reversing a payment. The
 * reason is required unless `required` is false; a refusal from the API is shown in the dialog.
 */
export function ReasonDialog({ open, onClose, title, description, ...form }: ReasonDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} closeOnBackdrop={false}>
      {open ? <ReasonForm {...form} onClose={onClose} /> : null}
    </Modal>
  );
}
