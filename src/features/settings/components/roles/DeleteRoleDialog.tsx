import { useState } from 'react';

import { useToast } from '@/components/ui';
import { isApiError } from '@/services/api';

import { useDeleteRole } from '../../api/hooks';
import type { Role } from '../../types';
import { describeError } from '../../utils/errors';
import { ConfirmDialog } from '../ConfirmDialog';

export const ROLE_IN_USE_MESSAGE =
  'This role is still in use: staff members hold it. Give them another role, then delete it again.';

export interface DeleteRoleDialogProps {
  role: Role;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteRoleDialog({ role, open, onClose, onDeleted }: DeleteRoleDialogProps) {
  const remove = useDeleteRole();
  const { toast } = useToast();
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const hasMembers = role.member_count > 0;

  const close = () => {
    setError(null);
    onClose();
  };

  const onConfirm = () => {
    setError(null);
    remove.mutate(role.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: `Role “${role.name}” deleted` });
        onClose();
        onDeleted();
      },
      onError: (failure) => {
        if (isApiError(failure) && failure.status === 409) {
          setError({ message: ROLE_IN_USE_MESSAGE });
          return;
        }
        const notice = describeError(failure, 'Could not delete the role');
        setError({ message: notice.description ?? notice.title });
      },
    });
  };

  return (
    <ConfirmDialog
      open={open}
      onClose={close}
      onConfirm={onConfirm}
      title="Delete role?"
      confirmLabel="Delete role"
      loading={remove.isPending}
      confirmDisabled={hasMembers}
      error={error}
    >
      {hasMembers ? (
        <p>
          <strong className="font-medium text-text">{role.name}</strong> can't be deleted yet:{' '}
          {role.member_count === 1
            ? '1 staff member still has'
            : `${role.member_count} staff members still have`}{' '}
          this role. Give them another role on the Staff page first.
        </p>
      ) : (
        <p>
          <strong className="font-medium text-text">{role.name}</strong> will be deleted for
          everyone in this practice. This cannot be undone.
        </p>
      )}
    </ConfirmDialog>
  );
}
