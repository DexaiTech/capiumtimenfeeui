import { zodResolver } from '@hookform/resolvers/zod';
import { Settings2 } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Card, Input, Modal, SegmentedControl, Select, useToast } from '@/components/ui';

import { useUpdateLockSettings } from '../../api/adminHooks';
import type { PeriodLockSettings } from '../../adminTypes';
import { lockSettingsSchema, type LockSettingsValues } from '../../schemas/admin';
import {
  GRANULARITY_HELP,
  GRANULARITY_OPTIONS,
  MONTH_OPTIONS,
  yearStartLabel,
} from '../../utils/periodLock';
import { DialogActions } from '../DialogActions';

const FIELDS = ['granularity', 'financial_year_start_month', 'financial_year_start_day'] as const;

interface LockSettingsFormProps {
  settings: PeriodLockSettings;
  /** The first-time set-up, which has no one to cancel back to. */
  onCancel?: () => void;
  onSaved: () => void;
  saveLabel: string;
}

/** How the practice locks (weekly, monthly, quarterly or annually) and when its year starts. */
function LockSettingsForm({ settings, onCancel, onSaved, saveLabel }: LockSettingsFormProps) {
  const { toast } = useToast();
  const save = useUpdateLockSettings();
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<LockSettingsValues>({
    resolver: zodResolver(lockSettingsSchema),
    defaultValues: {
      granularity: settings.granularity,
      financial_year_start_month: String(settings.financial_year_start_month),
      financial_year_start_day: String(settings.financial_year_start_day),
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<LockSettingsValues>({ setError, fields: FIELDS });
  const granularity = useWatch({ control, name: 'granularity' });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    save.mutate(
      {
        granularity: values.granularity,
        financial_year_start_month: Number(values.financial_year_start_month),
        financial_year_start_day: Number(values.financial_year_start_day),
      },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: 'Period lock settings saved' });
          onSaved();
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
        <div className="flex flex-col gap-1.5">
          <SegmentedControl
            label="Lock periods"
            options={GRANULARITY_OPTIONS}
            value={granularity}
            onChange={(value) => setValue('granularity', value, { shouldValidate: false })}
          />
          <p className="text-sm text-text-muted">{GRANULARITY_HELP[granularity]}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Accounting year starts in"
            options={MONTH_OPTIONS}
            error={errors.financial_year_start_month?.message}
            {...register('financial_year_start_month')}
          />
          <Input
            label="On day"
            type="number"
            min={1}
            max={28}
            inputMode="numeric"
            error={errors.financial_year_start_day?.message}
            {...register('financial_year_start_day')}
          />
        </div>
        <p className="text-sm text-text-muted">
          Periods are counted from the start of the accounting year, so a lock always matches one
          whole period of it. Locks you have already made stay as they are.
        </p>
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
      </form>
      <DialogActions>
        {onCancel ? <Button onClick={onCancel}>Cancel</Button> : null}
        <Button
          type="submit"
          form={formId}
          variant="primary"
          loading={save.isPending}
          disabled={retryIn > 0}
        >
          {saveLabel}
        </Button>
      </DialogActions>
    </>
  );
}

export interface LockSettingsCardProps {
  settings: PeriodLockSettings;
  /** `period_lock.manage`: may choose how periods are locked. */
  canManage: boolean;
}

/**
 * The first-time set-up while the practice has not chosen, then a summary with a way to change
 * it. Weekly is what the practice has until it chooses.
 */
export function LockSettingsCard({ settings, canManage }: LockSettingsCardProps) {
  const [changing, setChanging] = useState(false);

  if (!settings.configured) {
    return (
      <Card
        padding="lg"
        role="region"
        aria-label="Set up period locking"
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-text">Set up period locking</h2>
          <p className="text-sm text-text-muted">
            Choose how often you close your books. You can lock one period of that length at a time,
            inside your accounting year. Weekly is suggested.
          </p>
        </div>
        {canManage ? (
          <LockSettingsForm
            settings={settings}
            onSaved={() => undefined}
            saveLabel="Save and start"
          />
        ) : (
          <p className="text-sm text-text-muted">
            Locking weekly until someone with permission to manage locks chooses.
          </p>
        )}
      </Card>
    );
  }

  const length = GRANULARITY_OPTIONS.find((entry) => entry.value === settings.granularity);
  return (
    <>
      <Card
        padding="lg"
        role="region"
        aria-label="How periods are locked"
        className="flex flex-wrap items-center gap-3"
      >
        <Settings2 aria-hidden="true" className="size-5 shrink-0 text-text-muted" />
        <p className="min-w-0 flex-1 text-sm text-text">
          <strong className="font-medium">{length?.label}</strong> locks · accounting year starts{' '}
          {yearStartLabel(settings)}
        </p>
        <Button size="sm" disabled={!canManage} onClick={() => setChanging(true)}>
          Change
        </Button>
      </Card>
      <Modal
        open={changing}
        onClose={() => setChanging(false)}
        title="How periods are locked"
        description="Locks that already exist stay in force and can still be unlocked."
        size="md"
        closeOnBackdrop={false}
      >
        {changing ? (
          <LockSettingsForm
            settings={settings}
            onCancel={() => setChanging(false)}
            onSaved={() => setChanging(false)}
            saveLabel="Save"
          />
        ) : null}
      </Modal>
    </>
  );
}
