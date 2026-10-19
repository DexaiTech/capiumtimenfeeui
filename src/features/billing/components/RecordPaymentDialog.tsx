import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import {
  Button,
  Input,
  Modal,
  SegmentedControl,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '@/components/ui';
import { ClientPicker } from '@/features/clients';
import { useOrg } from '@/features/organizations';
import { todayInZone } from '@/utils/dates';
import { formatMoney, parsePounds, penceToPoundsInput } from '@/utils/money';

import { useCreatePayment, useOpenInvoices } from '../api';
import { PAYMENT_METHOD_LABELS } from '../constants';
import { paymentSchema, type PaymentValues } from '../schemas/forms';
import { PAYMENT_METHODS, type InvoiceSummary, type Payment, type PaymentCreate } from '../types';
import { autoAllocate, planAllocations } from '../utils/allocation';
import { toFormError } from '../utils/errors';
import { AllocationGrid } from './AllocationGrid';
import { DialogActions } from './DialogActions';

const METHOD_OPTIONS = PAYMENT_METHODS.map((method) => ({
  value: method,
  label: PAYMENT_METHOD_LABELS[method],
}));

export interface RecordPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  /** Opens for this invoice: its client is fixed and its balance is the amount to allocate. */
  invoice?: Pick<InvoiceSummary, 'id' | 'number' | 'balance' | 'client'>;
  onRecorded?: (payment: Payment) => void;
}

function PaymentForm({ invoice, onClose, onRecorded }: Omit<RecordPaymentDialogProps, 'open'>) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const create = useCreatePayment();
  const formId = useId();
  const currency = organization.currency;
  const money = (pence: number) => formatMoney(pence, currency);
  const presetClient = invoice?.client ?? null;

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      client_id: presetClient?.id ?? '',
      received_on: todayInZone(organization.timezone),
      amount: invoice ? penceToPoundsInput(invoice.balance, currency) : '',
      method: 'bank_transfer',
      reference: '',
      notes: '',
      allocation: invoice ? 'manual' : 'auto',
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<PaymentValues>({
      setError,
      fields: ['client_id', 'received_on', 'amount', 'method', 'reference', 'notes'],
    });

  const clientId = useWatch({ control, name: 'client_id' });
  const allocation = useWatch({ control, name: 'allocation' });
  const amount = parsePounds(useWatch({ control, name: 'amount' }));
  const openInvoices = useOpenInvoices(clientId || null);
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    invoice ? { [invoice.id]: penceToPoundsInput(invoice.balance, currency) } : {},
  );
  const [tried, setTried] = useState(false);

  const invoices = openInvoices.data ?? [];
  const plan = planAllocations(invoices, amounts, amount);
  const automatic = amount !== null ? autoAllocate(invoices, amount) : [];
  const allocated =
    allocation === 'manual'
      ? plan.total
      : allocation === 'auto'
        ? automatic.reduce((total, entry) => total + entry.amount, 0)
        : 0;
  const problem =
    allocation !== 'manual'
      ? null
      : plan.invalid.size > 0
        ? 'Each amount must be a valid amount up to the invoice balance.'
        : plan.exceeds
          ? `The amounts add up to more than the ${amount === null ? '' : money(amount)} received.`
          : plan.allocations.length === 0
            ? 'Enter an amount for at least one invoice, or choose "Leave on account".'
            : null;

  const submit = handleSubmit((values) => {
    clearSubmitError();
    setTried(true);
    const received = parsePounds(values.amount);
    if (received === null || problem) return;
    const body: PaymentCreate = {
      client_id: values.client_id,
      received_on: values.received_on,
      amount: received,
      method: values.method,
      ...(values.reference ? { reference: values.reference } : {}),
      ...(values.notes ? { notes: values.notes } : {}),
      ...(values.allocation === 'auto' ? { auto_allocate: true } : {}),
      ...(values.allocation === 'manual' ? { allocations: plan.allocations } : {}),
    };
    create.mutate(body, {
      onSuccess: (payment) => {
        toast({
          tone: 'success',
          title: 'Payment recorded',
          description: `${money(payment.amount)} from ${payment.client?.name ?? 'the client'}; ${money(payment.allocated_total)} allocated, ${money(payment.unallocated)} on account.`,
        });
        onRecorded?.(payment);
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
        {presetClient ? (
          <Input
            label="Client"
            readOnly
            value={`${presetClient.name} (${presetClient.code})`}
            hint={invoice ? `Paying ${invoice.number ?? 'the invoice'}.` : undefined}
          />
        ) : (
          <ClientPicker
            label="Client"
            value={clientId || null}
            onChange={(client) => {
              setValue('client_id', client?.id ?? '', { shouldValidate: tried });
              setAmounts({});
            }}
            error={errors.client_id?.message}
            listPlacement="inline"
          />
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Amount received (£)"
            inputMode="decimal"
            autoComplete="off"
            error={errors.amount?.message}
            {...register('amount')}
          />
          <Input
            label="Date received"
            type="date"
            error={errors.received_on?.message}
            {...register('received_on')}
          />
          <Select
            label="Method"
            options={METHOD_OPTIONS}
            error={errors.method?.message}
            {...register('method')}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Reference"
            autoComplete="off"
            hint="The bank reference or cheque number."
            error={errors.reference?.message}
            {...register('reference')}
          />
          <Textarea label="Notes" rows={1} error={errors.notes?.message} {...register('notes')} />
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1.5 text-xs font-medium text-text">Allocate to invoices</legend>
          <SegmentedControl
            label="How to allocate"
            options={[
              { value: 'auto', label: 'Oldest invoice first' },
              { value: 'manual', label: 'Choose invoices' },
              { value: 'none', label: 'Leave on account' },
            ]}
            value={allocation}
            onChange={(next) => setValue('allocation', next)}
          />
          {clientId && allocation !== 'none' ? (
            openInvoices.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : invoices.length === 0 ? (
              <p className="text-sm text-text-muted">
                This client has no issued invoice with a balance: the money stays on account.
              </p>
            ) : allocation === 'manual' ? (
              <AllocationGrid
                invoices={invoices}
                amounts={amounts}
                onChange={(id, text) => setAmounts((current) => ({ ...current, [id]: text }))}
                invalid={plan.invalid}
                currency={currency}
              />
            ) : (
              <ul aria-label="Invoices the payment would pay" className="text-sm text-text-muted">
                {automatic.length === 0 ? (
                  <li>Enter the amount received to see which invoices it pays.</li>
                ) : (
                  automatic.map((entry) => (
                    <li key={entry.invoice_id}>
                      {invoices.find((row) => row.id === entry.invoice_id)?.number ?? 'Invoice'}:{' '}
                      {money(entry.amount)}
                    </li>
                  ))
                )}
              </ul>
            )
          ) : null}
          <p aria-live="polite" className="text-sm text-text-muted">
            {amount === null
              ? 'Enter the amount received.'
              : `${money(allocated)} allocated, ${money(Math.max(amount - allocated, 0))} stays on account.`}
          </p>
          {tried && problem ? (
            <p role="alert" className="text-xs font-medium text-danger">
              {problem}
            </p>
          ) : null}
        </fieldset>

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
          loading={create.isPending}
          disabled={retryIn > 0}
        >
          Record payment
        </Button>
      </DialogActions>
    </>
  );
}

/** Records money received from a client and allocates it (oldest invoice first, by hand, or none). */
export function RecordPaymentDialog({ open, onClose, invoice, onRecorded }: RecordPaymentDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a payment"
      description="Money received from a client. Allocate it to invoices now or later."
      size="lg"
      closeOnBackdrop={false}
    >
      {open ? <PaymentForm invoice={invoice} onClose={onClose} onRecorded={onRecorded} /> : null}
    </Modal>
  );
}
