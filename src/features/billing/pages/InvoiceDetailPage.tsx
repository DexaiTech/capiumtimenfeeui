import { ArrowLeft, CircleAlert, Ellipsis, FileDown, Info, SearchX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  Button,
  Card,
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
import { useDocumentTitle } from '@/hooks';
import { isApiError } from '@/services/api';
import { todayInZone } from '@/utils/dates';

import {
  billingApi,
  useDeleteInvoice,
  useDeleteInvoiceLine,
  useInvoice,
  useVoidInvoice,
} from '../api';
import { InvoiceStatusBadge } from '../components/badges';
import { CreditNoteDialog } from '../components/CreditNoteDialog';
import { InvoiceHeaderDialog } from '../components/InvoiceHeaderDialog';
import {
  InvoiceCreditNotesCard,
  InvoiceDetailsCard,
  InvoicePaymentsCard,
  InvoiceWipCard,
} from '../components/invoice/InvoiceInfoCards';
import { InvoiceLinesCard } from '../components/invoice/InvoiceLinesCard';
import { InvoiceSummaryStrip } from '../components/invoice/InvoiceSummaryStrip';
import { InvoiceTimeline } from '../components/invoice/InvoiceTimeline';
import { IssueDialog } from '../components/IssueDialog';
import { LineDialog } from '../components/LineDialog';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { ReasonDialog } from '../components/ReasonDialog';
import { RecordPaymentDialog } from '../components/RecordPaymentDialog';
import { SendInvoiceDialog } from '../components/SendInvoiceDialog';
import { useFileDownload } from '../hooks/useFileDownload';
import type { InvoiceDetail, InvoiceLine } from '../types';
import { approvalPolicyOf, needsApproval } from '../utils/approval';
import { dialogError } from '../utils/errors';
import { dateCell } from '../utils/format';

type DialogState =
  | { type: 'issue' }
  | { type: 'send' }
  | { type: 'details' }
  | { type: 'line'; line: InvoiceLine | null }
  | { type: 'remove-line'; line: InvoiceLine }
  | { type: 'void' }
  | { type: 'delete' }
  | { type: 'credit' }
  | { type: 'payment' }
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
  const removeLine = useDeleteInvoiceLine(invoice.id);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const close = () => setDialog(null);

  const slug = organization.slug;
  const today = todayInZone(organization.timezone);
  const policy = approvalPolicyOf(organization);
  const isDraft = invoice.status === 'draft';
  const isIssued = invoice.status === 'issued';
  const isVoid = invoice.status === 'void';
  const approvalNeeded = needsApproval(policy, invoice.gross_total);
  const canEdit = isDraft && can(P.invoiceCreate);
  const canIssue = isDraft && can(P.invoiceIssue) && !approvalNeeded;
  const owed = isIssued && invoice.balance > 0;
  const canRecord = owed && can(P.paymentRecord);
  const canCredit = owed && can(P.creditNoteCreate);
  const canVoid =
    isIssued &&
    can(P.invoiceIssue) &&
    invoice.payments.length === 0 &&
    invoice.credit_notes.length === 0;
  const canSend = isIssued && can(P.invoiceIssue);
  const title = invoice.number ?? 'Draft invoice';

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
      onSelect: () => setDialog({ type: 'void' }),
    });
  }
  if (isDraft && can(P.invoiceCreate)) {
    moreItems.push({
      id: 'delete',
      label: 'Delete draft…',
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
        <Button variant="primary" onClick={() => setDialog({ type: 'issue' })}>
          Issue invoice
        </Button>
      ) : null}
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
        toast({
          tone: 'success',
          title: 'Draft deleted',
          description: 'Its work is unbilled WIP again.',
        });
        void navigate(routes.org.invoices(slug));
      },
      onError: (error) => setRefusal(dialogError(error)),
    });

  const confirmRemoveLine = () => {
    if (dialog?.type !== 'remove-line') return;
    removeLine.mutate(dialog.line.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Line removed' });
        close();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  return (
    <div className="flex flex-col gap-3">
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
          </Notice>
        ) : isIssued ? (
          <Notice tone="info">
            This invoice has been issued and can no longer be edited. To correct it, raise a credit
            note.
          </Notice>
        ) : isDraft && approvalNeeded ? (
          <Notice tone="warning">
            This invoice needs approval before it can be issued.
          </Notice>
        ) : null}
        <InvoiceSummaryStrip invoice={invoice} />
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <InvoiceLinesCard
              invoice={invoice}
              editable={canEdit}
              onAdd={() => setDialog({ type: 'line', line: null })}
              onEdit={(line) => setDialog({ type: 'line', line })}
              onRemove={(line) => {
                setRefusal(null);
                setDialog({ type: 'remove-line', line });
              }}
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
      <SendInvoiceDialog open={dialog?.type === 'send'} invoice={invoice} onClose={close} />
      <InvoiceHeaderDialog open={dialog?.type === 'details'} invoice={invoice} onClose={close} />
      <LineDialog
        open={dialog?.type === 'line'}
        invoiceId={invoice.id}
        line={dialog?.type === 'line' ? dialog.line : null}
        onClose={close}
      />
      <CreditNoteDialog open={dialog?.type === 'credit'} invoice={invoice} onClose={close} />
      <RecordPaymentDialog open={dialog?.type === 'payment'} invoice={invoice} onClose={close} />
      <ReasonDialog
        open={dialog?.type === 'void'}
        onClose={close}
        title="Void invoice?"
        description={`${title} for ${invoice.client?.name ?? 'the client'} keeps its number but is cancelled.`}
        label="Reason for voiding"
        hint="Kept in the audit log."
        confirmLabel="Void invoice"
        onSubmit={async (reason) => {
          await voidInvoice.mutateAsync({ invoiceId: invoice.id, reason });
          toast({
            tone: 'success',
            title: `${title} voided`,
            description: 'Its work is back in WIP.',
          });
        }}
      >
        <p>
          Only an invoice with no payments or credit notes can be voided. Its work returns to
          unbilled WIP.
        </p>
      </ReasonDialog>
      <ConfirmDialog
        open={dialog?.type === 'delete'}
        onClose={close}
        onConfirm={confirmDelete}
        title="Delete draft?"
        confirmLabel="Delete draft"
        loading={removeInvoice.isPending}
        error={refusal}
      >
        <p>The draft is removed and the work on it goes back to unbilled WIP.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog?.type === 'remove-line'}
        onClose={close}
        onConfirm={confirmRemoveLine}
        title="Remove line?"
        confirmLabel="Remove line"
        loading={removeLine.isPending}
        error={refusal}
      >
        <p>
          <strong className="font-medium text-text">
            {dialog?.type === 'remove-line' ? dialog.line.description : ''}
          </strong>{' '}
          is removed from the draft; any work on it goes back to unbilled WIP.
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
