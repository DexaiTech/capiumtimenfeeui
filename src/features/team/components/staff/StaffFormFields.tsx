import { Controller, type UseFormReturn } from 'react-hook-form';

import { Input, Select } from '@/components/ui';

import { STAFF_STATUS_LABEL } from '../../constants';
import type { Grade, RefRead } from '../../types';
import type { StaffFormValues } from '../../schemas/staff';
import { StaffPicker } from '../pickers/StaffPicker';
import { WorkingDaysField } from '../WorkingDaysField';

export interface StaffFormFieldsProps {
  mode: 'add' | 'edit';
  form: UseFormReturn<StaffFormValues>;
  grades: ReadonlyArray<Grade>;
  /** The grade the person holds now: offered even when it has been deactivated. */
  currentGrade?: RefRead | null;
  /** The person being edited, who cannot approve their own timesheets. */
  staffId?: string;
  /** The name of the current approver, so the picker shows it at once. */
  approverName?: string;
}

const STATUS_OPTIONS = (['active', 'inactive', 'left'] as const).map((status) => ({
  value: status,
  label: STAFF_STATUS_LABEL[status],
}));

/** The profile fields of the add and the edit dialog. */
export function StaffFormFields({
  mode,
  form,
  grades,
  currentGrade,
  staffId,
  approverName,
}: StaffFormFieldsProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  const gradeOptions = grades
    .filter((grade) => grade.is_active || grade.id === currentGrade?.id)
    .map((grade) => ({
      value: grade.id,
      label: grade.is_active ? grade.name : `${grade.name} (inactive)`,
    }));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Full name"
          autoComplete="off"
          error={errors.full_name?.message}
          {...register('full_name')}
        />
        <Input
          label="Staff code"
          autoComplete="off"
          placeholder={mode === 'add' ? 'Next number' : undefined}
          hint={mode === 'add' ? 'Leave empty to use the next number.' : undefined}
          error={errors.code?.message}
          {...register('code')}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Grade"
          placeholder="Choose a grade"
          options={gradeOptions}
          error={errors.grade_id?.message}
          {...register('grade_id')}
        />
        <Input
          label="Start date"
          type="date"
          error={errors.start_date?.message}
          {...register('start_date')}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Work email"
          type="email"
          autoComplete="off"
          spellCheck={false}
          error={errors.email?.message}
          {...register('email')}
        />
        <Controller
          control={control}
          name="approver_id"
          render={({ field }) => (
            <StaffPicker
              label="Approver"
              value={field.value}
              valueLabel={approverName}
              onChange={(id) => field.onChange(id)}
              hasLogin
              selectable
              excludeId={staffId}
              placeholder="No approver"
              hint="Only people who can sign in can approve timesheets."
              error={errors.approver_id?.message}
            />
          )}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Job title"
          autoComplete="off"
          placeholder="For example Senior accountant"
          error={errors.job_title?.message}
          {...register('job_title')}
        />
        <Input
          label="Initials"
          autoComplete="off"
          placeholder="Auto"
          maxLength={6}
          error={errors.initials?.message}
          {...register('initials')}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Hours per working day"
          inputMode="decimal"
          autoComplete="off"
          hint="For example 7.5 or 7:30."
          error={errors.hours_per_day?.message}
          {...register('hours_per_day')}
        />
        <Input
          label="Chargeable target (%)"
          inputMode="decimal"
          autoComplete="off"
          placeholder={mode === 'add' ? 'Grade default' : undefined}
          hint="Share of working time expected to be chargeable."
          error={errors.target_percent?.message}
          {...register('target_percent')}
        />
      </div>
      <Controller
        control={control}
        name="working_days"
        render={({ field }) => (
          <WorkingDaysField
            value={field.value}
            onChange={field.onChange}
            error={errors.working_days?.message}
          />
        )}
      />
      {mode === 'edit' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            hint="Inactive people can come back; people who left keep their history."
            error={errors.status?.message}
            {...register('status')}
          />
          <Input
            label="Leaving date"
            type="date"
            error={errors.leaving_date?.message}
            {...register('leaving_date')}
          />
        </div>
      ) : null}
    </>
  );
}
