import { useState } from 'react';

import { FormAlert } from '@/components/forms';
import { Button, ConfirmDialog, ErrorState, Modal, Skeleton, useToast } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { isApiError } from '@/services/api';
import { formatMoney } from '@/utils/money';

import {
  useAllocatePayment,
  useOpenInvoices,
  usePayment,
  useRemoveAllocation,
  useVoidPayment,
} from '../../api';
import { PAYMENT_METHOD_LABELS } from '../../constants';
import type { Payment, PaymentAllocation } from '../../types';
import { planAllocations } from '../../utils/allocation';
import { dialogError } from '../../utils/errors';
import { dateCell } from '../../utils/format';
import { AllocationGrid } from '../AllocationGrid';
import { PaymentStateBadge } from '../badges';
import { ReasonDialog } from '../ReasonDialog';

type Confirm = { type: 'unallocate'; allocation: PaymentAllocation } | { type: 'void' } | null;

interface BodyProps {
  paymentId: string;
  onClose: () => void;
  /** Opens the reversal of the payment (the caller owns that dialog). */
  onReverse?: (payment: Payment) => void;
}

function PaymentBody({ paymentId, onClose, onReverse }: BodyProps) {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const query = usePayment(paymentId);
  const remove = useRemoveAllocation();
  const allocate = useAllocatePayment();
  const voidPayment = useVoidPayment();
  const payment = query.data;
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [choosing, setChoosing] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const [tried, setTried] = useState(false);
  const open = useOpenInvoices(choosing && payment?.client ? payment.client.id : null);

  const currency = organization.currency;
  const money = (pence: number) => formatMoney(pence, currency);

  if (query.isError && !payment) {
    return (
      <ErrorState
        title="Could not load the payment"
        error={isApiError(query.error) ? query.error : null}
        onRetry={() => void query.refetch()}
        retrying={query.isRefetching}
      />
    );
  }
  if (!payment) return <Skeleton className="h-40 w-full" />;

  const active = payment.state !== 'void' && payment.state !== 'reversed';
  const canRecord = can(P.paymentRecord) && active;
  const invoices = open.data ?? [];
  const plan = planAllocations(invoices, amounts, payment.unallocated);

  const finish = (title: string) => toast({ tone: 'success', title });
  const fail = (error: unknown) => setRefusal(dialogError(error));

  const runAuto = () => {
    setRefusal(null);
    allocate.mutate(
      { paymentId: payment.id, body: { auto_allocate: true } },
      { onSuccess: () => finish('Payment allocated, oldest invoice first'), onError: fail },
    );
  };
  const runManual = () => {
    setTried(true);
    setRefusal(null);
    if (plan.invalid.size > 0 || plan.exceeds || plan.allocations.length === 0) return;
    allocate.mutate(
      { paymentId: payment.id, body: { allocations: plan.allocations } },
      {
        onSuccess: () => {
          finish('Payment allocated');
          setChoosing(false);
          setAmounts({});
          setTried(false);
        },
        onError: fail,
      },
    );
  };
  const manualProblem = !tried
    ? null
    : plan.invalid.size > 0
      ? 'Each amount must be a valid amount up to the invoice balance.'
      : plan.exceeds
        ? `The amounts add up to more than the ${money(payment.unallocated)} still on account.`
        : plan.allocations.length === 0
          ? 'Enter an amount for at least one invoice.'
          : null;

  const confirmUnallocate = () => {
    if (confirm?.type !== 'unallocate') return;
    remove.mutate(
      { paymentId: payment.id, allocationId: confirm.allocation.id },
      {
        onSuccess: () => {
          finish('Allocation removed');
          setConfirm(null);
        },
        onError: fail,
      },
    );
  };

  const rows: Array<[string, string]> = [
    ['Client', payment.client ? `${payment.client.name} (${payment.client.code})` : '—'],
    ['Received', dateCell(payment.received_on)],
    ['Amount', money(payment.amount)],
    ['Method', PAYMENT_METHOD_LABELS[payment.method] ?? payment.method],
    ['Reference', payment.reference ?? '—'],
    ['Allocated', money(payment.allocated_total)],
    ['On account', money(payment.unallocated)],
    ['Notes', payment.notes ?? '—'],
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <PaymentStateBadge state={payment.state} />
        <span className="text-sm text-text-muted">
          {active ? '' : 'This payment no longer counts towards any invoice.'}
        </span>
      </div>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium text-text-muted">{label}</dt>
            <dd className="text-text">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="payment-allocations" className="flex flex-col gap-2">
        <h3 id="payment-allocations" className="text-sm font-semibold text-text">
          Allocations
        </h3>
        {payment.allocations && payment.allocations.length > 0 ? (
          <ul className="divide-y divide-row-border rounded-lg border border-border">
            {payment.allocations.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="font-medium text-text">{entry.invoice_number ?? 'Invoice'}</span>
                <span className="ml-auto font-semibold tabular-nums">{money(entry.amount)}</span>
                {canRecord ? (
                  <Button
                    size="sm"
                    aria-label={`Remove the allocation to ${entry.invoice_number ?? 'the invoice'}`}
                    onClick={() => {
                      setRefusal(null);
                      setConfirm({ type: 'unallocate', allocation: entry });
                    }}
                  >
                    Unallocate
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">Nothing is allocated to an invoice.</p>
        )}
      </section>

      {canRecord && payment.unallocated > 0 ? (
        <section aria-labelledby="payment-allocate" className="flex flex-col gap-3">
          <h3 id="payment-allocate" className="text-sm font-semibold text-text">
            Allocate the {money(payment.unallocated)} on account
          </h3>
          <div className="flex flex-wrap gap-2">
            <Button loading={allocate.isPending && !choosing} onClick={runAuto}>
              Oldest invoice first
            </Button>
            <Button aria-pressed={choosing} onClick={() => setChoosing((value) => !value)}>
              Choose invoices
            </Button>
          </div>
          {choosing ? (
            open.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : invoices.length === 0 ? (
              <p className="text-sm text-text-muted">
                This client has no issued invoice with a balance.
              </p>
            ) : (
              <>
                <AllocationGrid
                  invoices={invoices}
                  amounts={amounts}
                  onChange={(id, text) => setAmounts((current) => ({ ...current, [id]: text }))}
                  invalid={plan.invalid}
                  currency={currency}
                />
                <p aria-live="polite" className="text-sm text-text-muted">
                  {money(plan.total)} of {money(payment.unallocated)} allocated.
                </p>
                {manualProblem ? (
                  <p role="alert" className="text-xs font-medium text-danger">
                    {manualProblem}
                  </p>
                ) : null}
                <Button variant="primary" loading={allocate.isPending} onClick={runManual}>
                  Allocate
                </Button>
              </>
            )
          ) : null}
        </section>
      ) : null}

      {refusal && confirm === null ? (
        <FormAlert message={refusal.message} requestId={refusal.requestId} />
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        {canRecord && payment.allocated_total === 0 ? (
          <Button
            variant="outline"
            onClick={() => {
              setRefusal(null);
              setConfirm({ type: 'void' });
            }}
          >
            Void payment
          </Button>
        ) : null}
        {canRecord && onReverse ? (
          <Button variant="outline" onClick={() => onReverse(payment)}>
            Reverse payment
          </Button>
        ) : null}
        <Button onClick={onClose}>Close</Button>
      </div>

      <ConfirmDialog
        open={confirm?.type === 'unallocate'}
        onClose={() => setConfirm(null)}
        onConfirm={confirmUnallocate}
        title="Remove this allocation?"
        confirmLabel="Remove allocation"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          The invoice's balance goes back up by{' '}
          {confirm?.type === 'unallocate' ? money(confirm.allocation.amount) : ''} and the money is
          on account again.
        </p>
      </ConfirmDialog>
      <ReasonDialog
        open={confirm?.type === 'void'}
        onClose={() => setConfirm(null)}
        title="Void this payment?"
        description="A payment with nothing allocated can be voided. It stops counting as money received."
        label="Reason (optional)"
        hint="Kept in the audit log."
        required={false}
        confirmLabel="Void payment"
        onSubmit={async (reason) => {
          await voidPayment.mutateAsync({ paymentId: payment.id, reason: reason || undefined });
          finish('Payment voided');
        }}
      />
    </div>
  );
}

export interface PaymentDetailDialogProps {
  /** The payment to show; null keeps the dialog closed. */
  paymentId: string | null;
  onClose: () => void;
  onReverse?: (payment: Payment) => void;
}

/** One payment: its figures, the invoices it pays, and allocating, unallocating or voiding it. */
export function PaymentDetailDialog({ paymentId, onClose, onReverse }: PaymentDetailDialogProps) {
  return (
    <Modal open={paymentId !== null} onClose={onClose} title="Payment" size="lg">
      {paymentId ? (
        <PaymentBody key={paymentId} paymentId={paymentId} onClose={onClose} onReverse={onReverse} />
      ) : null}
    </Modal>
  );
}
