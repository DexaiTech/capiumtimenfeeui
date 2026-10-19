import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { Button, Input, Modal, Textarea } from '@/components/ui';
import { formatMoney, parsePounds, penceToPoundsInput } from '@/utils/money';

import { prepareLineSchema, type PrepareLineValues } from '../../schemas/forms';
import type { VatOption } from '../../types';
import type { LineEdit, PreviewLine } from '../../utils/prepare';
import { DialogActions } from '../DialogActions';
import { VatSelect } from '../VatSelect';

export interface LineEditDialogProps {
  /** Null keeps the dialog closed. */
  line: PreviewLine | null;
  vatOptions: ReadonlyArray<VatOption>;
  currency: string;
  onClose: () => void;
  /** The edit of the line, or undefined when nothing differs from what the API drafts. */
  onSave: (key: string, edit: LineEdit | undefined) => void;
}

function LineForm({
  line,
  vatOptions,
  currency,
  onClose,
  onSave,
}: Omit<LineEditDialogProps, 'line'> & { line: PreviewLine }) {
  const formId = useId();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PrepareLineValues>({
    resolver: zodResolver(prepareLineSchema),
    defaultValues: {
      description: line.text,
      net: line.billed === null ? '' : penceToPoundsInput(line.billed),
      vat_rate_id: line.vatRateId ?? '',
    },
  });

  const submit = handleSubmit((values) => {
    const edit: LineEdit = {};
    const pence = values.net.trim() === '' ? null : parsePounds(values.net);
    if (pence !== null && pence !== line.net) edit.net = pence;
    if (values.description.trim() !== line.description)
      edit.description = values.description.trim();
    if (values.vat_rate_id !== '') edit.vatRateId = values.vat_rate_id;
    onSave(line.key, Object.keys(edit).length > 0 ? edit : undefined);
    onClose();
  });

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-4"
      >
        <Textarea
          label="Description"
          rows={3}
          error={errors.description?.message}
          {...register('description')}
        />
        <Input
          label={`Amount to bill (${currency === 'GBP' ? '£' : currency})`}
          inputMode="decimal"
          autoComplete="off"
          hint={
            line.net === null
              ? 'Empty: the fixed fee less what is already billed.'
              : `The work in progress on this line is ${formatMoney(line.wip, currency)}. Billing more writes work on; less writes it off.`
          }
          error={errors.net?.message}
          {...register('net')}
        />
        <VatSelect
          options={vatOptions}
          defaultLabel="Default for this client"
          {...register('vat_rate_id')}
        />
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form={formId} variant="primary">
          Save line
        </Button>
      </DialogActions>
    </>
  );
}

/** Changes what one line of the draft says, bills and charges VAT at, before the draft is made. */
export function LineEditDialog({ line, ...rest }: LineEditDialogProps) {
  return (
    <Modal
      open={line !== null}
      onClose={rest.onClose}
      title="Edit the line"
      description={line?.text}
      closeOnBackdrop={false}
    >
      {line ? <LineForm key={line.key} line={line} {...rest} /> : null}
    </Modal>
  );
}
