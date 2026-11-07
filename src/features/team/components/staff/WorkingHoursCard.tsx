import { zodResolver } from '@hookform/resolvers/zod';
import { Clock, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import {
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  FormPanel,
  Input,
  Skeleton,
  useToast,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { todayInZone } from '@/utils/dates';
import { formatMinutes, parseMinutes } from '@/utils/minutes';

import { useAddStaffHours, useDeleteStaffHours, useStaffHours } from '../../api';
import { staffHoursSchema, type StaffHoursValues } from '../../schemas/overtime';
import type { HoursBasis, RuleStatus, StaffDetail, StaffHours } from '../../types';
import { dialogError, toFormError } from '../../utils/errors';
import { formatPeriod } from '../../utils/format';
import { RuleStatusBadge } from '../badges';
import { DialogActions } from '../DialogActions';
import { RadioGroupField } from '../RadioGroupField';

const FIELDS = ['basis', 'standard_hours', 'effective_from'] as const;

const BASIS_LABEL: Record<HoursBasis, string> = { weekly: 'Weekly', monthly: 'Monthly' };
const PER: Record<HoursBasis, string> = { weekly: 'per week', monthly: 'per month' };

const BASIS_OPTIONS: ReadonlyArray<{ value: HoursBasis; label: string; description: string }> = [
  { value: 'weekly', label: 'Weekly', description: 'Overtime is counted week by week.' },
  { value: 'monthly', label: 'Monthly', description: 'Overtime is counted month by month.' },
];

/** Current, future or ended on `today`, as the rate lists show it. */
function statusOn(period: StaffHours, today: string): RuleStatus {
  if (period.effective_from > today) return 'future';
  if (period.effective_to !== null && period.effective_to < today) return 'ended';
  return 'current';
}

/** "37:30 per week". */
const formatHours = (period: StaffHours) =>
  `${formatMinutes(period.standard_minutes)} ${PER[period.basis]}`;

function ChangeHoursForm({
  staff,
  basis,
  onClose,
}: {
  staff: StaffDetail;
  basis: HoursBasis;
  onClose: () => void;
}) {
  const { organization } = useOrg();
  const add = useAddStaffHours(staff.id);
  const { toast } = useToast();
  const formId = useId();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<StaffHoursValues>({
    resolver: zodResolver(staffHoursSchema),
    defaultValues: {
      basis,
      standard_hours: '',
      effective_from: todayInZone(organization.timezone),
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<StaffHoursValues>({ setError, fields: FIELDS });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const minutes = parseMinutes(values.standard_hours);
    if (minutes === null) return;
    add.mutate(
      { basis: values.basis, standard_minutes: minutes, effective_from: values.effective_from },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: `${staff.full_name}: working hours saved` });
          onClose();
        },
        onError: (error) =>
          handleSubmitError(toFormError(error, { standard_minutes: 'standard_hours' })),
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
        <Controller
          control={control}
          name="basis"
          render={({ field }) => (
            <RadioGroupField
              legend="Hours basis"
              required
              value={field.value}
              onChange={field.onChange}
              options={BASIS_OPTIONS}
            />
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Standard hours"
            required
            inputMode="decimal"
            autoComplete="off"
            placeholder="37:30"
            hint="Per week or month, for example 37:30 or 37.5."
            error={errors.standard_hours?.message}
            {...register('standard_hours')}
          />
          <Input
            label="Effective from"
            required
            type="date"
            error={errors.effective_from?.message}
            {...register('effective_from')}
          />
        </div>
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
          loading={add.isPending}
          disabled={retryIn > 0}
        >
          Save working hours
        </Button>
      </DialogActions>
    </>
  );
}

/**
 * A person's standard hours per week or month, dated: hours recorded beyond them in a period are
 * overtime (APT81). Read with `member.read` (the page's own rule); `canEdit` (with `member.update`)
 * offers the change.
 */
export function WorkingHoursCard({ staff, canEdit }: { staff: StaffDetail; canEdit: boolean }) {
  const { organization } = useOrg();
  const hours = useStaffHours(staff.id);
  const remove = useDeleteStaffHours(staff.id);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<StaffHours | null>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const today = todayInZone(organization.timezone);
  const rows = hours.data ?? [];
  const current = rows.find((period) => statusOn(period, today) === 'current');

  const closeDelete = () => {
    setDeleting(null);
    setRefusal(null);
  };
  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: `${staff.full_name}: working hours deleted` });
        closeDelete();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  return (
    <>
      <ConfirmDialog
        open={deleting !== null}
        onClose={closeDelete}
        onConfirm={confirmDelete}
        title="Delete working hours?"
        confirmLabel="Delete hours"
        loading={remove.isPending}
        error={refusal}
      >
        {deleting ? (
          <p>
            {staff.full_name}&apos;s{' '}
            <strong className="font-medium text-text">{formatHours(deleting)}</strong> (
            {formatPeriod(deleting.effective_from, deleting.effective_to)}) will be removed. The
            other periods stay as they are, and time already recorded keeps its overtime. This
            cannot be undone.
          </p>
        ) : null}
      </ConfirmDialog>
      <FormPanel
        open={open}
        onClose={() => setOpen(false)}
        title="Change working hours"
        description={`${staff.full_name}: the new hours apply from the date you choose, and the hours in force end the day before.`}
      >
        {open ? (
          <ChangeHoursForm
            staff={staff}
            basis={current?.basis ?? 'weekly'}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </FormPanel>
      <Card padding="none" role="region" aria-label="Working hours">
        <CardHeader
          title="Working hours"
          description="Standard hours per week or month. Hours recorded beyond them in a period are overtime."
          actions={
            canEdit ? (
              <Button
                size="sm"
                leftIcon={<Clock aria-hidden="true" className="size-4" />}
                onClick={() => setOpen(true)}
              >
                Change working hours
              </Button>
            ) : undefined
          }
        />
        <div className="flex flex-col gap-5 p-5">
          {hours.isPending ? (
            <div
              role="status"
              aria-label="Loading the working hours"
              className="flex flex-col gap-2"
            >
              <Skeleton shape="rect" className="h-8 w-full" />
              <Skeleton shape="rect" className="h-8 w-full" />
            </div>
          ) : hours.isError ? (
            <p className="text-sm text-danger">Could not load this person&apos;s working hours.</p>
          ) : (
            <>
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-sunken p-4">
                <span className="text-xs font-medium text-text-muted">Standard hours today</span>
                <span className="text-xl font-semibold text-text tabular-nums">
                  {current ? formatHours(current) : '—'}
                </span>
                <span className="text-xs text-text-muted">
                  {current
                    ? `${BASIS_LABEL[current.basis]} basis, ${formatPeriod(current.effective_from, current.effective_to)}`
                    : 'No standard hours are in force today.'}
                </span>
              </div>
              {rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[30rem] text-left text-sm">
                    <caption className="sr-only">Working hours of this person, by period</caption>
                    <thead>
                      <tr className="border-b border-row-border text-xs text-text-muted">
                        <th scope="col" className="py-2 pr-4 font-medium">
                          Basis
                        </th>
                        <th scope="col" className="py-2 pr-4 text-right font-medium">
                          Standard hours
                        </th>
                        <th scope="col" className="py-2 pr-4 font-medium">
                          Period
                        </th>
                        <th scope="col" className="py-2 font-medium">
                          Status
                        </th>
                        {canEdit ? (
                          <th scope="col" className="py-2 text-right font-medium">
                            <span className="sr-only">Actions</span>
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((period) => (
                        <tr key={period.id} className="border-b border-row-border last:border-b-0">
                          <td className="py-2 pr-4 text-text">{BASIS_LABEL[period.basis]}</td>
                          <td className="py-2 pr-4 text-right text-text tabular-nums">
                            {formatHours(period)}
                          </td>
                          <td className="py-2 pr-4 whitespace-nowrap text-text-muted">
                            {formatPeriod(period.effective_from, period.effective_to)}
                          </td>
                          <td className="py-2">
                            <RuleStatusBadge status={statusOn(period, today)} />
                          </td>
                          {canEdit ? (
                            <td className="py-2 text-right">
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                title="Delete"
                                aria-label={`Delete working hours from ${formatPeriod(period.effective_from, period.effective_to)}`}
                                onClick={() => setDeleting(period)}
                              >
                                <Trash2 aria-hidden="true" className="size-4" />
                              </Button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          )}
        </div>
      </Card>
    </>
  );
}
