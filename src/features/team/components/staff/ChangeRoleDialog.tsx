import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Modal, Select, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { roleOptions, type Role } from '@/features/settings';
import { useRoleName } from '@/features/system';
import { isApiError } from '@/services/api';

import { useChangeRole } from '../../api';
import { changeRoleSchema, type ChangeRoleValues } from '../../schemas/staff';
import type { StaffMember } from '../../types';
import { DialogActions } from '../DialogActions';

const FIELDS = ['role_id'] as const;

export interface ChangeRoleDialogProps {
  staff: StaffMember | null;
  roles: ReadonlyArray<Role>;
  onClose: () => void;
}

function ChangeRoleForm({ staff, roles, onClose }: ChangeRoleDialogProps & { staff: StaffMember }) {
  const { role, can } = useOrg();
  const change = useChangeRole();
  const roleName = useRoleName();
  const { toast } = useToast();
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<ChangeRoleValues>({
    resolver: zodResolver(changeRoleSchema),
    defaultValues: { role_id: staff.role.id },
  });
  const selected = useWatch({ control, name: 'role_id' });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<ChangeRoleValues>({ setError, fields: FIELDS });
  const options = roleOptions(roles, { role, can }, roleName);

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    change.mutate(
      { staffId: staff.id, roleId: values.role_id },
      {
        onSuccess: () => {
          const next = roles.find((entry) => entry.id === values.role_id);
          toast({
            tone: 'success',
            title: 'Role changed',
            description: `${staff.full_name} is now ${next ? roleName(next) : 'in the new role'}.`,
          });
          onClose();
        },
        onError: (error) => {
          if (isApiError(error) && error.status === 403) {
            // The grant rules: explained on the field, where the choice was made.
            setError('role_id', { type: 'server', message: error.message });
            return;
          }
          handleSubmitError(error);
        },
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
        <Select
          label="Role"
          options={options}
          hint={
            options.some((option) => option.disabled)
              ? 'You can assign only roles whose permissions you hold yourself.'
              : undefined
          }
          error={errors.role_id?.message}
          {...register('role_id')}
        />
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
          loading={change.isPending}
          disabled={selected === staff.role.id || retryIn > 0}
        >
          Change role
        </Button>
      </DialogActions>
    </>
  );
}

/** Change the role of a person who can sign in (their role in the practice). */
export function ChangeRoleDialog({ staff, roles, onClose }: ChangeRoleDialogProps) {
  return (
    <Modal
      open={staff !== null}
      onClose={onClose}
      title="Change role"
      description={staff ? `Choose what ${staff.full_name} can do in this practice.` : undefined}
      size="sm"
    >
      {staff ? (
        <ChangeRoleForm key={staff.id} staff={staff} roles={roles} onClose={onClose} />
      ) : null}
    </Modal>
  );
}
