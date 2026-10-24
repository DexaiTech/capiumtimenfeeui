import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import {
  Button,
  Checkbox,
  DateField,
  Input,
  Modal,
  SegmentedControl,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { ClientPicker, JobPicker } from '@/features/team';
import { formatUkDate, todayInZone } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { flattenPages, useCreateTransfer, useWipItems } from '../api';
import { COMPONENT_LABEL, ITEM_KIND_META, REASON_MAX } from '../constants';
import {
  toTransferInput,
  transferDefaults,
  transferSchema,
  type TransferValues,
} from '../schemas/wip';
import { WIP_COMPONENTS, type ClientRef, type WipItem, type WipJobRef } from '../types';
import { toFormError } from '../utils/errors';
import { jobText, personName } from '../utils/format';
import { isTakeable, itemKey, transferProblem, transferRef } from '../utils/items';
import { DialogActions } from './DialogActions';

const FIELDS = [
  'client_id',
  'from_job_id',
  'to_job_id',
  'amount',
  'component',
  'item_keys',
  'effective_date',
  'reason',
] as const;

const MODES = [
  { value: 'amount', label: 'An amount' },
  { value: 'items', label: 'Specific items' },
] as const;

/** Items already chosen elsewhere (the item list): the dialog only asks where they go. */
export interface TransferPreset {
  client: ClientRef;
  fromJob: WipJobRef;
  items: ReadonlyArray<WipItem>;
}

export interface TransferDialogProps {
  open: boolean;
  onClose: () => void;
  preset?: TransferPreset | null;
  /** Called once the WIP is transferred. */
  onDone: () => void;
}

interface FormProps extends Omit<TransferDialogProps, 'open'> {
  formId: string;
}

function TransferForm({ preset = null, onClose, onDone, formId }: FormProps) {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const create = useCreateTransfer();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<TransferValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: preset
      ? {
          ...transferDefaults(),
          client_id: preset.client.id,
          from_job_id: preset.fromJob.id,
          mode: 'items',
          item_keys: preset.items.map(itemKey),
        }
      : transferDefaults(),
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<TransferValues>({ setError, fields: FIELDS });
  const [clientId, fromJobId, mode, keys] = useWatch({
    control,
    name: ['client_id', 'from_job_id', 'mode', 'item_keys'],
  });
  const today = todayInZone(organization.timezone);

  const listing = useWipItems(
    {
      job_id: fromJobId || undefined,
      kind: ['time', 'disbursement', 'expense'],
      sort: 'date',
      order: 'asc',
    },
    { enabled: !preset && mode === 'items' && fromJobId !== '' },
  );
  const available = preset ? [...preset.items] : flattenPages(listing.data).filter(isTakeable);

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const chosen =
      values.mode === 'items'
        ? available.filter((item) => values.item_keys.includes(itemKey(item)))
        : [];
    const problem = values.mode === 'items' ? transferProblem(chosen) : null;
    if (problem) {
      setError('item_keys', { type: 'validate', message: problem });
      return;
    }
    create.mutate(toTransferInput(values, chosen.map(transferRef)), {
      onSuccess: (transfer) => {
        toast({
          tone: 'success',
          title: 'WIP transferred',
          description: `${formatMoney(transfer.amount, organization.currency)} moved`,
        });
        onDone();
      },
      onError: (error) => handleSubmitError(toFormError(error)),
    });
  });

  const toggle = (key: string, checked: boolean) =>
    setValue('item_keys', checked ? [...keys, key] : keys.filter((entry) => entry !== key), {
      shouldDirty: true,
      shouldValidate: true,
    });

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        {preset ? (
          <dl className="grid gap-2 rounded-md border border-border bg-surface px-3 py-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Client</dt>
              <dd className="text-text">{preset.client.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">From</dt>
              <dd className="text-text">{jobText(preset.fromJob)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Moving</dt>
              <dd className="text-text">
                {preset.items.length === 1 ? '1 item' : `${String(preset.items.length)} items`}{' '}
                worth{' '}
                {formatMoney(
                  preset.items.reduce((sum, item) => sum + item.value, 0),
                  organization.currency,
                )}
              </dd>
            </div>
          </dl>
        ) : (
          <>
            {can(PERMISSIONS.clientRead) ? (
              <ClientPicker
                label="Client"
                required
                value={clientId || null}
                onChange={(id) => {
                  setValue('client_id', id ?? '', { shouldDirty: true });
                  setValue('from_job_id', '');
                  setValue('to_job_id', '');
                  setValue('item_keys', []);
                }}
                error={errors.client_id?.message}
              />
            ) : null}
            <JobPicker
              label="From job"
              required
              hint="The job the WIP leaves"
              value={fromJobId || null}
              clientId={clientId || null}
              disabled={clientId === ''}
              onChange={(job) => {
                setValue('from_job_id', job?.id ?? '', { shouldDirty: true });
                setValue('item_keys', []);
              }}
              error={errors.from_job_id?.message}
            />
          </>
        )}
        <Controller
          control={control}
          name="to_job_id"
          render={({ field }) => (
            <JobPicker
              label="To job"
              required
              hint="Both jobs must be the same client's and open"
              value={field.value || null}
              clientId={clientId || null}
              disabled={clientId === ''}
              onChange={(job) => field.onChange(job?.id ?? '')}
              error={errors.to_job_id?.message}
            />
          )}
        />
        {preset ? null : (
          <SegmentedControl
            label="What to move"
            options={MODES}
            value={mode}
            onChange={(value) => setValue('mode', value, { shouldDirty: true })}
          />
        )}
        {mode === 'amount' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Amount (£)"
              required
              inputMode="decimal"
              autoComplete="off"
              error={errors.amount?.message}
              {...register('amount')}
            />
            <Select
              label="Kind of WIP"
              options={[
                { value: '', label: 'Let the system choose' },
                ...WIP_COMPONENTS.map((item) => ({ value: item, label: COMPONENT_LABEL[item] })),
              ]}
              {...register('component')}
            />
          </div>
        ) : null}
        {mode === 'items' && !preset ? (
          <fieldset className="flex flex-col gap-1.5" aria-required="true">
            <legend className="field-required mb-1 text-sm font-medium text-text">
              Items to move
            </legend>
            {fromJobId === '' ? (
              <p className="text-xs text-text-muted">Choose the job the WIP leaves first.</p>
            ) : listing.isPending ? (
              <p className="text-xs text-text-muted">Loading the WIP of the job…</p>
            ) : available.length === 0 ? (
              <p className="text-xs text-text-muted">This job has no unbilled items to move.</p>
            ) : (
              <div className="flex max-h-56 flex-col overflow-y-auto rounded-md border border-border px-3 py-1">
                {available.map((item) => (
                  <Checkbox
                    key={itemKey(item)}
                    label={`${formatUkDate(item.date)} · ${item.description ?? ITEM_KIND_META[item.kind].label}`}
                    description={`${ITEM_KIND_META[item.kind].label} · ${personName(item.person)} · ${formatMoney(item.value, organization.currency)}`}
                    checked={keys.includes(itemKey(item))}
                    onChange={(event) => toggle(itemKey(item), event.target.checked)}
                  />
                ))}
              </div>
            )}
            {listing.hasNextPage ? (
              <Button
                size="sm"
                loading={listing.isFetchingNextPage}
                onClick={() => void listing.fetchNextPage()}
              >
                Load more
              </Button>
            ) : null}
            {errors.item_keys?.message ? (
              <p role="alert" className="text-xs font-medium text-danger">
                {errors.item_keys.message}
              </p>
            ) : null}
          </fieldset>
        ) : null}
        <Controller
          control={control}
          name="effective_date"
          render={({ field }) => (
            <DateField
              label="Effective date"
              hint="Today if left empty"
              max={today}
              value={field.value || null}
              onChange={(value) => field.onChange(value ?? '')}
              error={errors.effective_date?.message}
            />
          )}
        />
        <Textarea
          label="Reason"
          required
          rows={3}
          maxLength={REASON_MAX}
          error={errors.reason?.message}
          {...register('reason')}
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
          loading={create.isPending}
          disabled={retryIn > 0}
        >
          Transfer WIP
        </Button>
      </DialogActions>
    </>
  );
}

/** Moves WIP from one job to another job of the same client, by amount or by items. */
export function TransferDialog({ open, onClose, ...rest }: TransferDialogProps) {
  const formId = useId();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transfer WIP"
      description="Move work in progress between two jobs of the same client."
      size="md"
      closeOnBackdrop={false}
    >
      {open ? <TransferForm formId={formId} onClose={onClose} {...rest} /> : null}
    </Modal>
  );
}
