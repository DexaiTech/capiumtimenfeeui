import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Input, FormPanel, SegmentedControl, Textarea, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { todayInZone } from '@/utils/dates';
import { formatMoney, parsePounds, penceToPoundsInput } from '@/utils/money';

import { useCreateCreditNote } from '../api';
import { creditNoteSchema, type CreditNoteValues } from '../schemas/forms';
import type { CreditNote, InvoiceDetail } from '../types';
import { toFormError } from '../utils/errors';
import { vatOn } from '../utils/lineMaths';
import { DialogActions } from './DialogActions';

type Mode = 'full' | 'partial';

interface RowState {
  on: boolean;
  amount: string;
}

export interface CreditNotePanelProps {
  open: boolean;
  onClose: () => void;
  /** The invoice with its lines and balance. */
  invoice: InvoiceDetail;
  onCreated?: (note: CreditNote) => void;
}

function CreditNoteForm({ invoice, onClose, onCreated }: Omit<CreditNotePanelProps, 'open'>) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const create = useCreateCreditNote();
  const formId = useId();
  const money = (pence: number) => formatMoney(pence, invoice.currency);

  const creditable = useMemo(() => invoice.lines.filter((line) => line.net_amount > 0), [invoice]);
  const [mode, setMode] = useState<Mode>('full');
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      creditable.map((line) => [
        line.id,
        { on: false, amount: penceToPoundsInput(line.net_amount, invoice.currency) },
      ]),
    ),
  );
  const [shown, setShown] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CreditNoteValues>({
    resolver: zodResolver(creditNoteSchema),
    defaultValues: { reason: '', issue_date: todayInZone(organization.timezone) },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<CreditNoteValues>({ setError, fields: ['reason', 'issue_date'] });

  const credits = creditable.map((line) => {
    const row = rows[line.id];
    const typed = row ? parsePounds(row.amount) : null;
    const pence = mode === 'full' ? line.net_amount : row?.on ? typed : 0;
    const valid = pence !== null && pence >= 0 && pence <= line.net_amount;
    return {
      line,
      pence: valid ? pence : 0,
      valid,
      vat: valid ? vatOn(pence, line.vat_rate_bp) : 0,
    };
  });
  const net = credits.reduce((total, credit) => total + credit.pence, 0);
  const vat = credits.reduce((total, credit) => total + credit.vat, 0);
  const gross = net + vat;
  const invalidLine = credits.some((credit) => !credit.valid);
  const problem = invalidLine
    ? 'Each amount must be between £0.00 and the line total.'
    : net === 0
      ? 'Choose at least one line to credit.'
      : gross > invoice.balance
        ? `A credit note cannot exceed the outstanding balance of ${money(invoice.balance)}. Credit less, or remove the payment first.`
        : null;

  const setRow = (id: string, changes: Partial<RowState>) =>
    setRows((current) => ({
      ...current,
      [id]: { on: false, amount: '', ...current[id], ...changes },
    }));

  const submit = handleSubmit((values) => {
    clearSubmitError();
    setShown(true);
    if (problem) return;
    create.mutate(
      {
        invoiceId: invoice.id,
        body: {
          reason: values.reason,
          issue_date: values.issue_date,
          lines: credits
            .filter((credit) => credit.pence > 0)
            .map((credit) => ({
              description: credit.line.description,
              net_amount: credit.pence,
              ...(credit.line.vat_rate_id ? { vat_rate_id: credit.line.vat_rate_id } : {}),
            })),
        },
      },
      {
        onSuccess: (note) => {
          toast({
            tone: 'success',
            title: `Credit note ${note.number} issued`,
            description: `${money(note.gross_total)} credited against ${invoice.number ?? 'the invoice'}.`,
          });
          onCreated?.(note);
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
        <SegmentedControl
          label="Amount to credit"
          options={[
            { value: 'full', label: 'Credit in full' },
            { value: 'partial', label: 'Choose lines and amounts' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-separate border-spacing-0 text-xs font-medium">
            <caption className="sr-only">Lines of the invoice to credit</caption>
            <thead>
              <tr className="text-left text-text-muted">
                {mode === 'partial' ? <th scope="col" className="h-9 w-10 px-3" /> : null}
                <th scope="col" className="h-9 px-3">
                  Line
                </th>
                <th scope="col" className="h-9 px-3 text-right">
                  Line net
                </th>
                <th scope="col" className="h-9 px-3 text-right">
                  Credit (net)
                </th>
              </tr>
            </thead>
            <tbody>
              {credits.map(({ line, pence, valid }) => {
                const row = rows[line.id];
                return (
                  <tr key={line.id} className="border-t border-row-border">
                    {mode === 'partial' ? (
                      <td className="border-t border-row-border px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Credit ${line.description}`}
                          checked={row?.on ?? false}
                          onChange={(event) => setRow(line.id, { on: event.target.checked })}
                          className="size-4 accent-primary"
                        />
                      </td>
                    ) : null}
                    <td className="border-t border-row-border px-3 py-2 text-text">
                      {line.description}
                    </td>
                    <td className="border-t border-row-border px-3 py-2 text-right tabular-nums">
                      {money(line.net_amount)}
                    </td>
                    <td className="border-t border-row-border px-3 py-2 text-right tabular-nums">
                      {mode === 'full' ? (
                        money(pence)
                      ) : (
                        <Input
                          label={`Amount to credit for ${line.description}`}
                          hideLabel
                          inputMode="decimal"
                          autoComplete="off"
                          disabled={!row?.on}
                          value={row?.amount ?? ''}
                          error={!valid ? 'Invalid amount' : undefined}
                          onChange={(event) => setRow(line.id, { amount: event.target.value })}
                          className="ml-auto w-28"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {invoice.lines.length > creditable.length ? (
          <p className="text-xs text-text-muted">
            Discount lines cannot be credited; the credit note is raised on the other lines.
          </p>
        ) : null}
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 rounded-lg bg-surface-hover/60 px-4 py-3 text-sm">
          <dt className="text-text-muted">Credit before VAT</dt>
          <dd className="text-right tabular-nums">{money(net)}</dd>
          <dt className="text-text-muted">VAT (at each line's rate)</dt>
          <dd className="text-right tabular-nums">{money(vat)}</dd>
          <dt className="font-semibold text-text">Credit note total</dt>
          <dd className="text-right font-semibold tabular-nums">{money(gross)}</dd>
          <dt className="text-text-muted">Invoice balance after the credit</dt>
          <dd className="text-right tabular-nums">{money(Math.max(invoice.balance - gross, 0))}</dd>
        </dl>
        {shown && problem ? (
          <p role="alert" className="text-xs font-medium text-danger">
            {problem}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <Textarea
            label="Reason"
            required
            rows={2}
            hint="Printed on the credit note and kept in the audit log."
            error={errors.reason?.message}
            {...register('reason')}
          />
          <Input
            label="Credit note date"
            required
            type="date"
            error={errors.issue_date?.message}
            {...register('issue_date')}
          />
        </div>
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
          Issue credit note
        </Button>
      </DialogActions>
    </>
  );
}

/** Raises a full or partial credit note against an issued invoice. */
export function CreditNotePanel({ open, onClose, invoice, onCreated }: CreditNotePanelProps) {
  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title="Raise a credit note"
      description={`${invoice.number ?? 'Invoice'} · ${invoice.client?.name ?? ''} · outstanding ${formatMoney(invoice.balance, invoice.currency)}`}
    >
      {open ? <CreditNoteForm invoice={invoice} onClose={onClose} onCreated={onCreated} /> : null}
    </FormPanel>
  );
}
