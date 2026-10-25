import { zodResolver } from '@hookform/resolvers/zod';
import { Lock } from 'lucide-react';
import { useId, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import {
  AddAnotherButton,
  Button,
  Checkbox,
  FormPanel,
  Input,
  Select,
  Textarea,
  useAddAnother,
  useToast,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { ClientPicker, JobPicker, useActivityTypes, useServices } from '@/features/team';
import { ApiError } from '@/services/api';
import { formatUkDate, todayInZone } from '@/utils/dates';
import { formatMinutes, parseMinutes, roundUpToIncrement } from '@/utils/minutes';
import { formatMoney } from '@/utils/money';

import { useCorrectEntry, useCreateEntry, useJobRefs, useUpdateEntry } from '../api';
import { RATE_SOURCE_LABEL } from '../constants';
import { correctionSchema, editSchema, type CorrectionValues } from '../schemas/entry';
import type { TimeCorrection, TimeEntry, TimeEntryCreate, TimeEntryUpdate } from '../types';
import { activityOptions } from '../utils/activities';
import { toFormError } from '../utils/errors';
import { refLabel } from '../utils/format';
import { DialogActions } from './DialogActions';
import { Notice } from './Notice';

const FIELDS = [
  'reason',
  'entry_date',
  'time',
  'client_id',
  'job_id',
  'activity_code_id',
  'description',
  'internal_note',
] as const;
/** API field → form field. */
const FIELD_NAMES = { minutes: 'time', date: 'entry_date' };

/** What the picker hands over of a job (the shape of `GET /jobs`). */
interface PickedJob {
  id: string;
  number: string;
  name: string;
  client_id: string;
  client_code: string;
  client_name: string;
  service_id: string | null;
  service_name: string | null;
}

export interface EntryDefaults {
  date?: string;
  minutes?: number;
  client?: { id: string; label?: string } | null;
  job?: PickedJob | null;
  activityId?: string | null;
  /** Fixes the billable status instead of working it out. */
  billable?: boolean;
}

export interface EntryPanelProps {
  open: boolean;
  onClose: () => void;
  /** The entry to change; without it a new one is recorded. */
  entry?: TimeEntry | null;
  /** Corrects approved, unbilled time: a reason is required and the change is listed first. */
  correction?: boolean;
  defaults?: EntryDefaults;
  /** Records the time of this person (needs `time.manage_all`). */
  onBehalfOf?: { id: string; name: string } | null;
  onSaved?: (entry: TimeEntry) => void;
}

function jobOf(entry: TimeEntry | null | undefined): PickedJob | null {
  if (!entry?.job_id) return null;
  return {
    id: entry.job_id,
    number: entry.job_number ?? '',
    name: entry.job_name ?? '',
    client_id: entry.client_id ?? '',
    client_code: entry.client_code ?? '',
    client_name: entry.client_name ?? '',
    service_id: entry.service_id,
    service_name: entry.service_name,
  };
}

interface Change {
  label: string;
  before: string;
  after: string;
}

function EntryForm({
  entry,
  correction = false,
  defaults,
  onBehalfOf,
  onClose,
  onSaved,
}: Omit<EntryPanelProps, 'open'>) {
  const { organization, can } = useOrg();
  const increment = organization.time_increment_minutes;
  const currency = organization.currency;
  const create = useCreateEntry();
  const update = useUpdateEntry();
  const correct = useCorrectEntry();
  const { toast } = useToast();
  const formId = useId();
  const again = useAddAnother();
  const readOnly = !correction && (entry?.is_locked ?? false);

  const [job, setJob] = useState<PickedJob | null>(jobOf(entry) ?? defaults?.job ?? null);
  const [clientLabel, setClientLabel] = useState<string | undefined>(
    entry?.client_id
      ? refLabel({ code: entry.client_code, name: entry.client_name })
      : defaults?.client?.label,
  );
  // null: worked out from the client, job and activity; true or false: the person chose.
  const [billableChoice, setBillableChoice] = useState<boolean | null>(defaults?.billable ?? null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    setFocus,
    getValues,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<CorrectionValues>({
    resolver: zodResolver(correction ? correctionSchema : editSchema),
    defaultValues: {
      reason: '',
      entry_date: entry?.entry_date ?? defaults?.date ?? todayInZone(organization.timezone),
      time: entry
        ? formatMinutes(entry.minutes)
        : defaults?.minutes
          ? formatMinutes(defaults.minutes)
          : '',
      client_id: entry?.client_id ?? defaults?.client?.id ?? defaults?.job?.client_id ?? '',
      job_id: entry?.job_id ?? defaults?.job?.id ?? '',
      activity_code_id: entry?.activity_code_id ?? defaults?.activityId ?? '',
      description: entry?.description ?? '',
      internal_note: entry?.internal_note ?? '',
    },
  });
  const [clientId, jobId, activityId, timeText, dateText, descriptionText, noteText] = useWatch({
    control,
    name: [
      'client_id',
      'job_id',
      'activity_code_id',
      'time',
      'entry_date',
      'description',
      'internal_note',
    ],
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<CorrectionValues>({ setError, fields: FIELDS });

  const activities = useActivityTypes();
  const services = useServices();
  const jobRefs = useJobRefs(jobId ? [jobId] : [], can(PERMISSIONS.jobRead));
  const activity = activities.data?.find((item) => item.id === activityId);

  const autoBillable =
    clientId !== '' &&
    activity?.is_chargeable !== false &&
    jobRefs.get(jobId)?.billing_basis !== 'non_billable';
  const identityChanged =
    entry !== null &&
    entry !== undefined &&
    (clientId !== (entry.client_id ?? '') ||
      jobId !== (entry.job_id ?? '') ||
      activityId !== (entry.activity_code_id ?? ''));
  const billable = billableChoice ?? (entry && !identityChanged ? entry.is_billable : autoBillable);

  const typed = parseMinutes(timeText);
  const rounded = typed !== null && typed > 0 ? roundUpToIncrement(typed, increment) : null;
  const roundingHint =
    rounded !== null && rounded !== typed
      ? `Time is recorded in steps of ${formatMinutes(increment)}, so this is saved as ${formatMinutes(rounded)}.`
      : undefined;

  const saving = create.isPending || update.isPending || correct.isPending;
  const canPickClient = can(PERMISSIONS.clientRead);
  const canPickJob = can(PERMISSIONS.jobRead);

  const options = activityOptions(
    activities.data,
    services.data,
    job?.service_id ?? null,
    entry?.activity_code_id ?? null,
  );

  /** The fields that differ from the entry, as the API takes them (`null` clears). */
  const changesAgainst = (values: CorrectionValues, minutes: number): TimeEntryUpdate => {
    const found: TimeEntryUpdate = {};
    if (!entry) return found;
    if (values.entry_date !== entry.entry_date) found.entry_date = values.entry_date;
    if (minutes !== entry.minutes) found.minutes = minutes;
    if ((values.client_id || null) !== entry.client_id) found.client_id = values.client_id || null;
    if ((values.job_id || null) !== entry.job_id) found.job_id = values.job_id || null;
    if ((values.activity_code_id || null) !== entry.activity_code_id) {
      found.activity_code_id = values.activity_code_id || null;
    }
    if ((values.description || null) !== entry.description) {
      found.description = values.description || null;
    }
    if ((values.internal_note || null) !== entry.internal_note) {
      found.internal_note = values.internal_note || null;
    }
    if (billableChoice !== null && billableChoice !== entry.is_billable) {
      found.is_billable = billableChoice;
    }
    return found;
  };

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const minutes = roundUpToIncrement(parseMinutes(values.time) ?? 0, increment);
    const onError = (error: unknown) => handleSubmitError(toFormError(error, FIELD_NAMES));
    const saved = (result: TimeEntry) => {
      toast({
        tone: 'success',
        title: correction ? 'Time corrected' : entry ? 'Time entry saved' : 'Time recorded',
        description: `${formatMinutes(result.minutes)} at ${formatMoney(result.charge_rate, currency)} an hour: ${formatMoney(result.charge_value, currency)}`,
      });
      onSaved?.(result);
      if (!entry && again.consume()) {
        // The next entry is usually for the same day, client, job and activity: keep those.
        reset({ ...getValues(), time: '', description: '', internal_note: '' });
        // reset() unregisters the fields until the next render, so focus after it.
        setTimeout(() => setFocus('time'), 0);
        return;
      }
      onClose();
    };

    if (!entry) {
      const body: TimeEntryCreate = { entry_date: values.entry_date, minutes };
      if (onBehalfOf) body.user_id = onBehalfOf.id;
      if (values.client_id) body.client_id = values.client_id;
      if (values.job_id) body.job_id = values.job_id;
      if (values.activity_code_id) body.activity_code_id = values.activity_code_id;
      if (values.description) body.description = values.description;
      if (values.internal_note) body.internal_note = values.internal_note;
      if (billableChoice !== null) body.is_billable = billableChoice;
      create.mutate(body, { onSuccess: saved, onError });
      return;
    }

    // PATCH is partial: send only what changed (null clears a reference, the note or the text).
    const changes = changesAgainst(values, minutes);
    if (Object.keys(changes).length === 0) {
      if (!correction) {
        onClose();
        return;
      }
      handleSubmitError(
        new ApiError({
          status: 422,
          code: 'TIME_CORRECTION_EMPTY',
          message: 'Change at least one field to correct this time.',
        }),
      );
      return;
    }
    if (correction) {
      const { entry_date: date, is_billable: billableValue, ...rest } = changes;
      const body: TimeCorrection = { reason: values.reason, ...rest };
      if (date !== undefined) body.date = date;
      if (billableValue !== undefined && billableValue !== null) body.billable = billableValue;
      correct.mutate({ entryId: entry.id, body }, { onSuccess: saved, onError });
      return;
    }
    update.mutate({ entryId: entry.id, body: changes }, { onSuccess: saved, onError });
  });

  /** Before and after of what is about to be corrected, for the person to check. */
  const pendingChanges: Change[] = [];
  if (correction && entry) {
    const none = '—';
    const text = (value: string | null | undefined) => (value ? value : none);
    const afterMinutes = rounded ?? typed;
    const consider = (label: string, before: string, after: string) => {
      if (before !== after) pendingChanges.push({ label, before, after });
    };
    consider('Date', formatUkDate(entry.entry_date), formatUkDate(dateText));
    consider(
      'Time',
      formatMinutes(entry.minutes),
      afterMinutes === null ? none : formatMinutes(afterMinutes),
    );
    consider(
      'Client',
      text(refLabel({ code: entry.client_code, name: entry.client_name })),
      text(clientId ? clientLabel : ''),
    );
    consider(
      'Job',
      text(refLabel({ code: entry.job_number, name: entry.job_name })),
      text(jobId && job ? refLabel({ code: job.number, name: job.name }) : ''),
    );
    consider('Activity', text(entry.activity_name), text(activity?.name));
    consider('Description', text(entry.description), text(descriptionText.trim()));
    consider('Internal note', text(entry.internal_note), text(noteText.trim()));
    consider(
      'Billable',
      entry.is_billable ? 'Billable' : 'Non-billable',
      billable ? 'Billable' : 'Non-billable',
    );
  }

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        {readOnly ? (
          <Notice tone="info" title="This time is locked">
            Its timesheet is submitted or approved, or it has been billed. Approved time that is not
            billed yet can be corrected from Time Entries.
          </Notice>
        ) : null}
        {onBehalfOf ? (
          <Notice tone="info" title={`Recording for ${onBehalfOf.name}`}>
            The time belongs to {onBehalfOf.name}; your name is kept as the person who entered it.
          </Notice>
        ) : null}
        {correction ? (
          <>
            <Notice tone="warning" title="This time is approved">
              A correction keeps the time as it was, who corrected it and why, and the before and
              after are listed in the history of the entry.
            </Notice>
            <Textarea
              label="Reason for the correction"
              required
              rows={2}
              hint="Required. It is kept with the correction."
              error={errors.reason?.message}
              {...register('reason')}
            />
          </>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Date"
            required
            type="date"
            disabled={readOnly}
            error={errors.entry_date?.message}
            {...register('entry_date')}
          />
          <Input
            label="Time"
            required
            autoComplete="off"
            placeholder="h:mm"
            disabled={readOnly}
            hint={roundingHint ?? 'Type 1:30, 1.5 or 1h 30m.'}
            error={errors.time?.message}
            {...register('time')}
          />
        </div>
        {canPickClient ? (
          <Controller
            control={control}
            name="client_id"
            render={({ field }) => (
              <ClientPicker
                label="Client"
                value={field.value || null}
                valueLabel={clientLabel}
                placeholder="No client (internal time)"
                disabled={readOnly}
                error={errors.client_id?.message}
                onChange={(id, item) => {
                  field.onChange(id ?? '');
                  setClientLabel(
                    item ? refLabel({ code: item.detail, name: item.label }) : undefined,
                  );
                  if (job && job.client_id !== id) {
                    setJob(null);
                    setValue('job_id', '', { shouldDirty: true });
                  }
                }}
              />
            )}
          />
        ) : null}
        {canPickJob ? (
          <Controller
            control={control}
            name="job_id"
            render={({ field }) => (
              <JobPicker
                label="Job"
                value={field.value || null}
                valueJob={job ?? undefined}
                clientId={clientId || null}
                placeholder="No job"
                disabled={readOnly}
                error={errors.job_id?.message}
                onChange={(picked) => {
                  field.onChange(picked?.id ?? '');
                  setJob(picked);
                  if (picked) {
                    setValue('client_id', picked.client_id, { shouldDirty: true });
                    setClientLabel(
                      refLabel({ code: picked.client_code, name: picked.client_name }),
                    );
                  }
                  const allowed = activityOptions(
                    activities.data,
                    services.data,
                    picked?.service_id ?? null,
                    null,
                  );
                  if (activityId && !allowed.some((option) => option.value === activityId)) {
                    setValue('activity_code_id', '', { shouldDirty: true });
                  }
                }}
              />
            )}
          />
        ) : null}
        <Select
          label="Activity"
          options={options}
          disabled={readOnly}
          hint={
            job?.service_name
              ? `Service: ${job.service_name}. Only the activities of that service are offered.`
              : undefined
          }
          error={errors.activity_code_id?.message}
          {...register('activity_code_id')}
        />
        <Textarea
          label="Description"
          rows={2}
          disabled={readOnly}
          hint="Shown on the timesheet and, when billed, on the invoice."
          error={errors.description?.message}
          {...register('description')}
        />
        <Textarea
          label="Internal note"
          rows={2}
          disabled={readOnly}
          hint="For your practice only: never printed on an invoice."
          error={errors.internal_note?.message}
          {...register('internal_note')}
        />
        <Checkbox
          label="Billable"
          description={
            billableChoice === null
              ? 'Worked out from the client, job and activity until you change it.'
              : undefined
          }
          checked={billable}
          disabled={readOnly}
          onChange={(event) => setBillableChoice(event.target.checked)}
        />
        {correction ? (
          <section
            aria-label="What will change"
            className="rounded-md border border-border bg-surface-sunken px-3 py-2.5"
          >
            <h3 className="text-xs font-semibold text-text">What will change</h3>
            {pendingChanges.length === 0 ? (
              <p className="mt-1 text-xs text-text-muted">Nothing yet. Change a field above.</p>
            ) : (
              <table className="mt-1.5 w-full text-xs">
                <thead>
                  <tr className="text-left text-text-muted">
                    <th scope="col" className="pr-3 pb-1 font-medium">
                      Field
                    </th>
                    <th scope="col" className="pr-3 pb-1 font-medium">
                      Before
                    </th>
                    <th scope="col" className="pb-1 font-medium">
                      After
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pendingChanges.map((change) => (
                    <tr key={change.label} className="align-top">
                      <th scope="row" className="pr-3 py-0.5 text-left font-medium text-text">
                        {change.label}
                      </th>
                      <td className="pr-3 py-0.5 text-text-muted line-through">{change.before}</td>
                      <td className="py-0.5 font-medium text-text">{change.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ) : null}
        {entry && !correction ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border bg-surface-sunken px-3 py-2.5 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-text-muted">Rate</dt>
              <dd className="font-medium text-text tabular-nums">
                {formatMoney(entry.charge_rate, currency)} / h
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Value</dt>
              <dd className="font-medium text-text tabular-nums">
                {formatMoney(entry.charge_value, currency)}
              </dd>
            </div>
            {entry.cost_value !== null ? (
              <div>
                <dt className="text-text-muted">Cost</dt>
                <dd className="font-medium text-text tabular-nums">
                  {formatMoney(entry.cost_value, currency)}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-text-muted">Rate from</dt>
              <dd className="font-medium text-text">
                {entry.rate_source
                  ? (RATE_SOURCE_LABEL[entry.rate_source] ?? entry.rate_source)
                  : '—'}
              </dd>
            </div>
          </dl>
        ) : null}
        {!entry ? (
          <p className="text-xs text-text-muted">
            The rate and the value are worked out when you save and kept with the entry.
          </p>
        ) : null}
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>
        {readOnly || entry ? null : (
          <AddAnotherButton
            formId={formId}
            flagRef={again.flagRef}
            loading={saving}
            disabled={retryIn > 0}
          />
        )}
        {readOnly ? null : (
          <Button
            type="submit"
            form={formId}
            {...again.primaryProps}
            variant="primary"
            loading={saving}
            disabled={(entry && !correction && !isDirty && billableChoice === null) || retryIn > 0}
          >
            {correction ? 'Correct time' : entry ? 'Save entry' : 'Record time'}
          </Button>
        )}
      </DialogActions>
    </>
  );
}

/** Record time, or change an entry: date, time, client, job, activity, description, note, billable. */
export function EntryPanel({
  open,
  onClose,
  entry,
  correction,
  defaults,
  onBehalfOf,
  onSaved,
}: EntryPanelProps) {
  const title = correction
    ? 'Correct approved time'
    : onBehalfOf
      ? `Record time for ${onBehalfOf.name}`
      : entry?.is_locked
        ? 'Time entry'
        : entry
          ? 'Edit time entry'
          : 'Record time';
  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title={title}
      description={
        entry ? (
          <>
            {entry.is_locked && !correction ? (
              <Lock className="mr-1 inline size-3" aria-hidden="true" />
            ) : null}
            {refLabel({ code: entry.client_code, name: entry.client_name }) || 'No client'}
          </>
        ) : undefined
      }
    >
      {open ? (
        <EntryForm
          key={`${entry?.id ?? 'new'}-${correction ? 'correct' : 'edit'}`}
          entry={entry}
          correction={correction}
          defaults={defaults}
          onBehalfOf={onBehalfOf}
          onClose={onClose}
          onSaved={onSaved}
        />
      ) : null}
    </FormPanel>
  );
}
