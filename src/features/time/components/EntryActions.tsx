import { Eye, Pencil, Trash2, Undo2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { ConfirmDialog, useToast, type DropdownItem } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/features/auth';
import { useOrg } from '@/features/organizations';

import { useDeleteEntry, useReopenTimesheet } from '../api';
import type { TimeEntry } from '../types';
import { dialogError } from '../utils/errors';
import { describeEntry } from '../utils/format';
import { entryLockReason, isEntryLocked } from '../utils/locks';
import { EntryPanel } from './EntryPanel';

type Refusal = { message: string; requestId?: string } | null;

export interface EntryActionsOptions {
  /** Names the person of an entry in the revoke confirmation ("You", "Sam Staff"). */
  personName?: (userId: string) => string;
}

export interface EntryActions {
  /**
   * The actions of one entry for `RowActions`: "Edit entry" (or "View entry" while it is locked),
   * "Revoke approval" for an approver, and "Delete entry", disabled with the reason when locked.
   * Empty when the caller may not change the person's time and cannot revoke.
   */
  actionsOf: (entry: TimeEntry) => DropdownItem[];
  /** The caller may change the person's time: own (`time.log`) or others' (`time.manage_all`). */
  mayWrite: (entry: TimeEntry) => boolean;
  /** Why the entry cannot be edited or deleted now ("the timesheet is submitted"), or null. */
  lockReason: (entry: TimeEntry) => string | null;
  /** Opens the time panel on the entry: read-only, with why, while it is locked. */
  edit: (entry: TimeEntry) => void;
  /** Asks before deleting the entry. */
  remove: (entry: TimeEntry) => void;
  /** The time panel and the confirmations: render once, where the panel should open. */
  dialogs: ReactNode;
}

/**
 * Edit and delete of time entries wherever they are listed (a job's time, a client's time, a cell
 * of the week): the same rules as the API, so a locked entry shows why instead of failing. A
 * person changes unbilled time on an open or returned timesheet outside a locked period; approved
 * time is first released with "Revoke approval" (`timesheet.approve`, never on one's own week
 * without `organization.update`), which reopens that person's week. Saving, deleting and revoking
 * refresh the time, the timesheets, the jobs and the clients (`useTimeInvalidation`).
 */
export function useEntryActions({ personName }: EntryActionsOptions = {}): EntryActions {
  const { can } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const deleteEntry = useDeleteEntry();
  const reopen = useReopenTimesheet();
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [deleting, setDeleting] = useState<TimeEntry | null>(null);
  const [revoking, setRevoking] = useState<TimeEntry | null>(null);
  const [refusal, setRefusal] = useState<Refusal>(null);

  const mayWrite = (entry: TimeEntry) =>
    entry.user_id === user?.id ? can(PERMISSIONS.timeLog) : can(PERMISSIONS.timeManageAll);
  // A locked period stays locked whatever happens to the week, so nothing to revoke then.
  const canRevoke = (entry: TimeEntry) =>
    entry.timesheet_status === 'approved' &&
    entry.billing_status === 'unbilled' &&
    !entry.period_locked_through &&
    can(PERMISSIONS.timesheetApprove) &&
    (entry.user_id !== user?.id || can(PERMISSIONS.organizationUpdate));
  const lockReason = (entry: TimeEntry) =>
    isEntryLocked(entry) ? entryLockReason(entry, canRevoke(entry)) : null;

  const edit = (entry: TimeEntry) => setEditing(entry);
  const remove = (entry: TimeEntry) => {
    setRefusal(null);
    setDeleting(entry);
  };

  const actionsOf = (entry: TimeEntry): DropdownItem[] => {
    const writable = mayWrite(entry);
    const reason = lockReason(entry);
    const actions: DropdownItem[] = [];
    if (writable) {
      actions.push(
        reason
          ? {
              id: 'view',
              label: 'View entry',
              icon: <Eye className="size-4" aria-hidden="true" />,
              onSelect: () => edit(entry),
            }
          : {
              id: 'edit',
              label: 'Edit entry',
              icon: <Pencil className="size-4" aria-hidden="true" />,
              onSelect: () => edit(entry),
            },
      );
    }
    if (canRevoke(entry)) {
      actions.push({
        id: 'revoke',
        label: 'Revoke approval',
        icon: <Undo2 className="size-4" aria-hidden="true" />,
        onSelect: () => {
          setRefusal(null);
          setRevoking(entry);
        },
      });
    }
    if (writable) {
      actions.push({
        id: 'delete',
        label: reason ? `Delete entry (${reason})` : 'Delete entry',
        tone: 'danger',
        icon: <Trash2 className="size-4" aria-hidden="true" />,
        disabled: reason !== null,
        onSelect: () => remove(entry),
      });
    }
    return actions;
  };

  const whose = (entry: TimeEntry) =>
    personName?.(entry.user_id) ?? (entry.user_id === user?.id ? 'You' : 'Another person');

  const dialogs = (
    <>
      <EntryPanel open={editing !== null} entry={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          deleteEntry.mutate(deleting.id, {
            onSuccess: () => {
              toast({ tone: 'success', title: 'Time entry deleted' });
              setDeleting(null);
            },
            onError: (error) => setRefusal(dialogError(error)),
          });
        }}
        title="Delete this time entry?"
        confirmLabel="Delete entry"
        loading={deleteEntry.isPending}
        error={refusal}
      >
        <p>{deleting ? `${describeEntry(deleting)} will be removed for good.` : ''}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={() => {
          if (!revoking) return;
          reopen.mutate(revoking.timesheet_id, {
            onSuccess: () => {
              toast({
                tone: 'success',
                title: 'Approval revoked',
                description: 'The time can now be edited or deleted.',
              });
              setRevoking(null);
            },
            onError: (error) => setRefusal(dialogError(error)),
          });
        }}
        title="Revoke approval of this week?"
        confirmLabel="Revoke approval"
        tone="default"
        loading={reopen.isPending}
        error={refusal}
      >
        <p>
          {revoking ? `${whose(revoking)}, ${describeEntry(revoking)}. ` : ''}
          The whole week goes back to open, so its time can be edited or deleted and the week
          submitted again. It cannot be revoked once any of its time is billed.
        </p>
      </ConfirmDialog>
    </>
  );

  return { actionsOf, mayWrite, lockReason, edit, remove, dialogs };
}
