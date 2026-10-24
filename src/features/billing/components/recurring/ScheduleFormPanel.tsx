import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, DateField, Input, FormPanel, Select, Textarea, useToast } from '@/components/ui';
import { ClientPicker } from '@/features/clients';
import { useOrg } from '@/features/organizations';
import { todayInZone } from '@/utils/dates';

import { useCreateSchedule, useUpdateSchedule } from '../../api';
import { SCHEDULE_FREQUENCY_LABELS } from '../../constants';
import { scheduleSchema, type ScheduleValues } from '../../schemas/forms';
import {
  SCHEDULE_FREQUENCIES,
  type Schedule,
  type ScheduleCreate,
  type ScheduleUpdate,
} from '../../types';
import { emptyLine, linesToValues, sameLines, valuesToInputs } from '../../utils/documentLines';
import { toFormError } from '../../utils/errors';
import { clientLabel, dateCell } from '../../utils/format';
import { DialogActions } from '../DialogActions';
import { LineItemsEditor } from '../documents/LineItemsEditor';

export interface ScheduleFormPanelProps {
  open: boolean;
  onClose: () => void;
  /** The schedule to change; null sets up a new one. */
  schedule: Schedule | null;
  /** Called with the schedule the API stored. */
  onSaved: (schedule: Schedule) => void;
}

const FIELDS = [
  'client_id',
  'name',
  'frequency',
  'start_date',
  'end_date',
  'reference',
  'notes',
  'lines',
] as const;

const FREQUENCY_CHOICES = SCHEDULE_FREQUENCIES.map((value) => ({
  value,
  label: SCHEDULE_FREQUENCY_LABELS[value],
}));

function ScheduleForm({ schedule, onClose, onSaved }: Omit<ScheduleFormPanelProps, 'open'>) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const create = useCreateSchedule();
  const update = useUpdateSchedule(schedule?.id ?? '');
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<ScheduleValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      client_id: schedule?.client?.id ?? '',
      name: schedule?.name ?? '',
      frequency: schedule?.frequency ?? 'monthly',
      start_date: schedule?.start_date ?? todayInZone(organization.timezone),
      end_date: schedule?.end_date ?? '',
      reference: schedule?.reference ?? '',
      notes: schedule?.notes ?? '',
      lines: schedule ? linesToValues(schedule.lines) : [emptyLine()],
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<ScheduleValues>({ setError, fields: FIELDS });

  const submit = handleSubmit((form) => {
    clearSubmitError();
    const lines = valuesToInputs(form.lines);
    const onError = (error: unknown) => handleSubmitError(toFormError(error));
    if (!schedule) {
      const body: ScheduleCreate = {
        client_id: form.client_id,
        name: form.name,
        frequency: form.frequency,
        start_date: form.start_date,
        ...(form.end_date ? { end_date: form.end_date } : {}),
        ...(form.reference ? { reference: form.reference } : {}),
        ...(form.notes ? { notes: form.notes } : {}),
        lines,
      };
      create.mutate(body, {
        onSuccess: (saved) => {
          toast({
            tone: 'success',
            title: 'Schedule created',
            description: 'The first invoice is drafted on the start date.',
          });
          onSaved(saved);
        },
        onError,
      });
      return;
    }
    // The client and the start date never change; the rest is sent when it differs.
    const changes: ScheduleUpdate = {};
    if (form.name !== schedule.name) changes.name = form.name;
    if (form.frequency !== schedule.frequency) changes.frequency = form.frequency;
    if (form.end_date !== (schedule.end_date ?? '')) changes.end_date = form.end_date || null;
    if (form.reference !== (schedule.reference ?? '')) changes.reference = form.reference || null;
    if (form.notes !== (schedule.notes ?? '')) changes.notes = form.notes || null;
    if (!sameLines(lines, valuesToInputs(linesToValues(schedule.lines)))) changes.lines = lines;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    update.mutate(changes, {
      onSuccess: (saved) => {
        toast({ tone: 'success', title: 'Schedule saved' });
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
        aria-label={schedule ? 'Edit schedule' : 'New schedule'}
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-4"
      >
        {schedule ? (
          <p className="text-sm text-text-muted">
            Client:{' '}
            <strong className="font-medium text-text">{clientLabel(schedule.client)}</strong>.
            Started on {dateCell(schedule.start_date)}. The client and the start date cannot be
            changed.
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
        <Input
          label="Name"
          required
          autoComplete="off"
          hint="What you call this schedule, for example Monthly bookkeeping."
          error={errors.name?.message}
          {...register('name')}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Frequency"
            required
            options={FREQUENCY_CHOICES}
            error={errors.frequency?.message}
            {...register('frequency')}
          />
          {schedule ? null : (
            <Controller
              control={control}
              name="start_date"
              render={({ field }) => (
                <DateField
                  label="Start date"
                  required
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? '')}
                  error={errors.start_date?.message}
                />
              )}
            />
          )}
          <Controller
            control={control}
            name="end_date"
            render={({ field }) => (
              <DateField
                label="End date (optional)"
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? '')}
                error={errors.end_date?.message}
              />
            )}
          />
        </div>
        <p className="text-sm text-text-muted">
          A draft invoice is created on the start date and then each period. It is never issued
          automatically: you review and issue each draft.
        </p>
        <Input
          label="Reference (optional)"
          autoComplete="off"
          error={errors.reference?.message}
          {...register('reference')}
        />
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
          {schedule ? 'Save schedule' : 'Create schedule'}
        </Button>
      </DialogActions>
    </>
  );
}

/** Sets up a recurring invoice schedule, or changes one that has not ended. */
export function ScheduleFormPanel({ open, onClose, schedule, onSaved }: ScheduleFormPanelProps) {
  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title={schedule ? 'Edit schedule' : 'New schedule'}
      description={
        schedule
          ? 'Changes apply to the invoices drafted from now on.'
          : 'The lines below become the draft invoice of every run.'
      }
    >
      {open ? (
        <ScheduleForm
          key={schedule?.id ?? 'new'}
          schedule={schedule}
          onClose={onClose}
          onSaved={onSaved}
        />
      ) : null}
    </FormPanel>
  );
}
