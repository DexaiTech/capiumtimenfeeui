import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, DateField, Input, FormPanel, Textarea, useToast } from '@/components/ui';
import { ClientPicker } from '@/features/clients';
import { useOrg } from '@/features/organizations';

import { useCreateEstimate, useUpdateEstimate } from '../../api';
import { estimateSchema, type EstimateValues } from '../../schemas/forms';
import type { Estimate, EstimateCreate, EstimateUpdate } from '../../types';
import { emptyLine, linesToValues, sameLines, valuesToInputs } from '../../utils/documentLines';
import { toFormError } from '../../utils/errors';
import { clientLabel } from '../../utils/format';
import { DialogActions } from '../DialogActions';
import { LineItemsEditor } from '../documents/LineItemsEditor';

export interface EstimateFormPanelProps {
  open: boolean;
  onClose: () => void;
  /** The draft to change; null raises a new estimate. */
  estimate: Estimate | null;
  /** Called with the estimate the API stored. */
  onSaved: (estimate: Estimate) => void;
}

const FIELDS = ['client_id', 'expiry_date', 'reference', 'notes', 'lines'] as const;

function EstimateForm({ estimate, onClose, onSaved }: Omit<EstimateFormPanelProps, 'open'>) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const create = useCreateEstimate();
  const update = useUpdateEstimate(estimate?.id ?? '');
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<EstimateValues>({
    resolver: zodResolver(estimateSchema),
    defaultValues: {
      client_id: estimate?.client?.id ?? '',
      expiry_date: estimate?.expiry_date ?? '',
      reference: estimate?.reference ?? '',
      notes: estimate?.notes ?? '',
      lines: estimate ? linesToValues(estimate.lines) : [emptyLine()],
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<EstimateValues>({ setError, fields: FIELDS });

  const submit = handleSubmit((form) => {
    clearSubmitError();
    const lines = valuesToInputs(form.lines);
    const onError = (error: unknown) => handleSubmitError(toFormError(error));
    if (!estimate) {
      const body: EstimateCreate = {
        client_id: form.client_id,
        ...(form.expiry_date ? { expiry_date: form.expiry_date } : {}),
        ...(form.reference ? { reference: form.reference } : {}),
        ...(form.notes ? { notes: form.notes } : {}),
        lines,
      };
      create.mutate(body, {
        onSuccess: (saved) => {
          toast({ tone: 'success', title: 'Estimate created', description: 'It is a draft.' });
          onSaved(saved);
        },
        onError,
      });
      return;
    }
    // Only what changed is sent; an emptied field is sent as null to clear it.
    const changes: EstimateUpdate = {};
    if (form.expiry_date !== (estimate.expiry_date ?? '')) {
      changes.expiry_date = form.expiry_date || null;
    }
    if (form.reference !== (estimate.reference ?? '')) changes.reference = form.reference || null;
    if (form.notes !== (estimate.notes ?? '')) changes.notes = form.notes || null;
    if (!sameLines(lines, valuesToInputs(linesToValues(estimate.lines)))) changes.lines = lines;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    update.mutate(changes, {
      onSuccess: (saved) => {
        toast({ tone: 'success', title: 'Estimate saved' });
        onSaved(saved);
      },
      onError,
    });
  });

  return (
    <>
      <form
        id={formId}
        noValidate
        aria-label={estimate ? 'Edit estimate' : 'New estimate'}
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-4"
      >
        {estimate ? (
          <p className="text-sm text-text-muted">
            Client:{' '}
            <strong className="font-medium text-text">{clientLabel(estimate.client)}</strong>
          </p>
        ) : (
          <Controller
            control={control}
            name="client_id"
            render={({ field }) => (
              <ClientPicker
                label="Client"
                required
                value={field.value || null}
                onChange={(client) => field.onChange(client?.id ?? '')}
                error={errors.client_id?.message}
                listPlacement="inline"
              />
            )}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Reference (optional)"
            autoComplete="off"
            error={errors.reference?.message}
            {...register('reference')}
          />
          <Controller
            control={control}
            name="expiry_date"
            render={({ field }) => (
              <DateField
                label="Expires on (optional)"
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? '')}
                error={errors.expiry_date?.message}
              />
            )}
          />
        </div>
        <Textarea
          label="Notes (optional)"
          rows={3}
          error={errors.notes?.message}
          {...register('notes')}
        />
        <LineItemsEditor
          control={control}
          register={register}
          errors={errors}
          currency={organization.currency}
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
          loading={create.isPending || update.isPending}
          disabled={retryIn > 0}
        >
          {estimate ? 'Save estimate' : 'Create estimate'}
        </Button>
      </DialogActions>
    </>
  );
}

/**
 * Raises an estimate, or changes a draft. The estimate stays a draft, without a number, until it
 * is sent. Saved lines replace the old ones as a whole.
 */
export function EstimateFormPanel({ open, onClose, estimate, onSaved }: EstimateFormPanelProps) {
  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title={estimate ? 'Edit estimate' : 'New estimate'}
      description={
        estimate
          ? 'Only a draft can be changed.'
          : 'A draft is saved without a number; sending it numbers it.'
      }
    >
      {open ? (
        <EstimateForm
          key={estimate?.id ?? 'new'}
          estimate={estimate}
          onClose={onClose}
          onSaved={onSaved}
        />
      ) : null}
    </FormPanel>
  );
}
