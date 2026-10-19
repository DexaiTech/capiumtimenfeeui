import { zodResolver } from '@hookform/resolvers/zod';
import { TriangleAlert } from 'lucide-react';
import { useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Checkbox, Input, Modal, Select, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { roleOptions, type Role } from '@/features/settings';
import { useRoleName } from '@/features/system';

import { useLinkLogin } from '../../api';
import { linkLoginSchema, type LinkLoginValues } from '../../schemas/staff';
import type { StaffLinkLogin, StaffMember } from '../../types';
import { toFormError } from '../../utils/errors';
import { RadioGroupField, type RadioOption } from '../RadioGroupField';
import type { TemporaryPassword } from './TemporaryPasswordDialog';
import { DialogActions } from '../DialogActions';

const FIELDS = ['mode', 'email', 'role_id'] as const;

const MODE_OPTIONS: RadioOption<LinkLoginValues['mode']>[] = [
  {
    value: 'create_account',
    label: 'Create an account now',
    description: 'You get a temporary password to give them.',
  },
  {
    value: 'existing_user',
    label: 'Link to an existing login',
    description:
      'They already sign in to this practice. This record is merged into theirs and everything recorded for it moves to them.',
  },
];

/** What the page needs once a login has been linked. */
export interface LinkedLogin {
  /** The staff member: for a merge, the person who already signed in. */
  staff: { id: string; full_name: string };
  /** The temporary password of a new account; shown once. */
  secret: TemporaryPassword | null;
}

export interface LinkLoginDialogProps {
  staff: StaffMember | null;
  roles: ReadonlyArray<Role>;
  onClose: () => void;
  onLinked: (linked: LinkedLogin) => void;
}

function LinkLoginForm({
  staff,
  roles,
  onClose,
  onLinked,
}: LinkLoginDialogProps & { staff: StaffMember }) {
  const { role, can } = useOrg();
  const roleName = useRoleName();
  const link = useLinkLogin();
  const { toast } = useToast();
  const formId = useId();
  const options = roleOptions(roles, { role, can }, roleName);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<LinkLoginValues>({
    resolver: zodResolver(linkLoginSchema),
    defaultValues: {
      mode: 'create_account',
      email: staff.email ?? '',
      role_id: staff.role.id,
      send_email: true,
    },
  });
  const mode = useWatch({ control, name: 'mode' });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<LinkLoginValues>({ setError, fields: FIELDS });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const body: StaffLinkLogin =
      values.mode === 'existing_user'
        ? { mode: 'existing_user', email: values.email }
        : {
            mode: 'create_account',
            ...(values.email ? { email: values.email } : {}),
            ...(values.role_id && values.role_id !== staff.role.id
              ? { role_id: values.role_id }
              : {}),
            send_email: values.send_email,
          };
    // The password never leaves this closure except into the one-time dialog.
    const box: { password: string | null } = { password: null };
    link.mutate(
      { staffId: staff.id, body, onSecret: (password) => (box.password = password) },
      {
        onSuccess: (linked) => {
          if (values.mode === 'existing_user') {
            toast({
              tone: 'success',
              title: 'Login linked',
              description: `The record of ${staff.full_name} was merged into ${linked.staff.full_name}, who signs in with ${values.email}.`,
            });
          } else {
            toast({ tone: 'success', title: `Login created for ${staff.full_name}` });
          }
          onLinked({
            staff: { id: linked.staff.id, full_name: linked.staff.full_name },
            secret:
              box.password === null
                ? null
                : {
                    fullName: staff.full_name,
                    email: linked.staff.login_email ?? values.email,
                    password: box.password,
                    kind: 'linked',
                    emailSent: linked.emailSent,
                  },
          });
        },
        onError: (error) => handleSubmitError(toFormError(error)),
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
          name="mode"
          render={({ field }) => (
            <RadioGroupField
              legend="How they sign in"
              value={field.value}
              onChange={field.onChange}
              options={MODE_OPTIONS}
            />
          )}
        />
        <Input
          label={mode === 'existing_user' ? 'Email of their existing login' : 'Sign-in email'}
          type="email"
          autoComplete="off"
          spellCheck={false}
          hint={mode === 'create_account' ? 'Leave empty to use the work email.' : undefined}
          error={errors.email?.message}
          {...register('email')}
        />
        {mode === 'create_account' ? (
          <>
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
          </>
        ) : (
          <div
            role="note"
            className="flex items-start gap-2.5 rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5 text-sm text-text"
          >
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>
              Merging cannot be undone. The person who signs in keeps their account and role and
              takes over this record&apos;s code, grade, working hours and dates.
            </p>
          </div>
        )}
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
          loading={link.isPending}
          disabled={retryIn > 0}
        >
          {mode === 'existing_user' ? 'Link login' : 'Create login'}
        </Button>
      </DialogActions>
    </>
  );
}

/** Give a staff member without a login access: a new account, or merge into an existing login. */
export function LinkLoginDialog({ staff, roles, onClose, onLinked }: LinkLoginDialogProps) {
  return (
    <Modal
      open={staff !== null}
      onClose={onClose}
      title="Link a login"
      description={staff ? `${staff.full_name} · ${staff.code}` : undefined}
      closeOnBackdrop={false}
    >
      {staff ? (
        <LinkLoginForm
          key={staff.id}
          staff={staff}
          roles={roles}
          onClose={onClose}
          onLinked={onLinked}
        />
      ) : null}
    </Modal>
  );
}
