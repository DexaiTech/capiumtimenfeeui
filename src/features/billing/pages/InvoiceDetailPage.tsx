import { ArrowLeft, CircleAlert, Ellipsis, FileDown, Info, SearchX } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router';

import {
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Dropdown,
  EmptyState,
  Skeleton,
  useToast,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useBeforeUnload } from '@/features/settings';
import { useDocumentTitle } from '@/hooks';
import { isApiError } from '@/services/api';
import { todayInZone } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import {
  billingApi,
  useDeleteInvoice,
  useInvoice,
  useRemoveAllocation,
  useSubmitInvoice,
  useVoidInvoice,
} from '../api';
import { InvoiceStatusBadge } from '../components/badges';
import { CreditNotePanel } from '../components/CreditNotePanel';
import { InvoiceHeaderPanel } from '../components/InvoiceHeaderPanel';
import {
  InvoiceCreditNotesCard,
  InvoiceDetailsCard,
  InvoicePaymentsCard,
  InvoiceWipCard,
} from '../components/invoice/InvoiceInfoCards';
import { AssignTimeDialog } from '../components/invoice/AssignTimeDialog';
import {
  ApproveInvoiceDialog,
  RejectInvoiceDialog,
} from '../components/invoice/InvoiceDecisionDialogs';
import { InvoiceAdvanceCard } from '../components/invoice/InvoiceAdvanceCard';
import { InvoiceLinesCard } from '../components/invoice/InvoiceLinesCard';
import { InvoiceSummaryStrip } from '../components/invoice/InvoiceSummaryStrip';
import { InvoiceTimeline } from '../components/invoice/InvoiceTimeline';
import { IssueDialog } from '../components/IssueDialog';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { PaymentDetailDialog } from '../components/payments/PaymentDetailDialog';
import { ReasonDialog } from '../components/ReasonDialog';
import { RecordPaymentPanel } from '../components/RecordPaymentPanel';
import { SendInvoiceDialog } from '../components/SendInvoiceDialog';
import { useFileDownload } from '../hooks/useFileDownload';
import type { InvoiceDetail, InvoiceLine } from '../types';
import { dialogError } from '../utils/errors';
import { dateCell } from '../utils/format';

type DialogState =
  | { type: 'issue' }
  | { type: 'submit' }
  | { type: 'approve' }
  | { type: 'reject' }
  | { type: 'send' }
  | { type: 'details' }
  | { type: 'void' }
  | { type: 'delete' }
  | { type: 'credit' }
  | { type: 'payment' }
  | { type: 'unmatch'; payment: InvoiceDetail['payments'][number] }
  | { type: 'allocate'; paymentId: string }
  | { type: 'assign'; line: InvoiceLine }
  | null;

/** A status message above the figures: what the invoice's state means for what can be done. */
function Notice({ tone, children }: { tone: 'info' | 'warning'; children: ReactNode }) {
  const Icon = tone === 'info' ? Info : CircleAlert;
  return (
    <div
      role="status"
      className={
        tone === 'info'
          ? 'flex items-start gap-2.5 rounded-lg border border-info/30 bg-info-soft px-3.5 py-3 text-sm text-text'
          : 'flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning-soft px-3.5 py-3 text-sm text-text'
      }
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function BackLink() {
  const { organization } = useOrg();
  return (
    <Link
      to={routes.org.invoices(organization.slug)}
      className="inline-flex items-center gap-1 self-start text-xs font-medium text-brand-text hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-3.5" />
      Invoices
    </Link>
  );
}

function InvoiceView({ invoice }: { invoice: InvoiceDetail }) {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { busy, download } = useFileDownload();
  const voidInvoice = useVoidInvoice();
  const removeInvoice = useDeleteInvoice();
  const unmatch = useRemoveAllocation();
  const submit = useSubmitInvoice();
  const [searchParams, setSearchParams] = useSearchParams();
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  // The draft is issued as saved: not while its lines have changes not saved yet.
  const [linesDirty, setLinesDirty] = useState(false);
  // Leaving the page (or closing the tab) drops those changes: ask first. A deleted draft leaves.
  const leaving = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      linesDirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useBeforeUnload(linesDirty);

  const slug = organization.slug;
  const today = todayInZone(organization.timezone);
  const isDraft = invoice.status === 'draft';
  const isAwaiting = invoice.status === 'awaiting_approval';
  const isApproved = invoice.status === 'approved';
  const isIssued = invoice.status === 'issued';
  const isVoid = invoice.status === 'void';
  // The API says whether the draft needs approval under the practice's settings (its saved total).
  const approvalNeeded = isDraft && invoice.approval_required;
  const canEdit = isDraft && can(P.invoiceCreate);
  // A draft that needs no approval is issued as it is; one that needs it, once it is approved.
  const canIssue = can(P.invoiceIssue) && ((isDraft && !approvalNeeded) || isApproved);
  const canSubmit = approvalNeeded && can(P.invoiceCreate);
  // The API decides who may approve: not whoever prepared or submitted it (unless the Owner).
  const canApprove = isAwaiting && invoice.can_approve;
  // Any approver may send it back to draft, the submitter too, until it is issued.
  const canReject = (isAwaiting || isApproved) && can(P.invoiceApprove);
  const owed = isIssued && invoice.balance > 0;
  const canRecord = owed && can(P.paymentRecord);
  const canCredit = owed && can(P.creditNoteCreate);
  const canVoid =
    isIssued &&
    can(P.invoiceIssue) &&
    invoice.payments.length === 0 &&
    invoice.credit_notes.length === 0;
  // Voiding never removes money: payments are unmatched first; a credited invoice stays as it is.
  const voidBlocked =
    !isIssued || !can(P.invoiceIssue)
      ? null
      : invoice.credit_notes.length > 0
        ? 'It has a credit note, so it cannot be voided.'
        : invoice.payments.length > 0
          ? 'It cannot be voided while payments are matched to it: unmatch them first (the money stays on the client’s account).'
          : null;
  const canSend = isIssued && can(P.invoiceSend);
  // The client is told of a void when it has an address and the person may email invoices.
  const canNotify = can(P.invoiceSend) && invoice.email_recipients.length > 0;
  const [notifyClient, setNotifyClient] = useState(true);
  // A void invoice is deleted by whoever may void it; once deleted it only opens by its address.
  const canDeleteVoid =
    isVoid && !invoice.deleted_at && can(P.invoiceCreate) && can(P.invoiceIssue);
  const title = invoice.number ?? 'Draft invoice';

  // The invoice list's "Record payment…", "Raise credit note…" and "Void invoice…" open this page
  // with the matching form already showing (`?action=payment`, `credit` or `void`), when the
  // person may do it.
  const requested = searchParams.get('action');
  const [dialog, setDialog] = useState<DialogState>(() =>
    requested === 'credit' && canCredit
      ? { type: 'credit' }
      : requested === 'void' && canVoid
        ? { type: 'void' }
        : requested === 'payment' && canRecord
          ? { type: 'payment' }
          : null,
  );
  const close = () => setDialog(null);
  useEffect(() => {
    if (!requested) return;
    // Used once: the address goes back to the plain invoice, so a reload does not reopen it.
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    setSearchParams(next, { replace: true });
  }, [requested, searchParams, setSearchParams]);

  const downloadPdf = () =>
    void download(invoice.id, `${invoice.number ?? 'draft-invoice'}.pdf`, () =>
      billingApi.invoicePdf(organization.id, invoice.id),
    );

  const moreItems: DropdownItem[] = [];
  if (canCredit) {
    moreItems.push({
      id: 'credit',
      label: 'Raise credit note…',
      onSelect: () => setDialog({ type: 'credit' }),
    });
  }
  if (canVoid) {
    moreItems.push({
      id: 'void',
      label: 'Void invoice…',
      tone: 'danger',
      onSelect: () => {
        setNotifyClient(true);
        setDialog({ type: 'void' });
      },
    });
  }
  if ((isDraft && can(P.invoiceCreate)) || canDeleteVoid) {
    moreItems.push({
      id: 'delete',
      label: isDraft ? 'Delete draft…' : 'Delete invoice…',
      tone: 'danger',
      onSelect: () => {
        setRefusal(null);
        setDialog({ type: 'delete' });
      },
    });
  }

  const actions = (
    <>
      {canIssue ? (
        <Button
          variant="primary"
          disabled={linesDirty}
          title={linesDirty ? 'Save or discard the changes to the lines first' : undefined}
          onClick={() => setDialog({ type: 'issue' })}
        >
          Issue invoice
        </Button>
      ) : null}
      {canSubmit ? (
        <Button
          variant="primary"
          disabled={linesDirty}
          title={linesDirty ? 'Save or discard the changes to the lines first' : undefined}
          onClick={() => setDialog({ type: 'submit' })}
        >
          Submit for approval
        </Button>
      ) : null}
      {canApprove ? (
        <Button variant="primary" onClick={() => setDialog({ type: 'approve' })}>
          Approve
        </Button>
      ) : null}
      {canReject ? <Button onClick={() => setDialog({ type: 'reject' })}>Reject</Button> : null}
      {canRecord ? (
        <Button
          variant={canIssue ? 'outline' : 'primary'}
          onClick={() => setDialog({ type: 'payment' })}
        >
          Record payment
        </Button>
      ) : null}
      {canSend ? <Button onClick={() => setDialog({ type: 'send' })}>Send email</Button> : null}
      <Button
        leftIcon={<FileDown aria-hidden="true" className="size-4" />}
        loading={busy === invoice.id}
        // The PDF is of the invoice as saved.
        disabled={linesDirty}
        title={linesDirty ? 'Save or discard the changes to the lines first' : undefined}
        onClick={downloadPdf}
      >
        Download PDF
      </Button>
      {moreItems.length > 0 ? (
        <Dropdown
          label="More actions"
          items={moreItems}
          trigger={<Ellipsis aria-hidden="true" className="size-5 text-text-muted" />}
        />
      ) : null}
    </>
  );

  const confirmDelete = () =>
    removeInvoice.mutate(invoice.id, {
      onSuccess: () => {
        toast(
          isDraft
            ? {
                tone: 'success',
                title: 'Draft deleted',
                description: 'Its work is unbilled WIP again.',
              }
            : {
                tone: 'success',
                title: `${title} deleted`,
                description: 'It keeps its number and stays in the audit trail.',
              },
        );
        leaving.current = true;
        void navigate(routes.org.invoices(slug));
      },
      onError: (error) => setRefusal(dialogError(error)),
    });

  const confirmUnmatch = () => {
    if (dialog?.type !== 'unmatch') return;
    const paymentId = dialog.payment.payment_id;
    unmatch.mutate(
      { paymentId, allocationId: dialog.payment.allocation_id },
      {
        onSuccess: () => {
          toast({
            tone: 'success',
            title: 'Payment unmatched',
            description: 'The money is on account again, and the invoice owes it.',
            // The reason to unmatch: matching the money to the right invoice, one click away.
            action: {
              label: 'Allocate it',
              onClick: () => setDialog({ type: 'allocate', paymentId }),
            },
          });
          close();
        },
        onError: (error) => setRefusal(dialogError(error)),
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <InvoiceHeaderPanel open={dialog?.type === 'details'} invoice={invoice} onClose={close} />
      <CreditNotePanel open={dialog?.type === 'credit'} invoice={invoice} onClose={close} />
      <RecordPaymentPanel open={dialog?.type === 'payment'} invoice={invoice} onClose={close} />
      <PaymentDetailDialog
        paymentId={dialog?.type === 'allocate' ? dialog.paymentId : null}
        onClose={close}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Leave without saving the lines?"
        confirmLabel="Leave"
        cancelLabel="Stay"
      >
        The changes to the lines are not saved yet: leave the page and they are lost.
      </ConfirmDialog>
      <BackLink />
      <PageShell
        title={title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <InvoiceStatusBadge status={invoice.display_status} />
            {invoice.client ? (
              <span>
                for{' '}
                <Link
                  to={routes.org.client(slug, invoice.client.id)}
                  className="font-medium text-brand-text hover:underline"
                >
                  {invoice.client.name}
                </Link>
              </span>
            ) : null}
          </span>
        }
        actions={actions}
      >
        {isVoid ? (
          <Notice tone="warning">
            This invoice was voided
            {invoice.voided_at ? ` on ${dateCell(invoice.voided_at.slice(0, 10))}` : ''}
            {invoice.void_reason ? `: ${invoice.void_reason}` : '.'} Its work is back in WIP.
            {invoice.deleted_at
              ? ` It was deleted on ${dateCell(invoice.deleted_at.slice(0, 10))}: it is left out of every list and kept, with its number, for the audit trail.`
              : ''}
          </Notice>
        ) : isIssued ? (
          <Notice tone="info">
            This invoice has been issued and can no longer be edited. To correct it, raise a credit
            note.{voidBlocked ? ` ${voidBlocked}` : ''}
          </Notice>
        ) : isDraft && approvalNeeded ? (
          <Notice tone="warning">This invoice needs approval before it can be issued.</Notice>
        ) : isAwaiting ? (
          <Notice tone="info">
            This invoice is awaiting approval and is locked until it is approved or rejected.
            {can(P.invoiceApprove) && !invoice.can_approve
              ? ' You prepared or submitted it, so another approver must approve it.'
              : ''}
          </Notice>
        ) : isApproved ? (
          <Notice tone="info">
            This invoice is approved and ready to issue.
            {can(P.invoiceIssue) ? '' : ' Someone who may issue invoices can issue it.'}
          </Notice>
        ) : null}
        <InvoiceSummaryStrip invoice={invoice} />
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <InvoiceLinesCard invoice={invoice} editable={canEdit} onDirtyChange={setLinesDirty} />
            <InvoiceAdvanceCard
              invoice={invoice}
              onAssign={
                can(P.invoiceCreate) ? (line) => setDialog({ type: 'assign', line }) : undefined
              }
            />
            <InvoiceWipCard invoice={invoice} />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <InvoiceDetailsCard
              invoice={invoice}
              today={today}
              onEdit={canEdit ? () => setDialog({ type: 'details' }) : undefined}
            />
            {!isDraft && !isVoid ? (
              <InvoicePaymentsCard
                invoice={invoice}
                onRecord={canRecord ? () => setDialog({ type: 'payment' }) : undefined}
                onUnmatch={
                  can(P.paymentRecord)
                    ? (payment) => {
                        setRefusal(null);
                        setDialog({ type: 'unmatch', payment });
                      }
                    : undefined
                }
              />
            ) : null}
            {!isDraft && !isVoid ? (
              <InvoiceCreditNotesCard
                invoice={invoice}
                onRaise={canCredit ? () => setDialog({ type: 'credit' }) : undefined}
              />
            ) : null}
            <InvoiceTimeline invoice={invoice} />
          </div>
        </div>
      </PageShell>

      <IssueDialog open={dialog?.type === 'issue'} invoice={invoice} onClose={close} />
      <ReasonDialog
        open={dialog?.type === 'submit'}
        onClose={close}
        title="Submit for approval?"
        description={`The draft for ${invoice.client?.name ?? 'the client'} is locked until it is approved or rejected.`}
        label="Message for the approvers (optional)"
        required={false}
        tone="primary"
        confirmLabel="Submit for approval"
        onSubmit={async (note) => {
          await submit.mutateAsync({ invoiceId: invoice.id, note: note || undefined });
          toast({ tone: 'success', title: 'Sent for approval' });
        }}
      />
      <ApproveInvoiceDialog open={dialog?.type === 'approve'} invoice={invoice} onClose={close} />
      <RejectInvoiceDialog open={dialog?.type === 'reject'} invoice={invoice} onClose={close} />
      <SendInvoiceDialog open={dialog?.type === 'send'} invoice={invoice} onClose={close} />
      <AssignTimeDialog
        open={dialog?.type === 'assign'}
        invoice={invoice}
        line={dialog?.type === 'assign' ? dialog.line : null}
        onClose={close}
      />
      <ReasonDialog
        open={dialog?.type === 'void'}
        onClose={close}
        title="Void invoice?"
        description={`${title} for ${invoice.client?.name ?? 'the client'} keeps its number but is cancelled.`}
        label="Reason for voiding"
        hint="Kept in the audit log."
        suggestions={['Issued in error', 'Wrong client', 'Duplicate invoice', 'Wrong amount']}
        confirmLabel="Void invoice"
        onSubmit={async (reason) => {
          const told = canNotify && notifyClient;
          await voidInvoice.mutateAsync({ invoiceId: invoice.id, reason, notifyClient: told });
          toast({
            tone: 'success',
            title: `${title} voided`,
            description: told
              ? `Its work is back in WIP, and ${invoice.email_recipients.join(', ')} will be told it is cancelled.`
              : 'Its work is back in WIP.',
          });
        }}
      >
        <p>
          Only an invoice with no payments or credit notes can be voided. Its work returns to
          unbilled WIP.
        </p>
        {canNotify ? (
          <Checkbox
            className="mt-3"
            label="Email the client that this invoice is cancelled"
            description={`To ${invoice.email_recipients.join(', ')}, with the Invoice cancelled email template.`}
            checked={notifyClient}
            onChange={(event) => setNotifyClient(event.target.checked)}
          />
        ) : can(P.invoiceSend) ? (
          <p className="mt-3">
            The client has no email address, so it cannot be told by email that this invoice is
            cancelled.
          </p>
        ) : null}
      </ReasonDialog>
      <ConfirmDialog
        open={dialog?.type === 'delete'}
        onClose={close}
        onConfirm={confirmDelete}
        title={isDraft ? 'Delete draft?' : `Delete ${title}?`}
        confirmLabel={isDraft ? 'Delete draft' : 'Delete invoice'}
        loading={removeInvoice.isPending}
        error={refusal}
      >
        <p>
          {isDraft
            ? 'The draft is removed and the work on it goes back to unbilled WIP.'
            : 'The void invoice leaves the invoice lists and the client’s invoices. It keeps its number and stays in the audit trail.'}
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog?.type === 'unmatch'}
        onClose={close}
        onConfirm={confirmUnmatch}
        title="Unmatch this payment?"
        confirmLabel="Unmatch payment"
        loading={unmatch.isPending}
        error={refusal}
      >
        <p>
          {dialog?.type === 'unmatch'
            ? `${formatMoney(dialog.payment.amount, invoice.currency)} received on ${dateCell(dialog.payment.received_on)}`
            : ''}{' '}
          is taken off {title}. The invoice owes that money again, and the payment stays on the
          client&apos;s account so it can be matched to the right invoice.
        </p>
      </ConfirmDialog>
    </div>
  );
}

/** `/:orgSlug/billing/invoices/:invoiceId`: one invoice with its lines, WIP, payments and credits. */
export default function InvoiceDetailPage() {
  const { can } = useOrg();
  const { invoiceId } = useParams();
  const allowed = can(P.invoiceRead);
  const query = useInvoice(allowed ? invoiceId : undefined);
  const invoice = query.data;
  useDocumentTitle(invoice ? (invoice.number ?? 'Draft invoice') : 'Invoice');

  if (!allowed) {
    return (
      <PageShell title="Invoice">
        <NoAccess what="invoices" />
      </PageShell>
    );
  }
  if (invoice) return <InvoiceView invoice={invoice} />;

  if (query.isError) {
    const missing = isApiError(query.error) && query.error.status === 404;
    return (
      <div className="flex flex-col gap-3">
        <BackLink />
        <PageShell title="Invoice">
          {missing ? (
            <Card padding="none">
              <EmptyState
                icon={<SearchX className="size-6" />}
                title="Invoice not found"
                description="It may belong to another practice, or it may have been deleted."
              />
            </Card>
          ) : (
            <LoadError
              title="Could not load the invoice"
              error={query.error}
              onRetry={() => void query.refetch()}
              retrying={query.isRefetching}
            />
          )}
        </PageShell>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <BackLink />
      <PageShell title="Invoice">
        <div role="status" aria-label="Loading the invoice" className="flex flex-col gap-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageShell>
    </div>
  );
}
