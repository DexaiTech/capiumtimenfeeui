import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, DateField, Modal, Textarea, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { todayInZone } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { useCreateWriteOff } from '../api';
import { REASON_MAX } from '../constants';
import { toWriteOffInput, writeOffSchema, type WriteOffValues } from '../schemas/wip';
import type { WipItem } from '../types';
import { toFormError } from '../utils/errors';
import { writeOffRef } from '../utils/items';
import { DialogActions } from './DialogActions';

const FIELDS = ['reason', 'written_off_on'] as const;

/** The usual reasons, one click each instead of typing. */
const REASONS = ['Uncollectable', 'Goodwill to the client', 'Entered in error', 'Over budget'];

export interface WriteOffDialogProps {
  open: boolean;
  onClose: () => void;
  /** The items to write off: unbilled items of one client that a write-off may take. */
  items: ReadonlyArray<WipItem>;
  /** Called once the items are written off. */
  onDone: () => void;
}

interface FormProps extends Omit<WriteOffDialogProps, 'open'> {
  formId: string;
}

function WriteOffForm({ items, onClose, onDone, formId }: FormProps) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const writeOff = useCreateWriteOff();
  const client = items[0]?.client ?? null;
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<WriteOffValues>({
    resolver: zodResolver(writeOffSchema),
    defaultValues: { reason: '', written_off_on: '' },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<WriteOffValues>({ setError, fields: FIELDS });
  const today = todayInZone(organization.timezone);

  const onSubmit = handleSubmit((values) => {
    if (!client) return;
    clearSubmitError();
    writeOff.mutate(toWriteOffInput(values, client.id, items.map(writeOffRef)), {
      onSuccess: () => {
        toast({
          tone: 'success',
          title: 'WIP written off',
          description: `${formatMoney(total, organization.currency)} for ${client.name}`,
        });
        onDone();
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
        <p className="text-sm text-text-muted">
          {items.length === 1 ? '1 item' : `${String(items.length)} items`} worth{' '}
          <strong className="font-semibold text-text">
            {formatMoney(total, organization.currency)}
          </strong>
          {client ? ` for ${client.name}` : ''} will leave the work in progress without being
          billed.
        </p>
        <div role="group" aria-label="Common reasons" className="flex flex-wrap gap-2">
          {REASONS.map((reason) => (
            <Button
              key={reason}
              size="sm"
              onClick={() =>
                setValue('reason', reason, { shouldDirty: true, shouldValidate: true })
              }
            >
              {reason}
            </Button>
          ))}
        </div>
        <Textarea
          label="Reason"
          required
          rows={3}
          maxLength={REASON_MAX}
          error={errors.reason?.message}
          {...register('reason')}
        />
        <Controller
          control={control}
          name="written_off_on"
          render={({ field }) => (
            <DateField
              label="Written off on"
              hint="Today if left empty"
              max={today}
              value={field.value || null}
              onChange={(value) => field.onChange(value ?? '')}
              error={errors.written_off_on?.message}
            />
          )}
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
          variant="danger"
          loading={writeOff.isPending}
          disabled={retryIn > 0}
        >
          Write off
        </Button>
      </DialogActions>
    </>
  );
}

/** Takes the chosen items out of the WIP without an invoice. */
export function WriteOffDialog({ open, onClose, ...rest }: WriteOffDialogProps) {
  const formId = useId();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Write off WIP"
      description={rest.items[0]?.client?.name}
      size="md"
      closeOnBackdrop={false}
    >
      {open ? <WriteOffForm formId={formId} onClose={onClose} {...rest} /> : null}
    </Modal>
  );
}
