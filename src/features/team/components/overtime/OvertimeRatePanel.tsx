import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, FormPanel, Input, Select, useToast } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { todayInZone } from '@/utils/dates';
import { parsePounds } from '@/utils/money';
import { parseMultiplierToBp } from '@/utils/multiplier';

import { useCreateOvertimeRate, useGradeOptions } from '../../api';
import { overtimeRateSchema, type OvertimeRateValues } from '../../schemas/overtime';
import type { OvertimeLevel, OvertimeMode, OvertimeRateCreate } from '../../types';
import { conflictsOf, toFormError } from '../../utils/errors';
import { formatPeriod } from '../../utils/format';
import { DialogActions } from '../DialogActions';
import { StaffPicker } from '../pickers/StaffPicker';
import { RadioGroupField } from '../RadioGroupField';

const FIELDS = [
  'level',
  'grade_id',
  'user_id',
  'mode',
  'multiplier',
  'rate',
  'effective_from',
  'effective_to',
] as const;

const LEVEL_OPTIONS: ReadonlyArray<{ value: OvertimeLevel; label: string; help: string }> = [
  { value: 'grade', label: 'Grade', help: 'Everyone of a grade who has no rate of their own.' },
  {
    value: 'staff',
    label: 'Staff member',
    help: "One person. It replaces their grade's overtime rate; the two are never added together.",
  },
];

const MODE_OPTIONS: ReadonlyArray<{ value: OvertimeMode; label: string; description: string }> = [
  {
    value: 'multiplier',
    label: '× the cost rate',
    description: "A multiple of the person's cost rate on the day, for example 1.5.",
  },
  {
    value: 'fixed',
    label: 'Fixed £ per hour',
    description: 'The same amount for every hour of overtime, whatever the cost rate.',
  },
];

function AddOvertimeRateForm({ onClose }: { onClose: () => void }) {
  const { organization, can } = useOrg();
  const create = useCreateOvertimeRate();
  const { toast } = useToast();
  const formId = useId();
  const [failure, setFailure] = useState<unknown>(null);
  // Grades and staff are chosen from lists that need `member.read`.
  const canPick = can(PERMISSIONS.memberRead);
  const grades = useGradeOptions({ enabled: canPick });

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<OvertimeRateValues>({
    resolver: zodResolver(overtimeRateSchema),
    defaultValues: {
      level: 'grade',
      grade_id: '',
      user_id: null,
      mode: 'multiplier',
      multiplier: '',
      rate: '',
      effective_from: todayInZone(organization.timezone),
      effective_to: '',
    },
  });
  const level = useWatch({ control, name: 'level' });
  const mode = useWatch({ control, name: 'mode' });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<OvertimeRateValues>({ setError, fields: FIELDS });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    setFailure(null);
    const body: OvertimeRateCreate = {
      level: values.level,
      mode: values.mode,
      effective_from: values.effective_from,
    };
    if (values.level === 'grade') body.grade_id = values.grade_id;
    if (values.level === 'staff' && values.user_id) body.user_id = values.user_id;
    if (values.mode === 'multiplier') {
      body.multiplier_bp = parseMultiplierToBp(values.multiplier) ?? undefined;
    } else {
      body.rate = parsePounds(values.rate) ?? undefined;
    }
    if (values.effective_to) body.effective_to = values.effective_to;
    create.mutate(body, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Overtime rate added' });
        onClose();
      },
      onError: (error) => {
        setFailure(error);
        handleSubmitError(toFormError(error, { multiplier_bp: 'multiplier' }));
      },
    });
  });

  const gradeOptions = (grades.data ?? [])
    .filter((grade) => grade.is_active)
    .map((grade) => ({ value: grade.id, label: grade.name }));
  const conflicts = conflictsOf(failure);

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <p className="rounded-md border border-border bg-surface-sunken px-3 py-2.5 text-sm text-text-muted">
          Overtime rates are an internal cost only: they never change what clients are charged. One
          rate applies to a person: their own rate if they have one, otherwise their grade&apos;s.
        </p>
        {!canPick ? (
          <p className="rounded-md border border-border bg-surface-sunken px-3 py-2.5 text-sm text-text-muted">
            You need permission to view staff and grades to choose who a rate applies to.
          </p>
        ) : null}
        <Select
          label="Applies to"
          required
          options={LEVEL_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          hint={LEVEL_OPTIONS.find((option) => option.value === level)?.help}
          error={errors.level?.message}
          {...register('level')}
        />
        {level === 'grade' ? (
          <Select
            label="Grade"
            required
            placeholder="Choose a grade"
            options={gradeOptions}
            error={errors.grade_id?.message}
            {...register('grade_id')}
          />
        ) : (
          <Controller
            control={control}
            name="user_id"
            render={({ field }) => (
              <StaffPicker
                label="Staff member"
                required
                value={field.value}
                onChange={(id) => field.onChange(id)}
                error={errors.user_id?.message}
              />
            )}
          />
        )}
        <Controller
          control={control}
          name="mode"
          render={({ field }) => (
            <RadioGroupField
              legend="Overtime rate"
              required
              value={field.value}
              onChange={field.onChange}
              options={MODE_OPTIONS}
            />
          )}
        />
        {mode === 'multiplier' ? (
          <Input
            label="Multiplier (× the cost rate)"
            required
            inputMode="decimal"
            autoComplete="off"
            placeholder="1.5"
            error={errors.multiplier?.message}
            {...register('multiplier')}
          />
        ) : (
          <Input
            label="Rate per hour (£)"
            required
            inputMode="decimal"
            autoComplete="off"
            placeholder="45.00"
            error={errors.rate?.message}
            {...register('rate')}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Effective from"
            required
            type="date"
            error={errors.effective_from?.message}
            {...register('effective_from')}
          />
          <Input
            label="Effective to"
            type="date"
            hint="Leave empty for open-ended."
            error={errors.effective_to?.message}
            {...register('effective_to')}
          />
        </div>
        {submitError ? (
          <div className="flex flex-col gap-2">
            <FormAlert message={submitError.message} requestId={submitError.requestId} />
            {conflicts.length > 0 ? (
              <ul aria-label="Rates in the way" className="list-disc pl-5 text-sm text-text">
                {conflicts.map((conflict) => (
                  <li key={conflict.id}>
                    {formatPeriod(conflict.effective_from, conflict.effective_to)}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          loading={create.isPending}
          disabled={retryIn > 0 || !canPick}
        >
          Add overtime rate
        </Button>
      </DialogActions>
    </>
  );
}

export interface OvertimeRatePanelProps {
  open: boolean;
  onClose: () => void;
}

/** Add an overtime rate: who it applies to, a multiplier of the cost rate or a fixed rate, the period. */
export function OvertimeRatePanel({ open, onClose }: OvertimeRatePanelProps) {
  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title="Add overtime rate"
      description="What an hour of overtime costs the practice, for a grade or one staff member."
    >
      {open ? <AddOvertimeRateForm onClose={onClose} /> : null}
    </FormPanel>
  );
}
