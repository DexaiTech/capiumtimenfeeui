import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import {
  Button,
  DateField,
  Input,
  Modal,
  SegmentedControl,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { ClientPicker, JobPicker } from '@/features/team';
import { todayInZone } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { useCreateAdjustment } from '../api';
import { COMPONENT_LABEL, REASON_MAX } from '../constants';
import {
  adjustmentDefaults,
  adjustmentSchema,
  toAdjustmentInput,
  type AdjustmentValues,
} from '../schemas/wip';
import { WIP_COMPONENTS } from '../types';
import { toFormError } from '../utils/errors';
import { DialogActions } from './DialogActions';

const FIELDS = [
  'client_id',
  'job_id',
  'kind',
  'amount',
  'component',
  'effective_date',
  'reason',
] as const;

const KINDS = [
  { value: 'write_off', label: 'Write off' },
  { value: 'write_on', label: 'Write on' },
] as const;

export interface AdjustmentFormDialogProps {
  open: boolean;
  onClose: () => void;
}

function AdjustmentForm({ onClose, formId }: { onClose: () => void; formId: string }) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const create = useCreateAdjustment();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<AdjustmentValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: adjustmentDefaults(),
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<AdjustmentValues>({ setError, fields: FIELDS });
  const [clientId, jobId, kind] = useWatch({ control, name: ['client_id', 'job_id', 'kind'] });
  const today = todayInZone(organization.timezone);
  const limit = formatMoney(organization.wip_adjustment_approval_threshold, organization.currency);

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    create.mutate(toAdjustmentInput(values), {
      onSuccess: (created) => {
        toast({
          tone: 'success',
          title: created.status === 'approved' ? 'WIP adjusted' : 'Sent for approval',
          description: `${formatMoney(created.amount, organization.currency)} ${
            created.kind === 'write_on' ? 'written on' : 'written off'
          }`,
        });
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
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <ClientPicker
          label="Client"
          value={clientId || null}
          onChange={(id) => {
            setValue('client_id', id ?? '', { shouldDirty: true });
            setValue('job_id', '');
          }}
          error={errors.client_id?.message}
        />
        <JobPicker
          label="Job"
          hint="Leave empty to adjust the client's WIP as a whole"
          clearable
          value={jobId || null}
          clientId={clientId || null}
          disabled={clientId === ''}
          onChange={(job) => setValue('job_id', job?.id ?? '', { shouldDirty: true })}
          error={errors.job_id?.message}
        />
        <SegmentedControl
          label="Adjustment"
          options={KINDS}
          value={kind}
          onChange={(value) => setValue('kind', value, { shouldDirty: true })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Amount (£)"
            inputMode="decimal"
            autoComplete="off"
            hint={`Above ${limit} needs approval`}
            error={errors.amount?.message}
            {...register('amount')}
          />
          <Select
            label="Kind of WIP"
            options={[
              { value: '', label: 'Let the system choose' },
              ...WIP_COMPONENTS.map((item) => ({ value: item, label: COMPONENT_LABEL[item] })),
            ]}
            error={errors.component?.message}
            {...register('component')}
          />
        </div>
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
          Adjust WIP
        </Button>
      </DialogActions>
    </>
  );
}

/** Writes a client's or a job's WIP on or off, with a reason; a large amount waits for approval. */
export function AdjustmentFormDialog({ open, onClose }: AdjustmentFormDialogProps) {
  const formId = useId();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust WIP"
      description="Add to or take from the work in progress without an invoice."
      size="md"
      closeOnBackdrop={false}
    >
      {open ? <AdjustmentForm formId={formId} onClose={onClose} /> : null}
    </Modal>
  );
}
