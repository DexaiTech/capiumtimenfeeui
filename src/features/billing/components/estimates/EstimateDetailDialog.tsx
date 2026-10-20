import { ArrowRightLeft, Check, Pencil, Send, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { FormAlert } from '@/components/forms';
import { Button, ConfirmDialog, ErrorState, Modal, Skeleton, useToast } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { isApiError } from '@/services/api';
import { formatMoney, formatBasisPoints } from '@/utils/money';

import {
  useAcceptEstimate,
  useConvertEstimate,
  useDeclineEstimate,
  useDeleteEstimate,
  useEstimate,
  useSendEstimate,
} from '../../api';
import type { Estimate } from '../../types';
import { dialogError } from '../../utils/errors';
import { clientLabel, dateCell } from '../../utils/format';
import { formatQuantity, parseQuantity } from '../../utils/lineMaths';
import { EstimateStatusBadge } from '../badges';

export interface EstimateDetailDialogProps {
  /** The estimate to show; null keeps the dialog closed. */
  estimateId: string | null;
  onClose: () => void;
  /** Opens the form for a draft. */
  onEdit: (estimate: Estimate) => void;
}

type Confirm = 'send' | 'convert' | 'delete' | null;
type Refusal = { message: string; requestId?: string };

/** "2" and "2.00" read alike: the API's two-place quantity without a needless ".00". */
const quantityText = (quantity: string) => {
  const hundredths = parseQuantity(quantity);
  return hundredths === null ? quantity : formatQuantity(hundredths).replace(/\.00$/, '');
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{children}</dd>
    </div>
  );
}

/**
 * One estimate: its lines and totals, and what can be done with it at its stage. A draft is
 * edited, sent or deleted; a sent one is accepted or declined; a sent or accepted one becomes a
 * draft invoice. Writing needs `estimate.manage`, and converting also `invoice.create`.
 */
export function EstimateDetailDialog({ estimateId, onClose, onEdit }: EstimateDetailDialogProps) {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const query = useEstimate(estimateId);
  const send = useSendEstimate();
  const accept = useAcceptEstimate();
  const decline = useDeclineEstimate();
  const convert = useConvertEstimate();
  const remove = useDeleteEstimate();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const estimate = query.data;
  const money = (pence: number) => formatMoney(pence, estimate?.currency ?? organization.currency);
  const manage = can(P.estimateManage);
  const busy =
    send.isPending ||
    accept.isPending ||
    decline.isPending ||
    convert.isPending ||
    remove.isPending;

  const askFor = (next: Confirm) => {
    setRefusal(null);
    setConfirm(next);
  };
  const closeConfirm = () => {
    setRefusal(null);
    setConfirm(null);
  };
  const onRefused = (error: unknown) => setRefusal(dialogError(error));

  const respond = (kind: 'accept' | 'decline') => {
    if (!estimate) return;
    setRefusal(null);
    (kind === 'accept' ? accept : decline).mutate(estimate.id, {
      onSuccess: () =>
        toast({
          tone: 'success',
          title: kind === 'accept' ? 'Estimate accepted' : 'Estimate declined',
        }),
      onError: onRefused,
    });
  };

  const doSend = () => {
    if (!estimate) return;
    send.mutate(
      { estimateId: estimate.id },
      {
        onSuccess: (sent) => {
          toast({
            tone: 'success',
            title: sent.number
              ? `Estimate ${sent.number} marked as sent`
              : 'Estimate marked as sent',
          });
          closeConfirm();
        },
        onError: onRefused,
      },
    );
  };

  const doConvert = () => {
    if (!estimate) return;
    convert.mutate(estimate.id, {
      onSuccess: () => {
        toast({
          tone: 'success',
          title: 'Draft invoice created',
          description: 'Review it and issue it from the invoice page.',
        });
        closeConfirm();
      },
      onError: onRefused,
    });
  };

  const doDelete = () => {
    if (!estimate) return;
    remove.mutate(estimate.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Draft deleted' });
        closeConfirm();
        onClose();
      },
      onError: onRefused,
    });
  };

  const canEdit = manage && estimate?.status === 'draft';
  const canRespond = manage && estimate?.status === 'sent';
  const canConvert =
    manage &&
    can(P.invoiceCreate) &&
    estimate !== undefined &&
    (estimate.status === 'sent' || estimate.status === 'accepted') &&
    estimate.converted_invoice_id === null;

  const title = estimate
    ? estimate.number
      ? `Estimate ${estimate.number}`
      : 'Draft estimate'
    : 'Estimate';

  return (
    <>
      <Modal
        open={estimateId !== null && confirm === null}
        onClose={onClose}
        size="lg"
        title={title}
        description={estimate ? clientLabel(estimate.client) : undefined}
        footer={
          <>
            <Button onClick={onClose}>Close</Button>
            {estimate && canEdit ? (
              <>
                <Button
                  variant="danger"
                  leftIcon={<Trash2 aria-hidden="true" className="size-4" />}
                  disabled={busy}
                  onClick={() => askFor('delete')}
                >
                  Delete
                </Button>
                <Button
                  leftIcon={<Pencil aria-hidden="true" className="size-4" />}
                  disabled={busy}
                  onClick={() => onEdit(estimate)}
                >
                  Edit
                </Button>
                <Button
                  variant="primary"
                  leftIcon={<Send aria-hidden="true" className="size-4" />}
                  disabled={busy}
                  onClick={() => askFor('send')}
                >
                  Mark as sent
                </Button>
              </>
            ) : null}
            {estimate && canRespond ? (
              <>
                <Button
                  leftIcon={<X aria-hidden="true" className="size-4" />}
                  loading={decline.isPending}
                  disabled={busy}
                  onClick={() => respond('decline')}
                >
                  Decline
                </Button>
                <Button
                  leftIcon={<Check aria-hidden="true" className="size-4" />}
                  loading={accept.isPending}
                  disabled={busy}
                  onClick={() => respond('accept')}
                >
                  Accept
                </Button>
              </>
            ) : null}
            {estimate && canConvert ? (
              <Button
                variant="primary"
                leftIcon={<ArrowRightLeft aria-hidden="true" className="size-4" />}
                disabled={busy}
                onClick={() => askFor('convert')}
              >
                Convert to invoice
              </Button>
            ) : null}
          </>
        }
      >
        {query.isPending ? (
          <div aria-busy="true" className="flex flex-col gap-3">
            <Skeleton lines={3} />
            <Skeleton shape="rect" className="h-24 w-full" />
          </div>
        ) : query.isError ? (
          <ErrorState
            title="Could not load the estimate"
            error={isApiError(query.error) ? query.error : null}
            onRetry={() => void query.refetch()}
            retrying={query.isRefetching}
          />
        ) : estimate ? (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Fact label="Status">
                <EstimateStatusBadge status={estimate.display_status} />
              </Fact>
              <Fact label="Issued">{dateCell(estimate.issue_date)}</Fact>
              <Fact label="Expires">{dateCell(estimate.expiry_date)}</Fact>
              <Fact label="Reference">{estimate.reference ?? '—'}</Fact>
            </dl>
            {estimate.status === 'draft' ? (
              <p className="text-sm text-text-muted">
                A draft has no number yet. Marking it as sent numbers it and records that it went to
                the client; it is not emailed from here.
              </p>
            ) : null}
            {estimate.display_status === 'expired' ? (
              <p className="text-sm text-text-muted">
                The expiry date of this estimate has passed.
              </p>
            ) : null}
            {estimate.converted_invoice_id ? (
              <p role="status" className="text-sm text-text">
                This estimate has been converted into a draft invoice.{' '}
                {can(P.invoiceRead) ? (
                  <Link
                    to={routes.org.invoice(organization.slug, estimate.converted_invoice_id)}
                    className="font-medium text-brand-text hover:underline"
                  >
                    View the draft invoice
                  </Link>
                ) : null}
              </p>
            ) : null}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[34rem] text-sm">
                <caption className="sr-only">Lines of the estimate</caption>
                <thead className="bg-surface-hover text-left text-xs text-text-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Description
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Quantity
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Unit price
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      VAT
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Net
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.lines.map((line) => (
                    <tr key={line.id} className="border-t border-row-border tabular-nums">
                      <td className="px-3 py-2 font-sans">{line.description}</td>
                      <td className="px-3 py-2 text-right">{quantityText(line.quantity)}</td>
                      <td className="px-3 py-2 text-right">{money(line.unit_amount)}</td>
                      <td className="px-3 py-2 text-right">
                        {formatBasisPoints(line.vat_rate_bp)}
                      </td>
                      <td className="px-3 py-2 text-right">{money(line.net_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl
              aria-label="Totals"
              className="ml-auto grid grid-cols-[auto_auto] gap-x-6 gap-y-0.5 text-sm tabular-nums"
            >
              <dt className="text-text-muted">Net</dt>
              <dd className="text-right">{money(estimate.net_total)}</dd>
              <dt className="text-text-muted">VAT</dt>
              <dd className="text-right">{money(estimate.vat_total)}</dd>
              <dt className="font-semibold text-text">Total</dt>
              <dd className="text-right font-semibold text-text">{money(estimate.gross_total)}</dd>
            </dl>
            {estimate.notes ? (
              <div className="flex flex-col gap-1">
                <h3 className="text-xs text-text-muted">Notes</h3>
                <p className="text-sm whitespace-pre-line text-text">{estimate.notes}</p>
              </div>
            ) : null}
            {refusal && confirm === null ? (
              <FormAlert message={refusal.message} requestId={refusal.requestId} />
            ) : null}
          </div>
        ) : null}
      </Modal>
      <ConfirmDialog
        open={confirm === 'send'}
        onClose={closeConfirm}
        onConfirm={doSend}
        title="Mark as sent?"
        confirmLabel="Mark as sent"
        tone="default"
        loading={send.isPending}
        error={refusal}
      >
        <p>
          This gives the estimate its number and marks it as sent. It is not emailed from here: send
          the document to your client yourself. A sent estimate can no longer be edited.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'convert'}
        onClose={closeConfirm}
        onConfirm={doConvert}
        title="Convert to an invoice?"
        confirmLabel="Convert to invoice"
        tone="default"
        loading={convert.isPending}
        error={refusal}
      >
        <p>
          A draft invoice is created from the lines of this estimate. You review it and issue it
          from the invoice page; nothing is issued automatically. An estimate converts once.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={closeConfirm}
        onConfirm={doDelete}
        title="Delete draft estimate?"
        confirmLabel="Delete draft"
        loading={remove.isPending}
        error={refusal}
      >
        <p>The draft and its lines are removed. This cannot be undone.</p>
      </ConfirmDialog>
    </>
  );
}
