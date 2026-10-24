import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Input, FormPanel, Textarea, useToast } from '@/components/ui';

import { useUpdateInvoice } from '../api';
import { headerSchema, type HeaderValues } from '../schemas/forms';
import type { InvoiceDetail, InvoiceHeaderUpdate } from '../types';
import { toFormError } from '../utils/errors';
import { DialogActions } from './DialogActions';

const FIELDS = ['issue_date', 'due_date', 'reference', 'notes'] as const;

export interface InvoiceHeaderPanelProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceDetail;
}

function HeaderForm({ invoice, onClose }: Omit<InvoiceHeaderPanelProps, 'open'>) {
  const { toast } = useToast();
  const update = useUpdateInvoice(invoice.id);
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<HeaderValues>({
    resolver: zodResolver(headerSchema),
    defaultValues: {
      issue_date: invoice.issue_date ?? '',
      due_date: invoice.due_date ?? '',
      reference: invoice.reference ?? '',
      notes: invoice.notes ?? '',
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<HeaderValues>({ setError, fields: FIELDS });

  const submit = handleSubmit((values) => {
    clearSubmitError();
    // PATCH is partial: send only what changed (an empty text clears the field).
    const changes: InvoiceHeaderUpdate = {};
    if (values.issue_date !== (invoice.issue_date ?? '')) changes.issue_date = values.issue_date;
    if (values.due_date !== (invoice.due_date ?? '')) changes.due_date = values.due_date;
    if (values.reference !== (invoice.reference ?? ''))
      changes.reference = values.reference || null;
    if (values.notes !== (invoice.notes ?? '')) changes.notes = values.notes || null;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    update.mutate(changes, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Invoice details saved' });
        onClose();
      },
      onError: (error) => handleSubmitError(toFormError(error)),
    });
  });

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Issue date"
            type="date"
            required
            error={errors.issue_date?.message}
            {...register('issue_date')}
          />
          <Input
            label="Due date"
            type="date"
            required
            error={errors.due_date?.message}
            {...register('due_date')}
          />
        </div>
        <Input
          label="Reference"
          autoComplete="off"
          hint="Printed on the invoice, for example the client's order number."
          error={errors.reference?.message}
          {...register('reference')}
        />
        <Textarea label="Notes" rows={3} error={errors.notes?.message} {...register('notes')} />
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
          loading={update.isPending}
          disabled={!isDirty || retryIn > 0}
        >
          Save details
        </Button>
      </DialogActions>
    </>
  );
}

/** The dates, reference and notes of a draft invoice. */
export function InvoiceHeaderPanel({ open, onClose, invoice }: InvoiceHeaderPanelProps) {
  return (
    <FormPanel open={open} onClose={onClose} title="Edit invoice details">
      {open ? <HeaderForm invoice={invoice} onClose={onClose} /> : null}
    </FormPanel>
  );
}
