import { useState, type ReactNode } from 'react';

import { ConfirmDialog, useToast, type DropdownItem } from '@/components/ui';
import { OWNER_ROLE_KEY, PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/features/auth';
import { useOrg } from '@/features/organizations';
import { useRoles } from '@/features/settings';

import { useReactivateStaff, useResetPassword, useUnlinkLogin } from '../api';
import { ChangeRoleDialog } from '../components/staff/ChangeRoleDialog';
import { DeactivateStaffDialog } from '../components/staff/DeactivateStaffDialog';
import { DeleteStaffDialog } from '../components/staff/DeleteStaffDialog';
import { EditStaffDialog } from '../components/staff/EditStaffDialog';
import { InviteStaffDialog } from '../components/staff/InviteStaffDialog';
import { LinkLoginDialog } from '../components/staff/LinkLoginDialog';
import type { TemporaryPassword } from '../components/staff/TemporaryPasswordDialog';
import type { StaffMember } from '../types';
import { describeFailure, dialogError } from '../utils/errors';

type DialogType =
  'edit' | 'role' | 'deactivate' | 'invite' | 'link' | 'unlink' | 'reset' | 'delete';
interface DialogState {
  type: DialogType;
  staff: StaffMember;
}

export interface UseStaffActionsOptions {
  /** Shows a temporary password once (a reset, or a login linked with an account). */
  onSecret: (secret: TemporaryPassword) => void;
  /**
   * What "Edit" does. The staff list opens the person's page; without this the edit dialog
   * opens in place (on the person's own page).
   */
  onEdit?: (member: StaffMember) => void;
  /** Called after a person was deleted (their page no longer exists). */
  onDeleted?: (member: StaffMember) => void;
}

export interface StaffActions {
  /** The menu of one person: what the caller may do with them, by permission and state. */
  actionsFor: (member: StaffMember) => DropdownItem[];
  /** Opens the edit dialog for a person. */
  edit: (member: StaffMember) => void;
  /** Every dialog the actions open; render it once. */
  dialogs: ReactNode;
}

/**
 * The actions on a staff member (edit, change role, invite or link a login, reset a password,
 * deactivate, reactivate, delete) with the dialogs they open: shared by the staff list and by
 * a person's own page, so both offer exactly the same things to the same people.
 */
export function useStaffActions({
  onSecret,
  onEdit,
  onDeleted,
}: UseStaffActionsOptions): StaffActions {
  const { role: myRole, can } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const canUpdate = can(PERMISSIONS.memberUpdate);
  const canRemove = can(PERMISSIONS.memberRemove);
  const canInvite = can(PERMISSIONS.memberInvite);
  const canReadRoles = can(PERMISSIONS.roleRead);
  const isOwner = myRole.system_key === OWNER_ROLE_KEY;

  // The role list needs `role.read`; without it "Change role" is not offered.
  const roles = useRoles({ enabled: canReadRoles });
  const reactivate = useReactivateStaff();
  const unlink = useUnlinkLogin();
  const reset = useResetPassword();

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const open = (type: DialogType, member: StaffMember) => {
    setRefusal(null);
    setDialog({ type, staff: member });
  };
  const close = () => setDialog(null);

  const doReactivate = (member: StaffMember) => {
    reactivate.mutate(member.id, {
      onSuccess: () => toast({ tone: 'success', title: `${member.full_name} reactivated` }),
      onError: (error) =>
        toast({ tone: 'error', ...describeFailure(error, 'Could not reactivate') }),
    });
  };

  const confirmUnlink = () => {
    if (dialog?.type !== 'unlink') return;
    const member = dialog.staff;
    unlink.mutate(member.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: `${member.full_name} can no longer sign in` });
        close();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  const confirmReset = () => {
    if (dialog?.type !== 'reset') return;
    const member = dialog.staff;
    const box: { password: string | null } = { password: null };
    reset.mutate(
      { staffId: member.id, onSecret: (password) => (box.password = password) },
      {
        onSuccess: () => {
          close();
          if (box.password !== null) {
            onSecret({
              fullName: member.full_name,
              email: member.login_email ?? member.email ?? '',
              password: box.password,
              kind: 'reset',
            });
          }
        },
        onError: (error) => setRefusal(dialogError(error)),
      },
    );
  };

  const actionsFor = (member: StaffMember): DropdownItem[] => {
    const isSelf = member.id === user?.id;
    // Only an Owner changes another Owner.
    const ownerLocked = member.role.system_key === OWNER_ROLE_KEY && !isOwner;
    const left = member.status === 'left';
    const active = member.status === 'active';
    const items: DropdownItem[] = [];
    const add = (id: string, label: string, type: DialogType) =>
      items.push({ id, label, onSelect: () => open(type, member) });

    if (canUpdate) {
      items.push({
        id: 'edit',
        label: onEdit ? 'Edit' : 'Edit details',
        onSelect: () => (onEdit ? onEdit(member) : open('edit', member)),
      });
    }
    if (canUpdate && canReadRoles && member.has_login && !isSelf && !ownerLocked && !left) {
      add('role', 'Change role', 'role');
    }
    if (canInvite && active && (!member.has_login || member.login_status === 'invited')) {
      add(
        'invite',
        member.login_status === 'invited' ? 'Resend invitation' : 'Invite to sign in',
        'invite',
      );
    }
    if (canInvite && active && !member.has_login) add('link', 'Link login', 'link');
    if (canRemove && member.has_login && !isSelf && !ownerLocked) {
      add('unlink', 'Unlink login', 'unlink');
    }
    if (canUpdate && member.login_status === 'active' && active && !isSelf && !ownerLocked) {
      add('reset', 'Reset password', 'reset');
    }
    if (canUpdate && !active && !isSelf && !ownerLocked) {
      items.push({ id: 'reactivate', label: 'Reactivate', onSelect: () => doReactivate(member) });
    }
    if (canRemove && !left && !isSelf && !ownerLocked)
      add('deactivate', 'Deactivate', 'deactivate');
    if (canRemove && !isSelf && !ownerLocked) {
      items.push({ id: 'separator', separator: true });
      items.push({
        id: 'delete',
        label: 'Delete',
        tone: 'danger',
        onSelect: () => open('delete', member),
      });
    }
    return items;
  };

  const dialogs = (
    <>
      <EditStaffDialog staff={dialog?.type === 'edit' ? dialog.staff : null} onClose={close} />
      <ChangeRoleDialog
        staff={dialog?.type === 'role' ? dialog.staff : null}
        roles={roles.data ?? []}
        onClose={close}
      />
      <DeactivateStaffDialog
        staff={dialog?.type === 'deactivate' ? dialog.staff : null}
        onClose={close}
      />
      <InviteStaffDialog
        staff={dialog?.type === 'invite' ? dialog.staff : null}
        roles={roles.data ?? []}
        onClose={close}
      />
      <LinkLoginDialog
        staff={dialog?.type === 'link' ? dialog.staff : null}
        roles={roles.data ?? []}
        onClose={close}
        onLinked={(linked) => {
          close();
          if (linked.secret) onSecret(linked.secret);
        }}
      />
      <DeleteStaffDialog
        staff={dialog?.type === 'delete' ? dialog.staff : null}
        onClose={close}
        onDeleted={onDeleted}
        onDeactivateInstead={(member) => open('deactivate', member)}
      />
      <ConfirmDialog
        open={dialog?.type === 'unlink'}
        onClose={close}
        onConfirm={confirmUnlink}
        title="Unlink login?"
        confirmLabel="Unlink login"
        loading={unlink.isPending}
        error={refusal}
      >
        <p>
          <strong className="font-medium text-text">{dialog?.staff.full_name}</strong> keeps their
          record and history but can no longer sign in. Their sessions end and everyone they approve
          loses their approver.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog?.type === 'reset'}
        onClose={close}
        onConfirm={confirmReset}
        title="Reset password?"
        confirmLabel="Reset password"
        tone="default"
        loading={reset.isPending}
        error={refusal}
      >
        <p>
          <strong className="font-medium text-text">{dialog?.staff.full_name}</strong> will be
          signed out everywhere and get a new temporary password, which you will see once. They must
          change it at their next sign-in.
        </p>
      </ConfirmDialog>
    </>
  );

  return { actionsFor, edit: (member) => open('edit', member), dialogs };
}
