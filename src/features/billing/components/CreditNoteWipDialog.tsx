import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Modal, SegmentedControl, Textarea, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatMoney } from '@/utils/money';

import { useCreditNoteWip } from '../api';
import { creditNoteWipSchema, type CreditNoteWipValues } from '../schemas/forms';
import { toFormError } from '../utils/errors';
import { DialogActions } from './DialogActions';

export interface CreditNoteWipDialogProps {
  open: boolean;
  onClose: () => void;
  creditNote: { id: string; number: string };
}

function WipForm({ creditNote, onClose }: Omit<CreditNoteWipDialogProps, 'open'>) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const apply = useCreditNoteWip();
  const formId = useId();
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CreditNoteWipValues>({
    resolver: zodResolver(creditNoteWipSchema),
    defaultValues: { mode: 'return', reason: '' },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<CreditNoteWipValues>({ setError, fields: ['mode', 'reason'] });

  const submit = handleSubmit((values) => {
    clearSubmitError();
    apply.mutate(
      { creditNoteId: creditNote.id, mode: values.mode, reason: values.reason },
      {
        onSuccess: (result) => {
          const amount = formatMoney(result.wip_value, organization.currency);
          toast({
            tone: 'success',
            title: result.mode === 'return' ? 'Work returned to WIP' : 'Work written off',
            description: `${amount} of work on ${creditNote.number} (${result.item_count} ${result.item_count === 1 ? 'item' : 'items'}).`,
          });
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
        <Controller
          control={control}
          name="mode"
          render={({ field }) => (
            <SegmentedControl
              label="What happens to the work"
              options={[
                { value: 'return', label: 'Return to WIP' },
                { value: 'write_off', label: 'Write off' },
              ]}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <p className="text-sm text-text-muted">
          <strong className="font-medium text-text">Return to WIP</strong>: the work the credit note
          clears becomes unbilled again, so it can be billed on another invoice.{' '}
          <strong className="font-medium text-text">Write off</strong>: it is written off and will
          not be billed. This can be done once for each credit note.
        </p>
        <Textarea
          label="Reason"
          rows={2}
          hint="Required. Kept in the audit log."
          error={errors.reason?.message}
          {...register('reason')}
        />
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Not now</Button>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          loading={apply.isPending}
          disabled={retryIn > 0}
        >
          Apply
        </Button>
      </DialogActions>
    </>
  );
}

/** After a credit note: bring the work it cleared back into WIP, or write it off. */
export function CreditNoteWipDialog({ open, onClose, creditNote }: CreditNoteWipDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Credit note ${creditNote.number}: the work`}
      description="The credit note reduced what the client owes. Decide what happens to the work it cleared."
      closeOnBackdrop={false}
    >
      {open ? <WipForm creditNote={creditNote} onClose={onClose} /> : null}
    </Modal>
  );
}
