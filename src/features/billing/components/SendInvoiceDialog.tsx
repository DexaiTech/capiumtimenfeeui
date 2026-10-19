import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Modal, Skeleton, Textarea, useToast } from '@/components/ui';
import { useSendInvoice, useClientBilling } from '../api';
import { sendSchema, splitEmails, type SendValues } from '../schemas/forms';
import type { InvoiceSummary } from '../types';
import { toFormError } from '../utils/errors';
import { clientLabel } from '../utils/format';
import { DialogActions } from './DialogActions';

export interface SendInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: Pick<InvoiceSummary, 'id' | 'number' | 'client'>;
}

function SendForm({
  invoice,
  defaultTo,
  onClose,
}: Omit<SendInvoiceDialogProps, 'open'> & { defaultTo: string }) {
  const { toast } = useToast();
  const send = useSendInvoice();
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SendValues>({ resolver: zodResolver(sendSchema), defaultValues: { to: defaultTo } });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } = useSubmitError<SendValues>({
    setError,
    fields: ['to'],
  });

  const submit = handleSubmit((values) => {
    clearSubmitError();
    const emails = splitEmails(values.to);
    send.mutate(
      { invoiceId: invoice.id, to: emails.length > 0 ? emails : undefined },
      {
        onSuccess: (result) => {
          toast({
            tone: 'success',
            title: result.queued ? 'Invoice email queued' : 'Invoice email already queued',
            description:
              result.to.length > 0
                ? `The PDF goes to ${result.to.join(', ')}.`
                : 'The PDF goes to the client’s billing contacts.',
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
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-4"
      >
        <Textarea
          label="To"
          rows={2}
          autoComplete="off"
          hint="Separate addresses with commas. Empty: the client's invoice email, else its billing contacts."
          error={errors.to?.message}
          {...register('to')}
        />
        <p className="text-xs text-text-muted">
          The email is built from the practice's Invoice email template (Settings → Email
          templates) and carries the invoice as a PDF.
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
          loading={send.isPending}
          disabled={retryIn > 0}
        >
          Send email
        </Button>
      </DialogActions>
    </>
  );
}

function SendBody(props: Omit<SendInvoiceDialogProps, 'open'>) {
  const billing = useClientBilling(props.invoice.client?.id ?? null);
  if (billing.isLoading) return <Skeleton className="h-20 w-full" />;
  return <SendForm {...props} defaultTo={billing.data?.invoice_email ?? ''} />;
}

/** Emails an issued invoice as a PDF to the addresses given, or to the client's own. */
export function SendInvoiceDialog({ open, onClose, invoice }: SendInvoiceDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send invoice by email"
      description={`${invoice.number ?? 'Invoice'} · ${clientLabel(invoice.client)}`}
      closeOnBackdrop={false}
    >
      {open ? <SendBody invoice={invoice} onClose={onClose} /> : null}
    </Modal>
  );
}
