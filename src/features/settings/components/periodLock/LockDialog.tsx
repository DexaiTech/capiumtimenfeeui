import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import {
  Button,
  Modal,
  SegmentedControl,
  Select,
  Textarea,
  useToast,
  type SelectOption,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { todayInZone } from '@/utils/dates';

import { useLockPeriod } from '../../api/adminHooks';
import type { LockablePeriodType, LockedPeriod } from '../../adminTypes';
import { lockSchema, REASON_MAX, type LockValues } from '../../schemas/admin';
import { lastEndedMonth, lockBlocker, MONTHS, periodName } from '../../utils/periodLock';
import { DialogActions } from '../DialogActions';

const FIELDS = ['period_type', 'year', 'period', 'reason'] as const;

const TYPES: ReadonlyArray<{ value: LockablePeriodType; label: string }> = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

const YEARS_SHOWN = 10;

function LockForm({
  periods,
  onClose,
}: {
  periods: ReadonlyArray<LockedPeriod>;
  onClose: () => void;
}) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const lock = useLockPeriod();
  const formId = useId();
  const today = todayInZone(organization.timezone);
  const recent = lastEndedMonth(today);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<LockValues>({
    resolver: zodResolver(lockSchema(periods, today)),
    defaultValues: {
      // The usual choice: close the month that has just ended.
      period_type: 'month',
      year: String(recent.year),
      period: String(recent.month),
      reason: '',
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } = useSubmitError<LockValues>({
    setError,
    fields: FIELDS,
  });
  const type = useWatch({ control, name: 'period_type' });
  const year = Number(useWatch({ control, name: 'year' }));

  const currentYear = Number(today.slice(0, 4));
  const yearOptions: SelectOption[] = Array.from({ length: YEARS_SHOWN }, (_, n) => {
    const value = currentYear - n;
    const blocker = type === 'year' ? lockBlocker(periods, 'year', value, 1, today) : null;
    return {
      value: String(value),
      label: blocker ? `${String(value)} (${blocker})` : String(value),
    };
  });
  const count = type === 'quarter' ? 4 : 12;
  const periodOptions: SelectOption[] = Array.from({ length: count }, (_, n) => {
    const index = n + 1;
    const blocker = type === 'year' ? null : lockBlocker(periods, type, year, index, today);
    const name = type === 'quarter' ? `Q${String(index)}` : (MONTHS[n] ?? '');
    return {
      value: String(index),
      label: blocker ? `${name} (${blocker})` : name,
      disabled: blocker !== null,
    };
  });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const index = values.period_type === 'year' ? 1 : Number(values.period);
    lock.mutate(
      {
        period_type: values.period_type,
        year: Number(values.year),
        ...(values.period_type === 'year' ? {} : { period: index }),
        reason: values.reason || null,
      },
      {
        onSuccess: () => {
          toast({
            tone: 'success',
            title: `${periodName(values.period_type, Number(values.year), index)} locked`,
          });
          onClose();
        },
        onError: handleSubmitError,
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
        <SegmentedControl
          label="Lock a"
          options={TYPES}
          value={type}
          onChange={(value) => setValue('period_type', value, { shouldValidate: false })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Year"
            required
            options={yearOptions}
            error={errors.year?.message}
            {...register('year')}
          />
          {type === 'year' ? null : (
            <Select
              label={type === 'quarter' ? 'Quarter' : 'Month'}
              required
              options={periodOptions}
              error={errors.period?.message}
              {...register('period')}
            />
          )}
        </div>
        <Textarea
          label="Reason (optional)"
          rows={3}
          maxLength={REASON_MAX}
          hint="Kept in the history, for example “March VAT return filed”."
          error={errors.reason?.message}
          {...register('reason')}
        />
        <p className="text-sm text-text-muted">
          Only a month, quarter or calendar year that has ended can be locked. The lock applies to
          everybody, the Owner included, until the period is unlocked with a reason.
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
          loading={lock.isPending}
          disabled={retryIn > 0}
        >
          Lock period
        </Button>
      </DialogActions>
    </>
  );
}

export interface LockDialogProps {
  open: boolean;
  onClose: () => void;
  /** What is locked now: those periods cannot be chosen again. */
  periods: ReadonlyArray<LockedPeriod>;
}

/** Lock a month, quarter or year. Each period is locked, and unlocked, on its own. */
export function LockDialog({ open, onClose, periods }: LockDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lock a period"
      description="Time, expenses and WIP dated inside the period can no longer be created, changed or deleted."
      size="md"
      closeOnBackdrop={false}
    >
      {open ? <LockForm periods={periods} onClose={onClose} /> : null}
    </Modal>
  );
}
