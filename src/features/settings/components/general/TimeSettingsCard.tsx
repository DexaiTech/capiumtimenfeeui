import { Controller, useWatch } from 'react-hook-form';

import { Input, Select, Switch } from '@/components/ui';
import { WEEKDAYS } from '@/features/organizations';
import type { Organization, OrganizationUpdate, TimeIncrement } from '@/types/organization';
import { hoursToMinutes, minutesToHours } from '@/utils/minutes';

import { useOrganizationForm } from '../../hooks/useOrganizationForm';
import { timeSettingsSchema, type TimeSettingsValues } from '../../schemas/general';
import { INCREMENT_OPTIONS } from '../../utils/general';
import { SettingsCard } from './SettingsCard';
import type { GeneralCardProps } from './types';
import { WorkingDaysField } from './WorkingDaysField';

const FIELDS = [
  'time_increment_minutes',
  'hours_per_day',
  'week_start',
  'working_days',
  'require_timesheet_approval',
] as const;
/** API field → form field, for 422 details. */
const FIELD_NAMES = { minutes_per_day: 'hours_per_day' };
const WEEK_START_OPTIONS = WEEKDAYS.map((day) => ({ value: String(day.value), label: day.label }));

const sortedDays = (days: number[]) => [...days].sort((a, b) => a - b);

function toValues(organization: Organization): TimeSettingsValues {
  return {
    time_increment_minutes: String(organization.time_increment_minutes),
    hours_per_day: minutesToHours(organization.minutes_per_day),
    week_start: String(organization.week_start) as TimeSettingsValues['week_start'],
    working_days: sortedDays(organization.working_days),
    require_timesheet_approval: organization.require_timesheet_approval,
  };
}

function toUpdate(values: TimeSettingsValues, organization: Organization): OrganizationUpdate {
  const body: OrganizationUpdate = {};
  const increment = Number(values.time_increment_minutes) as TimeIncrement;
  if (increment !== organization.time_increment_minutes) body.time_increment_minutes = increment;
  const minutes = hoursToMinutes(values.hours_per_day);
  if (minutes !== null && minutes !== organization.minutes_per_day) body.minutes_per_day = minutes;
  const weekStart = Number(values.week_start);
  if (weekStart !== organization.week_start) body.week_start = weekStart;
  if (sortedDays(values.working_days).join() !== sortedDays(organization.working_days).join()) {
    body.working_days = values.working_days;
  }
  if (values.require_timesheet_approval !== organization.require_timesheet_approval) {
    body.require_timesheet_approval = values.require_timesheet_approval;
  }
  return body;
}

/** `time_increment_minutes`, the working day and week, and the timesheet approval switch. */
export function TimeSettingsCard({ organization, editable }: GeneralCardProps) {
  const { form, ...card } = useOrganizationForm<TimeSettingsValues>({
    organization,
    schema: timeSettingsSchema,
    toValues,
    toUpdate,
    fields: FIELDS,
    fieldNames: FIELD_NAMES,
    savedTitle: 'Time settings saved',
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const approval = useWatch({ control, name: 'require_timesheet_approval' });

  return (
    <SettingsCard
      title="Time recording"
      description="How logged time is rounded, how long a working day is and whether timesheets need approval."
      saveLabel="Save time settings"
      editable={editable}
      dirty={card.isDirty}
      saving={card.saving}
      retryIn={card.retryIn}
      submitError={card.submitError}
      onSubmit={card.onSubmit}
      onDiscard={card.discard}
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <Select
          label="Time increment"
          options={INCREMENT_OPTIONS}
          hint="Logged minutes are rounded up to this increment."
          error={errors.time_increment_minutes?.message}
          {...register('time_increment_minutes')}
        />
        <Input
          label="Daily target (hours)"
          required
          inputMode="decimal"
          autoComplete="off"
          hint="Hours in a working day, for example 7.5. Used for capacity and utilisation."
          error={errors.hours_per_day?.message}
          {...register('hours_per_day')}
        />
        <Select
          label="Week starts on"
          options={WEEK_START_OPTIONS}
          hint="The first day of every timesheet week."
          error={errors.week_start?.message}
          {...register('week_start')}
        />
      </div>
      <Controller
        control={control}
        name="working_days"
        render={({ field }) => (
          <WorkingDaysField
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.working_days?.message}
            disabled={!editable}
          />
        )}
      />
      <Controller
        control={control}
        name="require_timesheet_approval"
        render={({ field }) => (
          <Switch
            ref={field.ref}
            checked={field.value}
            onChange={field.onChange}
            disabled={!editable}
            label="Timesheet approval"
            description={
              approval
                ? 'On: only time on approved timesheets can be billed.'
                : 'Off: time can be billed without an approved timesheet.'
            }
            className="rounded-md border border-border px-3 py-2"
          />
        )}
      />
    </SettingsCard>
  );
}
