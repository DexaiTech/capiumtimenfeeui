import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { FormAlert, useSubmitError } from '@/components/forms';
import {
  AddAnotherButton,
  Button,
  ErrorState,
  Input,
  FormPanel,
  Select,
  Skeleton,
  useAddAnother,
  useToast,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { roleOptions, useRoles, type Role } from '@/features/settings';
import { useRoleName } from '@/features/system';
import { isApiError } from '@/services/api';
import { parseMinutes, minutesToHours } from '@/utils/minutes';
import { parsePounds } from '@/utils/money';

import { useCreateStaff, useGradeOptions, useInviteStaff } from '../../api';
import { staffCreateSchema, type StaffFormValues } from '../../schemas/staff';
import type { Grade, StaffCreate, StaffDetail } from '../../types';
import { describeFailure, toFormError } from '../../utils/errors';
import { StaffFormFields } from './StaffFormFields';
import { DialogActions } from '../DialogActions';
import { todayInZone } from '@/utils/dates';

const FIELDS = [
  'full_name',
  'code',
  'email',
  'grade_id',
  'job_title',
  'hours_per_day',
  'working_days',
  'start_date',
  'leaving_date',
  'role_id',
  'cost_rate',
  'charge_rate',
  'rate_effective_from',
] as const;
/** API field → form field. */
const FIELD_NAMES = {
  working_minutes_per_day: 'hours_per_day',
};

export interface AddStaffPanelProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function AddStaffForm({
  grades,
  roles,
  onClose,
  onCreated,
}: {
  grades: ReadonlyArray<Grade>;
  roles: ReadonlyArray<Role>;
  onClose: () => void;
  onCreated: AddStaffPanelProps['onCreated'];
}) {
  const { organization, role: myRole, can } = useOrg();
  const roleName = useRoleName();
  const { toast } = useToast();
  const navigate = useNavigate();
  const formId = useId();
  const again = useAddAnother();
  const create = useCreateStaff();
  const invite = useInviteStaff();
  const options = roleOptions(roles, { role: myRole, can }, roleName);

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffCreateSchema),
    defaultValues: {
      full_name: '',
      code: '',
      email: '',
      grade_id: '',
      approver_id: null,
      job_title: '',
      initials: '',
      hours_per_day: minutesToHours(organization.minutes_per_day),
      working_days: organization.working_days,
      target_percent: '',
      overtime_multiplier: '',
      start_date: todayInZone(organization.timezone),
      leaving_date: '',
      status: 'active',
      role_id: roles.find((role) => role.system_key === 'staff')?.id ?? '',
      cost_rate: '',
      charge_rate: '',
      // Empty: the rates start on the person's start date (the API's default), so the time they
      // log from their first day is costed and charged at them, not only time from today.
      rate_effective_from: '',
    },
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<StaffFormValues>({ setError, fields: FIELDS });

  /** Closes the panel, or, for "add another", empties the person's own fields and stays. */
  const finish = () => {
    if (again.consume()) {
      form.reset({
        ...form.getValues(),
        full_name: '',
        code: '',
        email: '',
      });
      // reset() unregisters the fields until the next render, so focus after it.
      setTimeout(() => form.setFocus('full_name'), 0);
      return;
    }
    onCreated();
  };

  const onSubmit = handleSubmit(async (values) => {
    clearSubmitError();
    const body: StaffCreate = {
      full_name: values.full_name,
      grade_id: values.grade_id,
      email: values.email,
      working_minutes_per_day: parseMinutes(values.hours_per_day) ?? 0,
      working_days: values.working_days,
    };
    if (values.start_date) body.start_date = values.start_date;
    if (values.code) body.code = values.code.toUpperCase();
    if (values.job_title) body.job_title = values.job_title;
    if (values.role_id) body.role_id = values.role_id;
    // The person's own rates, set in the same request (the API checks `rate.manage`).
    const costRate = values.cost_rate.trim() ? parsePounds(values.cost_rate) : null;
    const chargeRate = values.charge_rate.trim() ? parsePounds(values.charge_rate) : null;
    if (costRate !== null) body.cost_rate = costRate;
    if (chargeRate !== null) body.charge_rate = chargeRate;
    if ((costRate !== null || chargeRate !== null) && values.rate_effective_from) {
      body.rate_effective_from = values.rate_effective_from;
    }

    let created: StaffDetail;
    try {
      created = await create.mutateAsync(body);
    } catch (error) {
      handleSubmitError(toFormError(error, FIELD_NAMES));
      return;
    }
    toast({
      tone: 'success',
      title: `${created.full_name} added`,
      action: {
        label: 'Open profile',
        onClick: () => void navigate(routes.org.staffMember(organization.slug, created.id)),
      },
    });
    // Everyone added signs in to record time: invite them to their work email (ticket APT5).
    // The record exists now; a failed invitation is reported without undoing it.
    try {
      await invite.mutateAsync({ staffId: created.id, body: {} });
      toast({ tone: 'success', title: `Invitation sent to ${values.email}` });
    } catch (error) {
      toast({
        tone: 'error',
        ...describeFailure(error, 'Staff member added, but the invitation could not be sent'),
      });
    }
    finish();
  });

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <StaffFormFields mode="add" form={form} grades={grades} />
        {can('rate.manage') ? (
          <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-semibold text-text">Rates</legend>
            <p className="text-xs text-text-muted">
              Optional. Set what this person costs the practice and what you charge for them, in
              pounds per hour. They are saved with the person; change them later on their page.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Cost rate (£/h)"
                inputMode="decimal"
                autoComplete="off"
                placeholder="Grade default"
                error={errors.cost_rate?.message}
                {...register('cost_rate')}
              />
              <Input
                label="Charge-out rate (£/h)"
                inputMode="decimal"
                autoComplete="off"
                placeholder="Grade default"
                error={errors.charge_rate?.message}
                {...register('charge_rate')}
              />
              <Input
                label="Rates start"
                type="date"
                hint="Empty: the start date."
                error={errors.rate_effective_from?.message}
                {...register('rate_effective_from')}
              />
            </div>
          </fieldset>
        ) : null}
        {options.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Role"
              options={options}
              hint={
                options.some((option) => option.disabled)
                  ? 'You can only give roles whose permissions you hold yourself.'
                  : undefined
              }
              error={errors.role_id?.message}
              {...register('role_id')}
            />
          </div>
        ) : null}
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <AddAnotherButton
          formId={formId}
          flagRef={again.flagRef}
          loading={isSubmitting}
          disabled={retryIn > 0}
        />
        <Button
          type="submit"
          form={formId}
          {...again.primaryProps}
          variant="primary"
          loading={isSubmitting}
          disabled={retryIn > 0}
        >
          Add staff member
        </Button>
      </DialogActions>
    </>
  );
}

/**
 * "Add staff member": the record, then an invitation to sign in sent to their work email, since
 * everyone added records their own time (ticket APT5).
 */
export function AddStaffPanel({ open, onClose, onCreated }: AddStaffPanelProps) {
  const { can } = useOrg();
  const grades = useGradeOptions({ enabled: open });
  // The role choice needs `role.read`; without it the API gives the Staff role.
  const roles = useRoles({ enabled: open && can('role.read') });
  const loading = grades.isPending || (roles.isPending && roles.fetchStatus !== 'idle');
  const failed = grades.isError ? grades : roles.isError ? roles : null;

  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title="Add staff member"
      description="They are invited by email to sign in, so they can record their time."
    >
      {loading ? (
        <div role="status" aria-label="Loading" className="flex flex-col gap-4">
          <Skeleton shape="rect" className="h-10 w-full" />
          <Skeleton shape="rect" className="h-10 w-full" />
          <Skeleton shape="rect" className="h-10 w-full" />
        </div>
      ) : failed ? (
        <ErrorState
          title="Could not load the form"
          error={isApiError(failed.error) ? failed.error : null}
          onRetry={() => void failed.refetch()}
          retrying={failed.isRefetching}
          className="py-6"
        />
      ) : (
        <AddStaffForm
          grades={grades.data ?? []}
          roles={roles.data ?? []}
          onClose={onClose}
          onCreated={onCreated}
        />
      )}
    </FormPanel>
  );
}
