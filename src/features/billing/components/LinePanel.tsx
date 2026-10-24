import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Input, FormPanel, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatMoney, parsePounds, penceToPoundsInput } from '@/utils/money';

import { useAddInvoiceLine, useUpdateInvoiceLine, useVatOptions } from '../api';
import {
  manualLineSchema,
  wipLineSchema,
  type ManualLineValues,
  type WipLineValues,
} from '../schemas/forms';
import type { InvoiceLine, InvoiceLineUpdate } from '../types';
import { toFormError } from '../utils/errors';
import { formatQuantity, lineNet, parseQuantity, vatOn } from '../utils/lineMaths';
import { DialogActions } from './DialogActions';
import { VatSelect } from './VatSelect';

export interface LinePanelProps {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  /** The line to change; null adds a manual line. */
  line: InvoiceLine | null;
}

function ManualLineForm({ invoiceId, line, onClose }: Omit<LinePanelProps, 'open'>) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const { options } = useVatOptions();
  const add = useAddInvoiceLine(invoiceId);
  const update = useUpdateInvoiceLine(invoiceId);
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isDirty },
  } = useForm<ManualLineValues>({
    resolver: zodResolver(manualLineSchema),
    defaultValues: {
      description: line?.description ?? '',
      quantity: line?.quantity ?? '1',
      unit_amount: line ? penceToPoundsInput(line.unit_amount) : '',
      vat_rate_id: line?.vat_rate_id ?? '',
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<ManualLineValues>({
      setError,
      fields: ['description', 'quantity', 'unit_amount', 'vat_rate_id'],
    });
  const saving = add.isPending || update.isPending;

  const typedQuantity = useWatch({ control, name: 'quantity' });
  const typedUnit = useWatch({ control, name: 'unit_amount' });
  const typedVat = useWatch({ control, name: 'vat_rate_id' });
  const quantity = parseQuantity(typedQuantity);
  const unit = parsePounds(typedUnit);
  const net = quantity !== null && unit !== null ? lineNet(quantity, unit) : null;
  const rate = options.find((option) => option.id === typedVat)?.rate_bp;
  const vat = net !== null && rate !== undefined ? vatOn(net, rate) : null;

  const submit = handleSubmit((form) => {
    clearSubmitError();
    const q = parseQuantity(form.quantity);
    const u = parsePounds(form.unit_amount);
    if (q === null || u === null) return;
    const onError = (error: unknown) => handleSubmitError(toFormError(error));
    if (!line) {
      add.mutate(
        {
          description: form.description,
          quantity: formatQuantity(q),
          unit_amount: u,
          ...(form.vat_rate_id ? { vat_rate_id: form.vat_rate_id } : {}),
        },
        {
          onSuccess: () => {
            toast({ tone: 'success', title: 'Line added' });
            onClose();
          },
          onError,
        },
      );
      return;
    }
    const changes: InvoiceLineUpdate = {};
    if (form.description !== line.description) changes.description = form.description;
    if (formatQuantity(q) !== line.quantity) changes.quantity = formatQuantity(q);
    if (u !== line.unit_amount) changes.unit_amount = u;
    if (form.vat_rate_id !== (line.vat_rate_id ?? ''))
      changes.vat_rate_id = form.vat_rate_id || null;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    update.mutate(
      { lineId: line.id, body: changes },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: 'Line saved' });
          onClose();
        },
        onError,
      },
    );
  });

  const money = (pence: number) => formatMoney(pence, organization.currency);
  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-4"
      >
        <Input
          label="Description"
          required
          autoComplete="off"
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Quantity"
            required
            inputMode="decimal"
            autoComplete="off"
            error={errors.quantity?.message}
            {...register('quantity')}
          />
          <Input
            label="Unit price (£)"
            required
            inputMode="decimal"
            autoComplete="off"
            hint="Negative for a discount."
            error={errors.unit_amount?.message}
            {...register('unit_amount')}
          />
          <VatSelect
            options={options}
            defaultLabel="Default"
            current={line?.vat_rate_id ? { id: line.vat_rate_id, rate_bp: line.vat_rate_bp } : null}
            error={errors.vat_rate_id?.message}
            {...register('vat_rate_id')}
          />
        </div>
        <p aria-live="polite" className="text-sm text-text-muted">
          {net === null
            ? 'Enter a quantity and a unit price to see the line total.'
            : vat === null
              ? `Line total ${money(net)} before VAT (the default VAT code applies).`
              : `Line total ${money(net)} + VAT ${money(vat)} = ${money(net + vat)}.`}
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
          loading={saving}
          disabled={(line !== null && !isDirty) || retryIn > 0}
        >
          {line ? 'Save line' : 'Add line'}
        </Button>
      </DialogActions>
    </>
  );
}

function WipLineForm({
  invoiceId,
  line,
  onClose,
}: Omit<LinePanelProps, 'open' | 'line'> & { line: InvoiceLine }) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const { options } = useVatOptions();
  const update = useUpdateInvoiceLine(invoiceId);
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isDirty },
  } = useForm<WipLineValues>({
    resolver: zodResolver(wipLineSchema),
    defaultValues: {
      description: line.description,
      net_amount: penceToPoundsInput(line.net_amount),
      vat_rate_id: line.vat_rate_id ?? '',
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<WipLineValues>({
      setError,
      fields: ['description', 'net_amount', 'vat_rate_id'],
    });

  const billed = parsePounds(useWatch({ control, name: 'net_amount' }));
  const wipValue = line.wip?.wip_value ?? null;
  const difference = billed !== null && wipValue !== null ? billed - wipValue : null;
  const money = (pence: number) => formatMoney(pence, organization.currency);

  const submit = handleSubmit((form) => {
    clearSubmitError();
    const net = parsePounds(form.net_amount);
    if (net === null) return;
    const changes: InvoiceLineUpdate = {};
    if (form.description !== line.description) changes.description = form.description;
    if (net !== line.net_amount) changes.net_amount = net;
    if (form.vat_rate_id !== (line.vat_rate_id ?? ''))
      changes.vat_rate_id = form.vat_rate_id || null;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    update.mutate(
      { lineId: line.id, body: changes },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: 'Line saved' });
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
        <Input
          label="Description"
          required
          autoComplete="off"
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Amount to bill (£)"
            required
            inputMode="decimal"
            autoComplete="off"
            hint={
              wipValue === null ? undefined : `The work on this line is worth ${money(wipValue)}.`
            }
            error={errors.net_amount?.message}
            {...register('net_amount')}
          />
          <VatSelect
            options={options}
            current={line.vat_rate_id ? { id: line.vat_rate_id, rate_bp: line.vat_rate_bp } : null}
            error={errors.vat_rate_id?.message}
            {...register('vat_rate_id')}
          />
        </div>
        <p aria-live="polite" className="text-sm text-text-muted">
          {difference === null || difference === 0
            ? 'Billing the full value of the work: no write-on or write-off.'
            : difference < 0
              ? `Write-off of ${money(-difference)}: the rest of the work's value is not billed.`
              : `Write-on of ${money(difference)}: more than the work's value is billed.`}
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
          loading={update.isPending}
          disabled={!isDirty || retryIn > 0}
        >
          Save line
        </Button>
      </DialogActions>
    </>
  );
}

/**
 * Adds or changes one line of a draft. A line that bills WIP changes its description, the amount
 * billed (the difference from the WIP value is a write-on or write-off) and its VAT code; a manual
 * line also its quantity and unit price.
 */
export function LinePanel({ open, onClose, invoiceId, line }: LinePanelProps) {
  const wip = line !== null && line.kind !== 'manual';
  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title={line ? 'Edit line' : 'Add a line'}
      description={line ? undefined : 'A line that bills no WIP: a fee, a discount, a correction.'}
    >
      {open ? (
        wip ? (
          <WipLineForm key={line.id} invoiceId={invoiceId} line={line} onClose={onClose} />
        ) : (
          <ManualLineForm
            key={line?.id ?? 'new'}
            invoiceId={invoiceId}
            line={line}
            onClose={onClose}
          />
        )
      ) : null}
    </FormPanel>
  );
}
