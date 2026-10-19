import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Input, Modal, Select, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { roleOptions, type Role } from '@/features/settings';
import { useRoleName } from '@/features/system';

import { useInviteStaff } from '../../api';
import { inviteSchema, type InviteValues } from '../../schemas/staff';
import type { StaffInvite, StaffMember } from '../../types';
import { toFormError } from '../../utils/errors';
import { DialogActions } from '../DialogActions';

const FIELDS = ['email', 'role_id'] as const;

export interface InviteStaffDialogProps {
  staff: StaffMember | null;
  roles: ReadonlyArray<Role>;
  onClose: () => void;
}

function InviteForm({ staff, roles, onClose }: InviteStaffDialogProps & { staff: StaffMember }) {
  const { role, can } = useOrg();
  const roleName = useRoleName();
  const invite = useInviteStaff();
  const { toast } = useToast();
  const formId = useId();
  const resend = staff.login_status === 'invited';
  const options = roleOptions(roles, { role, can }, roleName);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: staff.login_email ?? staff.email ?? '', role_id: staff.role.id },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<InviteValues>({ setError, fields: FIELDS });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    // A pending login keeps its address and role: the invitation is only sent again.
    const body: StaffInvite = {};
    if (!resend) {
      if (values.email) body.email = values.email;
      if (values.role_id && values.role_id !== staff.role.id) body.role_id = values.role_id;
    }
    invite.mutate(
      { staffId: staff.id, body },
      {
        onSuccess: (result) => {
          toast({
            tone: 'success',
            title: result.resent ? 'Invitation sent again' : 'Invitation sent',
            description: `${staff.full_name} gets an email with a link to choose a password.`,
          });
          onClose();
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
        {resend ? (
          <p className="text-sm text-text-muted">
            {staff.full_name} was invited as{' '}
            <span className="font-medium break-all text-text">{staff.login_email}</span> and has not
            chosen a password yet. Sending the invitation again makes the earlier link stop working.
          </p>
        ) : (
          <>
            <p className="text-sm text-text-muted">
              {staff.full_name} gets an email with a link, valid for 7 days, to choose a password.
              Until then they cannot sign in.
            </p>
            <Input
              label="Sign-in email"
              type="email"
              autoComplete="off"
              spellCheck={false}
              hint="Leave empty to use the work email."
              error={errors.email?.message}
              {...register('email')}
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
          </>
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
          loading={invite.isPending}
          disabled={retryIn > 0}
        >
          {resend ? 'Resend invitation' : 'Send invitation'}
        </Button>
      </DialogActions>
    </>
  );
}

/** Invite a staff member to sign in: an emailed link to choose a password. */
export function InviteStaffDialog({ staff, roles, onClose }: InviteStaffDialogProps) {
  return (
    <Modal
      open={staff !== null}
      onClose={onClose}
      title={staff?.login_status === 'invited' ? 'Resend invitation' : 'Invite to sign in'}
      description={staff ? `${staff.full_name} · ${staff.code}` : undefined}
    >
      {staff ? <InviteForm key={staff.id} staff={staff} roles={roles} onClose={onClose} /> : null}
    </Modal>
  );
}
