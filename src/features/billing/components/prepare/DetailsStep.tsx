import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Card, Checkbox, Input, Textarea, useToast } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { addDays, todayInZone } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { useCreateInvoice, useIssueInvoice, useSendInvoice, useSubmitInvoice } from '../../api';
import { prepareDetailsSchema, type PrepareDetailsValues } from '../../schemas/forms';
import type { InvoiceCreate, InvoiceDetail } from '../../types';
import { approvalPolicyOf, needsApproval } from '../../utils/approval';
import { describeFailure, toFormError } from '../../utils/errors';
import { plural } from '../../utils/format';
import type { PreviewTotals } from '../../utils/prepare';

type Finish = 'draft' | 'issue' | 'approval';

export interface DetailsStepProps {
  clientName: string;
  /** The client's invoice email; empty when it has none. Issuing then offers to send to it. */
  invoiceEmail?: string;
  /** The client's payment terms in days, else the practice's: the default due date. */
  termsDays: number;
  itemCount: number;
  totals: PreviewTotals;
  /** What the draft request carries besides the header the person fills in. */
  buildRequest: (
    header: Pick<InvoiceCreate, 'issue_date' | 'due_date' | 'reference' | 'notes'>,
  ) => InvoiceCreate;
  onBack: () => void;
}

/** Step three: the dates, the reference and the notes, then the draft is made (and issued or sent). */
export function DetailsStep({
  clientName,
  invoiceEmail = '',
  termsDays,
  itemCount,
  totals,
  buildRequest,
  onBack,
}: DetailsStepProps) {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const navigate = useNavigate();
  const create = useCreateInvoice();
  const issue = useIssueInvoice();
  const submitForApproval = useSubmitInvoice();
  const send = useSendInvoice();
  const [running, setRunning] = useState<Finish | null>(null);
  // Emailing the invoice is the usual next step: on by default when the client has an address.
  const [sendChoice, setSendChoice] = useState<boolean | null>(null);
  const sendAfter = sendChoice ?? invoiceEmail !== '';
  const today = todayInZone(organization.timezone);
  const currency = organization.currency;
  const approval = needsApproval(approvalPolicyOf(organization), totals.gross);
  const canIssue = can(P.invoiceIssue);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PrepareDetailsValues>({
    resolver: zodResolver(prepareDetailsSchema),
    defaultValues: {
      issue_date: today,
      due_date: addDays(today, termsDays),
      reference: '',
      notes: '',
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<PrepareDetailsValues>({
      setError,
      fields: ['issue_date', 'due_date', 'reference', 'notes'],
    });

  const open = (invoice: InvoiceDetail) =>
    void navigate(routes.org.invoice(organization.slug, invoice.id));

  const finish = (how: Finish) =>
    handleSubmit(async (values) => {
      clearSubmitError();
      setRunning(how);
      let draft: InvoiceDetail;
      try {
        draft = await create.mutateAsync(
          buildRequest({
            issue_date: values.issue_date,
            ...(values.due_date ? { due_date: values.due_date } : {}),
            ...(values.reference.trim() ? { reference: values.reference.trim() } : {}),
            ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
          }),
        );
      } catch (error) {
        setRunning(null);
        handleSubmitError(toFormError(error));
        return;
      }

      try {
        if (how === 'issue') {
          const issued = await issue.mutateAsync({
            invoiceId: draft.id,
            body: {
              issue_date: values.issue_date,
              ...(values.due_date ? { due_date: values.due_date } : {}),
            },
          });
          toast({
            tone: 'success',
            title: issued.number ? `Invoice ${issued.number} issued` : 'Invoice issued',
            description: `${formatMoney(issued.gross_total, issued.currency)} to ${clientName}`,
          });
          if (sendAfter) {
            // The invoice is issued either way: a refused email is reported, not undone.
            try {
              const sent = await send.mutateAsync({ invoiceId: issued.id });
              toast({
                tone: 'success',
                title: sent.queued ? 'Invoice email queued' : 'Invoice email already queued',
                description:
                  sent.to.length > 0
                    ? `The PDF goes to ${sent.to.join(', ')}.`
                    : 'The PDF goes to the client’s billing contacts.',
              });
            } catch {
              toast({
                tone: 'warning',
                title: 'The invoice was issued, but the email was not sent',
                description: 'Send it from the invoice page.',
              });
            }
          }
          open(issued);
        } else if (how === 'approval') {
          const submitted = await submitForApproval.mutateAsync({ invoiceId: draft.id });
          toast({
            tone: 'success',
            title: 'Draft sent for approval',
            description: `${formatMoney(submitted.gross_total, submitted.currency)} to ${clientName}`,
          });
          open(submitted);
        } else {
          toast({
            tone: 'success',
            title: 'Draft invoice saved',
            description: `${formatMoney(draft.gross_total, draft.currency)} to ${clientName}`,
          });
          open(draft);
        }
      } catch (error) {
        // The draft exists: carry on from it rather than prepare it again.
        toast({
          tone: 'warning',
          ...describeFailure(
            error,
            how === 'issue'
              ? 'The draft was saved but not issued'
              : 'The draft was saved but not sent',
          ),
        });
        open(draft);
      }
    })();

  const busy = running !== null;

  return (
    <div className="flex flex-col gap-4">
      <form
        noValidate
        onSubmit={(event) => event.preventDefault()}
        className="flex flex-col gap-4"
        aria-label="Invoice details"
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
            hint={`${plural(termsDays, 'day', 'days')} after the issue date. Empty: the client's payment terms.`}
            error={errors.due_date?.message}
            {...register('due_date')}
          />
        </div>
        <Input
          label="Reference"
          autoComplete="off"
          hint="The client's purchase order or your own reference."
          error={errors.reference?.message}
          {...register('reference')}
        />
        <Textarea
          label="Notes"
          rows={3}
          hint="Printed on the invoice."
          error={errors.notes?.message}
          {...register('notes')}
        />
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
      </form>

      {canIssue && !approval ? (
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
      ) : null}

      <Card padding="sm" className="flex flex-col gap-1">
        <p className="text-sm text-text">
          {plural(itemCount, 'item', 'items')} for {clientName}: about{' '}
          <strong>{formatMoney(totals.gross, currency)}</strong> including VAT.
        </p>
        {approval ? (
          <p className="text-xs text-text-muted">
            This practice approves invoices before they are issued: the draft is sent for approval.
          </p>
        ) : null}
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          leftIcon={<ArrowLeft aria-hidden="true" className="size-4" />}
          disabled={busy}
          onClick={onBack}
        >
          Back to the lines
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            variant={approval || canIssue ? 'secondary' : 'primary'}
            loading={running === 'draft'}
            disabled={busy || retryIn > 0}
            onClick={() => void finish('draft')}
          >
            Save as draft
          </Button>
          {approval ? (
            <Button
              variant="primary"
              loading={running === 'approval'}
              disabled={busy || retryIn > 0}
              onClick={() => void finish('approval')}
            >
              Save and send for approval
            </Button>
          ) : canIssue ? (
            <Button
              variant="primary"
              loading={running === 'issue'}
              disabled={busy || retryIn > 0}
              onClick={() => void finish('issue')}
            >
              {sendAfter ? 'Save, issue and send' : 'Save and issue'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
