import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { FormAlert, useSubmitError } from '@/components/forms';
import {
  AddAnotherButton,
  Button,
  Checkbox,
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

import { useCreateStaff, useGradeOptions, useInviteStaff, useLinkLogin } from '../../api';
import { staffCreateSchema, type StaffFormValues } from '../../schemas/staff';
import type { Grade, StaffCreate, StaffDetail } from '../../types';
import { describeFailure, toFormError } from '../../utils/errors';
import { percentToBp } from '../../utils/format';
import { RadioGroupField } from '../RadioGroupField';
import { StaffFormFields } from './StaffFormFields';
import type { TemporaryPassword } from './TemporaryPasswordDialog';
import { DialogActions } from '../DialogActions';
import { todayInZone } from '@/utils/dates';

const FIELDS = [
  'full_name',
  'code',
  'email',
  'grade_id',
  'approver_id',
  'job_title',
  'initials',
  'hours_per_day',
  'working_days',
  'target_percent',
  'start_date',
  'leaving_date',
  'login_email',
  'role_id',
  'cost_rate',
  'charge_rate',
  'rate_effective_from',
] as const;
/** API field → form field. */
const FIELD_NAMES = {
  working_minutes_per_day: 'hours_per_day',
  chargeable_target_bp: 'target_percent',
};

const LOGIN_OPTIONS = [
  {
    value: 'none',
    label: 'No login',
    description: 'Record time for them without an account. You can give them a login later.',
  },
  {
    value: 'invite',
    label: 'Invite by email',
    description: 'They choose a password through a link we email them.',
  },
  {
    value: 'create',
    label: 'Create an account now',
    description: 'You get a temporary password to give them.',
  },
] as const;

/** What the page needs once a staff member has been added. */
export interface CreatedStaff {
  staff: StaffDetail;
  /** The temporary password of an account created with the record; shown once. */
  secret: TemporaryPassword | null;
}

export interface AddStaffPanelProps {
  open: boolean;
  onClose: () => void;
  onCreated: (created: CreatedStaff) => void;
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
  const link = useLinkLogin();
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
      login: 'none',
      login_email: '',
      role_id: roles.find((role) => role.system_key === 'staff')?.id ?? '',
      send_email: true,
      cost_rate: '',
      charge_rate: '',
      rate_effective_from: todayInZone(organization.timezone),
    },
  });
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = form;
  const login = useWatch({ control, name: 'login' });
  const workEmail = useWatch({ control, name: 'email' });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<StaffFormValues>({ setError, fields: FIELDS });

  /** Closes the panel, or, for "add another", empties the person's own fields and stays. */
  const finish = (result: CreatedStaff) => {
    // A temporary password is shown once, in a dialog of the page: that always closes the panel.
    if (again.consume() && result.secret === null) {
      form.reset({
        ...form.getValues(),
        full_name: '',
        code: '',
        email: '',
        initials: '',
        login_email: '',
      });
      // reset() unregisters the fields until the next render, so focus after it.
      setTimeout(() => form.setFocus('full_name'), 0);
      return;
    }
    onCreated(result);
  };

  const onSubmit = handleSubmit(async (values) => {
    clearSubmitError();
    const body: StaffCreate = {
      full_name: values.full_name,
      grade_id: values.grade_id,
      start_date: values.start_date,
      working_minutes_per_day: parseMinutes(values.hours_per_day) ?? 0,
      working_days: values.working_days,
    };
    if (values.code) body.code = values.code.toUpperCase();
    if (values.email) body.email = values.email;
    if (values.approver_id) body.approver_id = values.approver_id;
    if (values.job_title) body.job_title = values.job_title;
    if (values.initials) body.initials = values.initials.toUpperCase();
    const target = values.target_percent ? percentToBp(values.target_percent) : null;
    if (target !== null) body.chargeable_target_bp = target;
    if (values.login !== 'none' && values.role_id) body.role_id = values.role_id;
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
    if (values.login === 'none') {
      finish({ staff: created, secret: null });
      return;
    }

    // The record exists now; a failed login step is reported without undoing it.
    const signInEmail = values.login_email || values.email;
    try {
      if (values.login === 'invite') {
        await invite.mutateAsync({
          staffId: created.id,
          body: values.login_email ? { email: values.login_email } : {},
        });
        toast({ tone: 'success', title: `Invitation sent to ${signInEmail}` });
        finish({ staff: created, secret: null });
        return;
      }
      const box: { password: string | null } = { password: null };
      const linked = await link.mutateAsync({
        staffId: created.id,
        body: {
          mode: 'create_account',
          ...(values.login_email ? { email: values.login_email } : {}),
          send_email: values.send_email,
        },
        onSecret: (password) => (box.password = password),
      });
      finish({
        staff: created,
        secret:
          box.password === null
            ? null
            : {
                fullName: created.full_name,
                email: linked.staff.login_email ?? signInEmail,
                password: box.password,
                kind: 'created',
                emailSent: linked.emailSent,
              },
      });
    } catch (error) {
      toast({
        tone: 'error',
        ...describeFailure(error, 'Staff member added, but the login could not be created'),
      });
      finish({ staff: created, secret: null });
    }
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
        <Controller
          control={control}
          name="login"
          render={({ field }) => (
            <RadioGroupField
              legend="Sign-in access"
              value={field.value}
              onChange={field.onChange}
              options={LOGIN_OPTIONS}
            />
          )}
        />
        {login !== 'none' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Sign-in email"
              required={workEmail.trim() === ''}
              type="email"
              autoComplete="off"
              spellCheck={false}
              hint="Leave empty to use the work email."
              error={errors.login_email?.message}
              {...register('login_email')}
            />
            {options.length > 0 ? (
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
            ) : null}
          </div>
        ) : null}
        {login === 'create' ? (
          <Controller
            control={control}
            name="send_email"
            render={({ field }) => (
              <Checkbox
                label="Email them a link to choose their own password"
                description="The email holds a one-time link only. You still give them the password shown next."
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            )}
          />
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
 * "Add staff member": a record without a login by default; optionally an invitation or an
 * account with a temporary password (which the page shows once).
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
      description="People you record time for do not need a login. Give them one now or later."
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
