import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, FormPanel, Input, Textarea, useToast } from '@/components/ui';

import { useCreateSegment, useUpdateSegment } from '../../api/segmentHooks';
import { segmentSchema, type SegmentValues } from '../../schemas/segment';
import type { Segment, SegmentUpdate } from '../../segmentTypes';
import { toBillingFormError } from '../../utils/billingErrors';
import { DialogActions } from '../DialogActions';

const FIELDS = ['name', 'description'] as const;

export interface SegmentFormPanelProps {
  /** The segment to change, null to add one. */
  segment: Segment | null;
  open: boolean;
  onClose: () => void;
}

function SegmentForm({ segment, onClose }: { segment: Segment | null; onClose: () => void }) {
  const create = useCreateSegment();
  const update = useUpdateSegment();
  const { toast } = useToast();
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<SegmentValues>({
    resolver: zodResolver(segmentSchema),
    defaultValues: { name: segment?.name ?? '', description: segment?.description ?? '' },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<SegmentValues>({ setError, fields: FIELDS });
  const saving = create.isPending || update.isPending;

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const onError = (error: unknown) => handleSubmitError(toBillingFormError(error));

    if (!segment) {
      create.mutate(
        { name: values.name, description: values.description || null },
        {
          onSuccess: (created) => {
            toast({ tone: 'success', title: `${created.name} added` });
            onClose();
          },
          onError,
        },
      );
      return;
    }

    // PATCH is partial: send only what changed.
    const changes: SegmentUpdate = {};
    if (values.name !== segment.name) changes.name = values.name;
    if (values.description !== (segment.description ?? '')) {
      changes.description = values.description || null;
    }
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    update.mutate(
      { segmentId: segment.id, body: changes },
      {
        onSuccess: (saved) => {
          toast({ tone: 'success', title: `${saved.name} saved` });
          onClose();
        },
        onError,
      },
    );
  });

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <Input
          label="Name"
          required
          autoComplete="off"
          maxLength={40}
          hint={
            segment && segment.client_count > 0
              ? `Renaming also renames it on its ${segment.client_count} ${segment.client_count === 1 ? 'client' : 'clients'}.`
              : 'Shown wherever a client segment is chosen, for example Gold or Retail.'
          }
          error={errors.name?.message}
          {...register('name')}
        />
        <Textarea
          label="Description"
          rows={3}
          maxLength={500}
          hint="Optional. What puts a client in this segment."
          error={errors.description?.message}
          {...register('description')}
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
          loading={saving}
          disabled={(segment !== null && !isDirty) || retryIn > 0}
        >
          {segment ? 'Save segment' : 'Add segment'}
        </Button>
      </DialogActions>
    </>
  );
}

/** Add a client segment, or change one: its name and description. */
export function SegmentFormPanel({ segment, open, onClose }: SegmentFormPanelProps) {
  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title={segment ? 'Edit segment' : 'Add segment'}
      description={
        segment ? segment.name : 'A group of clients, for example Gold, Retail or Charities.'
      }
    >
      {open ? <SegmentForm key={segment?.id ?? 'new'} segment={segment} onClose={onClose} /> : null}
    </FormPanel>
  );
}
