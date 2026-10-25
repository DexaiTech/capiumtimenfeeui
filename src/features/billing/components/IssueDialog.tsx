import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Checkbox, Input, Modal, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { todayInZone } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { useClientBilling, useIssueInvoice, useSendInvoice } from '../api';
import { issueSchema, type IssueValues } from '../schemas/forms';
import type { InvoiceDetail, InvoiceSummary } from '../types';
import { toFormError } from '../utils/errors';
import { clientLabel } from '../utils/format';
import { DialogActions } from './DialogActions';

export interface IssueDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: Pick<InvoiceSummary, 'id' | 'issue_date' | 'due_date' | 'gross_total' | 'client'>;
  onIssued?: (invoice: InvoiceDetail) => void;
}

function IssueForm({ invoice, onClose, onIssued }: Omit<IssueDialogProps, 'open'>) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const issue = useIssueInvoice();
  const send = useSendInvoice();
  const formId = useId();
  // The usual next step is to email it: offered here, and on when the client has an invoice email.
  const billing = useClientBilling(invoice.client?.id ?? null);
  const invoiceEmail = billing.data?.invoice_email ?? '';
  const [sendChoice, setSendChoice] = useState<boolean | null>(null);
  const sendAfter = sendChoice ?? invoiceEmail !== '';
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<IssueValues>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      issue_date: invoice.issue_date ?? todayInZone(organization.timezone),
      due_date: invoice.due_date ?? '',
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } = useSubmitError<IssueValues>(
    { setError, fields: ['issue_date', 'due_date'] },
  );

  const submit = handleSubmit((values) => {
    clearSubmitError();
    issue.mutate(
      {
        invoiceId: invoice.id,
        body: {
          issue_date: values.issue_date,
          ...(values.due_date ? { due_date: values.due_date } : {}),
        },
      },
      {
        onSuccess: (issued) => {
          toast({
            tone: 'success',
            title: issued.number ? `Invoice ${issued.number} issued` : 'Invoice issued',
            description: `${formatMoney(issued.gross_total, issued.currency)} to ${issued.client?.name ?? 'the client'}`,
          });
          if (sendAfter) {
            send.mutate(
              { invoiceId: issued.id },
              {
                onSuccess: (result) =>
                  toast({
                    tone: 'success',
                    title: result.queued ? 'Invoice email queued' : 'Invoice email already queued',
                    description:
                      result.to.length > 0
                        ? `The PDF goes to ${result.to.join(', ')}.`
                        : 'The PDF goes to the client’s billing contacts.',
                  }),
                onError: () =>
                  toast({
                    tone: 'error',
                    title: 'The invoice was issued, but the email was not sent',
                    description: 'Send it from the invoice page.',
                  }),
              },
            );
          }
          onIssued?.(issued);
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
        <p className="text-sm text-text-muted">
          Issuing numbers the invoice for {clientLabel(invoice.client)} (
          {formatMoney(invoice.gross_total, organization.currency)} including VAT), bills the work
          on it and locks it for editing. To correct it afterwards, raise a credit note.
        </p>
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
            hint="Empty: the issue date plus the client's payment terms."
            error={errors.due_date?.message}
            {...register('due_date')}
          />
        </div>
        <Checkbox
          label="Email it to the client after issuing"
          description={
            invoiceEmail
              ? `The PDF goes to ${invoiceEmail}.`
              : 'The client has no invoice email: it goes to the billing contacts, if there are any.'
          }
          checked={sendAfter}
          onChange={(event) => setSendChoice(event.target.checked)}
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
          loading={issue.isPending}
          disabled={retryIn > 0}
        >
          {sendAfter ? 'Issue and send' : 'Issue invoice'}
        </Button>
      </DialogActions>
    </>
  );
}

/** Confirms issuing a draft, with the issue date and an optional due date. */
export function IssueDialog({ open, onClose, invoice, onIssued }: IssueDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Issue invoice?" closeOnBackdrop={false}>
      {open ? <IssueForm invoice={invoice} onClose={onClose} onIssued={onIssued} /> : null}
    </Modal>
  );
}
