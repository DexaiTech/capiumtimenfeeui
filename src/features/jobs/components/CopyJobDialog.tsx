import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, DateField, Input, Modal, Switch, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { ClientPicker } from '@/features/team';

import { useCopyJob } from '../api';
import { LIMITS } from '../constants';
import { copySchema, type CopyValues } from '../schemas/job';
import type { Job } from '../types';
import { toFormError } from '../utils/errors';
import { jobLabel } from '../utils/format';
import { DialogActions } from './DialogActions';

const FIELDS = [
  'name',
  'client_id',
  'start_date',
  'due_date',
  'copy_tasks',
  'copy_assignees',
] as const;

export interface CopyJobDialogProps {
  open: boolean;
  onClose: () => void;
  job: Job;
  /** Called with the new job (status not started): the page opens it. */
  onCopied: (job: Job) => void;
}

interface CopyFormProps extends Omit<CopyJobDialogProps, 'open'> {
  formId: string;
}

function CopyForm({ job, onClose, onCopied, formId }: CopyFormProps) {
  const { can } = useOrg();
  const { toast } = useToast();
  const copy = useCopyJob();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<CopyValues>({
    resolver: zodResolver(copySchema),
    defaultValues: {
      name: `Copy of ${job.name}`.slice(0, LIMITS.jobName),
      client_id: job.client_id,
      start_date: job.start_date ?? '',
      due_date: job.due_date ?? '',
      copy_tasks: true,
      copy_assignees: true,
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } = useSubmitError<CopyValues>({
    setError,
    fields: FIELDS,
  });
  const clientValue = useWatch({ control, name: 'client_id' });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    copy.mutate(
      {
        jobId: job.id,
        body: {
          name: values.name,
          client_id: values.client_id,
          start_date: values.start_date || null,
          due_date: values.due_date || null,
          copy_tasks: values.copy_tasks,
          copy_assignees: values.copy_assignees,
        },
      },
      {
        onSuccess: (created) => {
          toast({ tone: 'success', title: 'Job copied', description: jobLabel(created) });
          onCopied(created);
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
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <Input
          label="Name of the new job"
          autoComplete="off"
          maxLength={LIMITS.jobName}
          error={errors.name?.message}
          {...register('name')}
        />
        {can('client.read') ? (
          <ClientPicker
            label="Client"
            value={clientValue || null}
            valueLabel={job.client_name}
            onChange={(id) => setValue('client_id', id ?? '', { shouldDirty: true })}
            error={errors.client_id?.message}
          />
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="start_date"
            render={({ field }) => (
              <DateField
                label="Start date"
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? '')}
                error={errors.start_date?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="due_date"
            render={({ field }) => (
              <DateField
                label="Due date"
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? '')}
                error={errors.due_date?.message}
              />
            )}
          />
        </div>
        <Controller
          control={control}
          name="copy_tasks"
          render={({ field }) => (
            <Switch
              label="Copy the tasks"
              description="They start as not started, without any time."
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="copy_assignees"
          render={({ field }) => (
            <Switch
              label="Copy who it is assigned to"
              description="The job's assignees and, with the tasks, theirs."
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <p className="text-xs text-text-muted">
          The copy starts as not started. Time, work in progress and invoices are not copied.
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
          loading={copy.isPending}
          disabled={retryIn > 0}
        >
          Copy job
        </Button>
      </DialogActions>
    </>
  );
}

/** Starts a new job from this one: its details, fees, budgets and, if wanted, its tasks. */
export function CopyJobDialog({ open, onClose, ...rest }: CopyJobDialogProps) {
  const formId = useId();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Copy job"
      description={jobLabel(rest.job)}
      size="md"
      closeOnBackdrop={false}
    >
      {open ? <CopyForm key={rest.job.id} formId={formId} onClose={onClose} {...rest} /> : null}
    </Modal>
  );
}
