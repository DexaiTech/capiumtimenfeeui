import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import {
  Button,
  DateField,
  Input,
  Modal,
  Select,
  Switch,
  Textarea,
  useToast,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { ClientPicker, JobPicker, useVatCodes, type VatCode } from '@/features/team';
import { todayInZone } from '@/utils/dates';
import { formatBasisPoints, formatMoney, parsePounds, penceToPoundsInput } from '@/utils/money';

import { useExpenseSettings, useExpenseTypes, useSaveLine } from '../api';
import { LIMITS, PAYER_OPTIONS } from '../constants';
import { useAmountFields } from '../hooks/useAmountFields';
import { lineSchema, type LineValues } from '../schemas/line';
import type { ExpenseLine, ExpenseType } from '../types';
import { mileageNet, parseMiles, rechargeFor, resolveAmounts, vatOnNet } from '../utils/amounts';
import { toFormError } from '../utils/errors';
import { formatRatePerMile } from '../utils/format';
import { hasChanges, toLineInput, toLineUpdate } from '../utils/lineBody';
import { DialogActions } from './DialogActions';

const FIELDS = [
  'expense_type_id',
  'incurred_on',
  'description',
  'supplier',
  'client_id',
  'job_id',
  'vat_rate_id',
  'net',
  'vat',
  'gross',
  'miles',
  'is_billable',
  'recharge_amount',
  'payer',
  'reason',
] as const;

export interface LineFormDialogProps {
  claimId: string;
  /** The line to change; null to add one. */
  line: ExpenseLine | null;
  /** The claim is approved: a correction, which needs a reason. */
  correcting?: boolean;
  open: boolean;
  onClose: () => void;
}

const pounds = (pence: number | null | undefined) => penceToPoundsInput(pence);

/** The VAT codes to choose from: the live ones, and the one the line already has. */
function vatChoices(codes: VatCode[] | undefined, current: string | null) {
  const live = (codes ?? []).filter((code) => !code.is_archived || code.id === current);
  return [
    { value: '', label: 'No VAT code' },
    ...live.map((code) => ({
      value: code.id,
      label: `${code.name} (${formatBasisPoints(code.rate_bp)})`,
    })),
  ];
}

function LineForm({
  claimId,
  line,
  correcting,
  onClose,
}: Omit<LineFormDialogProps, 'open'> & { correcting: boolean }) {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const formId = useId();
  const save = useSaveLine();
  const types = useExpenseTypes();
  const vatCodes = useVatCodes();
  const settings = useExpenseSettings();
  const today = todayInZone(organization.timezone);
  const canSetRecharge = can('expense.manage');
  const currency = organization.currency;

  const typeById = useMemo(
    () => new Map((types.data ?? []).map((type) => [type.id, type])),
    [types.data],
  );
  const mileageIds = useMemo(
    () => new Set((types.data ?? []).filter((type) => type.is_mileage).map((type) => type.id)),
    [types.data],
  );
  const schema = useMemo(
    () => lineSchema({ today, mileageTypeIds: mileageIds, correcting }),
    [today, mileageIds, correcting],
  );
  const rateBpOf = (vatRateId: string) =>
    vatCodes.data?.find((code) => code.id === vatRateId)?.rate_bp ?? null;

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors, isDirty },
  } = useForm<LineValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      expense_type_id: line?.expense_type_id ?? '',
      incurred_on: line?.incurred_on ?? today,
      description: line?.description ?? '',
      supplier: line?.supplier ?? '',
      client_id: line?.client_id ?? '',
      job_id: line?.job_id ?? '',
      vat_rate_id: line?.vat_rate_id ?? '',
      net: line && line.miles === null ? pounds(line.net) : '',
      vat: line && line.miles === null ? pounds(line.vat) : '',
      gross: line && line.miles === null ? pounds(line.gross) : '',
      miles: line?.miles ?? '',
      is_billable: line?.is_billable ?? false,
      recharge_amount: line?.is_billable ? pounds(line.recharge_amount) : '',
      payer: line?.payer ?? 'staff',
      reason: '',
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } = useSubmitError<LineValues>({
    setError,
    fields: FIELDS,
  });

  // A stored VAT that is not what the rate gives is kept as it is, and sent again when amounts change.
  // What the person set by hand is never overwritten by a default (a new line starts untouched).
  const amounts = useAmountFields({
    getValues,
    setValue,
    rateBpOf,
    initialVatTouched:
      line !== null &&
      line.miles === null &&
      line.vat !== vatOnNet(line.net, line.vat_rate_bp ?? 0),
    initialVatCodeTouched: line !== null,
    initialBillableTouched: line !== null,
  });
  const { vatCodeTouched, billableTouched } = amounts;

  const [typeId, clientId, jobId, isBillable, vatRateId, miles, net, vat, gross] = useWatch({
    control,
    name: [
      'expense_type_id',
      'client_id',
      'job_id',
      'is_billable',
      'vat_rate_id',
      'miles',
      'net',
      'vat',
      'gross',
    ],
  });
  const type = typeById.get(typeId);
  const isMileage = type?.is_mileage ?? false;

  const onTypeChange = (id: string) => {
    const next = typeById.get(id);
    const before = typeById.get(getValues('expense_type_id'));
    setValue('expense_type_id', id, { shouldDirty: true, shouldValidate: true });
    if (!vatCodeTouched.current) setValue('vat_rate_id', next?.default_vat_rate_id ?? '');
    if (!billableTouched.current) {
      setValue('is_billable', Boolean(next?.default_billable) && getValues('client_id') !== '');
    }
    if (line !== null && Boolean(before?.is_mileage) !== Boolean(next?.is_mileage)) {
      // Money to miles or back: the amounts start over.
      amounts.clear();
      setValue('miles', '');
    } else if (!vatCodeTouched.current) {
      amounts.onRateChange();
    }
  };

  const onClientChange = (id: string | null) => {
    setValue('client_id', id ?? '', { shouldDirty: true });
    setValue('job_id', '', { shouldDirty: true });
    if (!id) {
      setValue('is_billable', false);
      setValue('recharge_amount', '');
    } else if (!billableTouched.current) {
      setValue(
        'is_billable',
        Boolean(typeById.get(getValues('expense_type_id'))?.default_billable),
      );
    }
  };

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const ctx = {
      isMileage: mileageIds.has(values.expense_type_id),
      canSetRecharge,
      anchor: amounts.anchor.current,
      amountsTouched: amounts.amountsTouched.current,
      vatTouched: amounts.vatTouched.current,
    };
    const onError = (error: unknown) => handleSubmitError(toFormError(error));

    if (!line) {
      save.mutate(
        { mode: 'add', claimId, body: toLineInput(values, ctx) },
        {
          onSuccess: () => {
            toast({ tone: 'success', title: 'Expense added' });
            onClose();
          },
          onError,
        },
      );
      return;
    }
    const changes = toLineUpdate(values, line, ctx, correcting ? values.reason : undefined);
    if (!hasChanges(changes)) {
      onClose();
      return;
    }
    save.mutate(
      { mode: 'update', claimId, lineId: line.id, body: changes },
      {
        onSuccess: () => {
          toast({
            tone: 'success',
            title: correcting ? 'Expense corrected' : 'Expense saved',
          });
          onClose();
        },
        onError,
      },
    );
  });

  // What the line comes to, worked out as the API will (a preview: the API has the last word).
  const rate = rateBpOf(vatRateId);
  const preview = (() => {
    if (isMileage) {
      const valid = parseMiles(miles);
      if (settings.mileageRate === null || valid === null) return null;
      const base = mileageNet(valid, settings.mileageRate);
      return resolveAmounts({ net: base, vat: null, gross: null }, rate);
    }
    const toPence = (text: string) => (text.trim() === '' ? null : parsePounds(text));
    return resolveAmounts({ net: toPence(net), vat: toPence(vat), gross: toPence(gross) }, rate);
  })();
  const autoRecharge =
    isBillable && preview && settings.markupBp !== null
      ? rechargeFor(preview.net, settings.markupBp)
      : null;

  const typeOptions = (types.data ?? [])
    .filter((entry: ExpenseType) => entry.is_active || entry.id === line?.expense_type_id)
    .map((entry) => ({
      value: entry.id,
      label: entry.is_active ? entry.name : `${entry.name} (inactive)`,
    }));

  const lineJob =
    line?.job && line.client
      ? {
          id: line.job.id,
          number: line.job.number,
          name: line.job.name,
          client_id: line.client.id,
          client_code: line.client.code,
          client_name: line.client.name,
          service_id: null,
          service_name: null,
        }
      : undefined;

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Expense type"
            required
            placeholder="Choose a type"
            options={typeOptions}
            value={typeId}
            onChange={(event) => onTypeChange(event.target.value)}
            error={errors.expense_type_id?.message}
          />
          <Controller
            control={control}
            name="incurred_on"
            render={({ field }) => (
              <DateField
                label="Date"
                required
                value={field.value || null}
                max={today}
                onChange={(value) => field.onChange(value ?? '')}
                error={errors.incurred_on?.message}
              />
            )}
          />
        </div>
        <Input
          label="Description"
          required
          autoComplete="off"
          maxLength={LIMITS.description}
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Supplier"
            autoComplete="off"
            maxLength={LIMITS.supplier}
            error={errors.supplier?.message}
            {...register('supplier')}
          />
          <Select
            label="Paid by"
            options={PAYER_OPTIONS}
            error={errors.payer?.message}
            {...register('payer')}
          />
        </div>
        {can('client.read') ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <ClientPicker
              label="Client"
              required={isBillable}
              clearable
              value={clientId || null}
              valueLabel={line?.client?.name}
              onChange={(id) => onClientChange(id)}
              hint="Leave empty for an overhead of the practice."
              error={errors.client_id?.message}
            />
            {can('job.read') ? (
              <JobPicker
                label="Job"
                clearable
                clientId={clientId || null}
                value={jobId || null}
                valueJob={lineJob}
                disabled={clientId === ''}
                onChange={(job) => setValue('job_id', job?.id ?? '', { shouldDirty: true })}
                error={errors.job_id?.message}
              />
            ) : null}
          </div>
        ) : null}

        {isMileage ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Miles"
              required
              inputMode="decimal"
              autoComplete="off"
              hint={
                settings.mileageRate === null
                  ? 'Priced at the practice mileage rate.'
                  : `Priced at ${formatRatePerMile(settings.mileageRate)}.`
              }
              error={errors.miles?.message}
              {...register('miles')}
            />
            <Select
              label="VAT code"
              options={vatChoices(vatCodes.data, line?.vat_rate_id ?? null)}
              error={errors.vat_rate_id?.message}
              {...register('vat_rate_id', { onChange: amounts.markVatCode })}
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Net (£)"
              inputMode="decimal"
              autoComplete="off"
              error={errors.net?.message}
              {...register('net', { onChange: amounts.onNetChange })}
            />
            <Select
              label="VAT code"
              options={vatChoices(vatCodes.data, line?.vat_rate_id ?? null)}
              error={errors.vat_rate_id?.message}
              {...register('vat_rate_id', { onChange: amounts.onVatCodeChange })}
            />
            <Input
              label="VAT (£)"
              inputMode="decimal"
              autoComplete="off"
              error={errors.vat?.message}
              {...register('vat', { onChange: amounts.onVatChange })}
            />
            <Input
              label="Gross (£)"
              inputMode="decimal"
              autoComplete="off"
              error={errors.gross?.message}
              {...register('gross', { onChange: amounts.onGrossChange })}
            />
          </div>
        )}
        <p aria-live="polite" className="text-xs text-text-muted">
          {preview
            ? `It comes to ${formatMoney(preview.net, currency)} net, ${formatMoney(preview.vat, currency)} VAT and ${formatMoney(preview.gross, currency)} gross.`
            : isMileage
              ? 'Enter the miles to see the amount.'
              : 'Enter the net or the gross amount: the VAT and the other amount follow.'}
        </p>

        <Controller
          control={control}
          name="is_billable"
          render={({ field }) => (
            <Switch
              label="Billable to the client"
              description={
                clientId === ''
                  ? 'Choose a client to charge this expense to.'
                  : 'The client is charged the net amount plus the practice markup.'
              }
              checked={field.value}
              disabled={clientId === ''}
              onChange={(checked) => {
                amounts.markBillable();
                field.onChange(checked);
              }}
            />
          )}
        />
        {errors.is_billable?.message ? (
          <p role="alert" className="-mt-2 text-xs font-medium text-danger">
            {errors.is_billable.message}
          </p>
        ) : null}
        {isBillable && canSetRecharge ? (
          <Input
            label="Recharge amount (£)"
            inputMode="decimal"
            autoComplete="off"
            hint={
              autoRecharge === null
                ? 'Leave empty to charge the net amount plus the practice markup.'
                : `Leave empty to charge ${formatMoney(autoRecharge, currency)}, the net amount plus the practice markup.`
            }
            error={errors.recharge_amount?.message}
            {...register('recharge_amount')}
          />
        ) : isBillable && autoRecharge !== null ? (
          <p className="text-xs text-text-muted">
            The client is charged {formatMoney(autoRecharge, currency)}, the net amount plus the
            practice markup.
          </p>
        ) : null}
        {correcting ? (
          <Textarea
            label="Reason for the correction"
            required
            rows={2}
            maxLength={LIMITS.reason}
            hint="Kept in the history of the claim with the old and the new figures."
            error={errors.reason?.message}
            {...register('reason')}
          />
        ) : null}
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
          loading={save.isPending}
          disabled={(line !== null && !isDirty && !correcting) || retryIn > 0}
        >
          {line ? (correcting ? 'Save correction' : 'Save expense') : 'Add expense'}
        </Button>
      </DialogActions>
    </>
  );
}

/**
 * Add an expense to a claim, change one, or (on an approved claim) correct one with a reason.
 * The amounts are linked as they are typed; the API works them out again and has the last word.
 */
export function LineFormDialog({
  claimId,
  line,
  correcting = false,
  open,
  onClose,
}: LineFormDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={line ? (correcting ? 'Correct expense' : 'Edit expense') : 'Add expense'}
      description={
        correcting
          ? 'The claim is approved: the correction needs a reason and is kept in its history.'
          : undefined
      }
      size="lg"
      closeOnBackdrop={false}
    >
      {open ? (
        <LineForm
          key={line?.id ?? 'new'}
          claimId={claimId}
          line={line}
          correcting={correcting}
          onClose={onClose}
        />
      ) : null}
    </Modal>
  );
}
